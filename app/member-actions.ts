"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { pool, withOrg } from "@/lib/db";
import { getRole } from "@/lib/access";
import { getSession } from "@/lib/session";

export async function addMember(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const orgId = String(formData.get("orgId") ?? "");
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const role = String(formData.get("role") ?? "");
  if (!["editor", "viewer"].includes(role)) return;

  const back = `/w/${orgId}/members`;

  const found = await pool.query("SELECT id FROM users WHERE email = $1", [
    email,
  ]);
  if (found.rowCount === 0) {
    redirect(
      back +
        "?error=" +
        encodeURIComponent(
          "No account with that email. They need to sign up first.",
        ),
    );
  }

  await withOrg(orgId, async (client) => {
    if ((await getRole(client, session.userId)) !== "owner") {
      throw new Error("Only owners can add members");
    }
    // Adding someone who is already a member changes their role (owners stay owners)
    await client.query(
      `INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role
       WHERE memberships.role <> 'owner'`,
      [orgId, found.rows[0].id, role],
    );
  });

  revalidatePath(back);
  redirect(back);
}

export async function removeMember(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const orgId = String(formData.get("orgId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const back = `/w/${orgId}/members`;

  await withOrg(orgId, async (client) => {
    if ((await getRole(client, session.userId)) !== "owner") {
      throw new Error("Only owners can remove members");
    }
    await client.query(
      "DELETE FROM memberships WHERE user_id = $1 AND role <> 'owner'",
      [userId],
    );
  });

  revalidatePath(back);
  redirect(back);
}

export async function changeRole(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const orgId = String(formData.get("orgId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!["editor", "viewer"].includes(role)) return;
  const back = `/w/${orgId}/members`;

  await withOrg(orgId, async (client) => {
    if ((await getRole(client, session.userId)) !== "owner") {
      throw new Error("Only owners can change roles");
    }
    await client.query(
      "UPDATE memberships SET role = $1 WHERE user_id = $2 AND role <> 'owner'",
      [role, userId],
    );
  });

  revalidatePath(back);
  redirect(back);
}
