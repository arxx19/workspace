import { Pool, type PoolClient } from "pg";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Superuser connection: seeds and inspects data (bypasses RLS)
const admin = new Pool({
  connectionString: "postgresql://postgres:postgres@localhost:5432/workspace",
});
// App connection: subject to RLS, like the real app
const app = new Pool({
  connectionString:
    "postgresql://app_user:app_password@localhost:5432/workspace",
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

beforeAll(async () => {
  await admin.query(
    "TRUNCATE organizations, users, memberships, channels, messages CASCADE",
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
