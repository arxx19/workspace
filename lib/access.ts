import type { PoolClient } from "pg";

export type Role = "owner" | "editor" | "viewer";

// Your role in the current workspace (call inside withOrg), or null if not a member
export async function getRole(
  client: PoolClient,
  userId: string,
): Promise<Role | null> {
  const res = await client.query(
    "SELECT role FROM memberships WHERE user_id = $1",
    [userId],
  );
  return (res.rows[0]?.role as Role) ?? null;
}

export const canEdit = (role: Role | null) =>
  role === "owner" || role === "editor";

export const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
