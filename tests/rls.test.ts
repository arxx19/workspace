import { Pool, type PoolClient } from "pg";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Superuser connection: seeds and inspects data (bypasses RLS)
const admin = new Pool({
  connectionString:
    "postgresql://postgres:postgres@localhost:5432/workspace_test",
});
// App connection: subject to RLS, like the real app
const app = new Pool({
  connectionString:
    "postgresql://app_user:app_password@localhost:5432/workspace_test",
});

// Runs queries as if the request belongs to one workspace
async function asOrg<T>(
  orgId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await app.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_org', $1, true)", [
      orgId,
    ]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

let orgA: string;
let orgB: string;
let userId: string;
let channelA: string;
let pageA: string;
let pageB: string;

beforeAll(async () => {
  await admin.query(
    "TRUNCATE organizations, users, memberships, channels, messages, pages CASCADE",
  );
  orgA = (
    await admin.query(
      "INSERT INTO organizations (name) VALUES ('Org A') RETURNING id",
    )
  ).rows[0].id;
  orgB = (
    await admin.query(
      "INSERT INTO organizations (name) VALUES ('Org B') RETURNING id",
    )
  ).rows[0].id;
  userId = (
    await admin.query(
      "INSERT INTO users (email, name) VALUES ('test@example.com', 'Test') RETURNING id",
    )
  ).rows[0].id;
  channelA = (
    await admin.query(
      "INSERT INTO channels (org_id, name) VALUES ($1, 'general') RETURNING id",
      [orgA],
    )
  ).rows[0].id;
  const channelB = (
    await admin.query(
      "INSERT INTO channels (org_id, name) VALUES ($1, 'general') RETURNING id",
      [orgB],
    )
  ).rows[0].id;
  await admin.query(
    "INSERT INTO messages (org_id, channel_id, user_id, body) VALUES ($1, $2, $3, 'secret A')",
    [orgA, channelA, userId],
  );
  await admin.query(
    "INSERT INTO messages (org_id, channel_id, user_id, body) VALUES ($1, $2, $3, 'secret B')",
    [orgB, channelB, userId],
  );
  pageA = (
    await admin.query(
      "INSERT INTO pages (org_id, title, created_by) VALUES ($1, 'Page A', $2) RETURNING id",
      [orgA, userId],
    )
  ).rows[0].id;
  pageB = (
    await admin.query(
      "INSERT INTO pages (org_id, title, created_by) VALUES ($1, 'Page B', $2) RETURNING id",
      [orgB, userId],
    )
  ).rows[0].id;
});

afterAll(async () => {
  await admin.end();
  await app.end();
});

describe("tenant isolation (RLS)", () => {
  it("denies_reading_another_workspace", async () => {
    const all = await asOrg(orgA, (c) => c.query("SELECT * FROM messages"));
    expect(all.rows.every((r: { org_id: string }) => r.org_id === orgA)).toBe(
      true,
    );
    const other = await asOrg(orgA, (c) =>
      c.query("SELECT * FROM messages WHERE org_id = $1", [orgB]),
    );
    expect(other.rowCount).toBe(0);
  });

  it("denies_updating_another_workspace", async () => {
    const res = await asOrg(orgA, (c) =>
      c.query("UPDATE messages SET body = 'hacked' WHERE org_id = $1", [orgB]),
    );
    expect(res.rowCount).toBe(0);
    const check = await admin.query(
      "SELECT body FROM messages WHERE org_id = $1",
      [orgB],
    );
    expect(check.rows[0].body).toBe("secret B");
  });

  it("denies_deleting_another_workspace", async () => {
    const res = await asOrg(orgA, (c) =>
      c.query("DELETE FROM messages WHERE org_id = $1", [orgB]),
    );
    expect(res.rowCount).toBe(0);
    const check = await admin.query(
      "SELECT count(*)::int AS n FROM messages WHERE org_id = $1",
      [orgB],
    );
    expect(check.rows[0].n).toBe(1);
  });

  it("denies_inserting_into_another_workspace", async () => {
    await expect(
      asOrg(orgA, (c) =>
        c.query(
          "INSERT INTO messages (org_id, channel_id, user_id, body) VALUES ($1, $2, $3, 'planted')",
          [orgB, channelA, userId],
        ),
      ),
    ).rejects.toThrow();
  });

  it("returns_nothing_when_no_workspace_is_set", async () => {
    const res = await app.query("SELECT * FROM messages");
    expect(res.rowCount).toBe(0);
  });
});

describe("pages isolation (RLS)", () => {
  it("allows_reading_own_workspace_pages", async () => {
    const res = await asOrg(orgA, (c) =>
      c.query("SELECT id FROM pages WHERE id = $1", [pageA]),
    );
    expect(res.rowCount).toBe(1);
  });

  it("denies_reading_another_workspace_pages", async () => {
    const res = await asOrg(orgA, (c) =>
      c.query("SELECT id FROM pages WHERE id = $1", [pageB]),
    );
    expect(res.rowCount).toBe(0);
  });

  it("denies_renaming_another_workspace_page", async () => {
    const res = await asOrg(orgA, (c) =>
      c.query("UPDATE pages SET title = 'hacked' WHERE id = $1", [pageB]),
    );
    expect(res.rowCount).toBe(0);
    const check = await admin.query("SELECT title FROM pages WHERE id = $1", [
      pageB,
    ]);
    expect(check.rows[0].title).toBe("Page B");
  });

  it("denies_deleting_another_workspace_page", async () => {
    const res = await asOrg(orgA, (c) =>
      c.query("DELETE FROM pages WHERE id = $1", [pageB]),
    );
    expect(res.rowCount).toBe(0);
    const check = await admin.query(
      "SELECT count(*)::int AS n FROM pages WHERE id = $1",
      [pageB],
    );
    expect(check.rows[0].n).toBe(1);
  });

  it("denies_inserting_page_into_another_workspace", async () => {
    await expect(
      asOrg(orgA, (c) =>
        c.query(
          "INSERT INTO pages (org_id, title, created_by) VALUES ($1, 'planted', $2)",
          [orgB, userId],
        ),
      ),
    ).rejects.toThrow();
  });

  it("denies_nesting_under_another_workspace_page", async () => {
    await expect(
      asOrg(orgA, (c) =>
        c.query(
          "INSERT INTO pages (org_id, parent_id, title, created_by) VALUES ($1, $2, 'sneaky', $3)",
          [orgA, pageB, userId],
        ),
      ),
    ).rejects.toThrow();
  });
});
