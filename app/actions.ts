"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { withOrg } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getRole, canEdit } from "@/lib/access";

export async function createWorkspace(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const orgId = randomUUID();
  await withOrg(orgId, async (client) => {
    await client.query("INSERT INTO organizations (id, name) VALUES ($1, $2)", [
      orgId,
      name,
    ]);
    await client.query(
      "INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, 'owner')",
      [orgId, session.userId],
    );
    await client.query(
      "INSERT INTO channels (org_id, name) VALUES ($1, 'general')",
      [orgId],
    );
  });

  redirect(`/w/${orgId}`);
}

export async function postMessage(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const orgId = String(formData.get("orgId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  await withOrg(orgId, async (client) => {
    // Viewers and non-members cannot post
    const role = await getRole(client, session.userId);
    if (!canEdit(role))
      throw new Error("You don't have permission to post here");

    const channel = await client.query(
      "SELECT id FROM channels WHERE name = 'general'",
    );
    await client.query(
      "INSERT INTO messages (org_id, channel_id, user_id, body) VALUES ($1, $2, $3, $4)",
      [orgId, channel.rows[0].id, session.userId, body],
    );
  });

  revalidatePath(`/w/${orgId}`);
}
