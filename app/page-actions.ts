"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { withOrg } from "@/lib/db";
import { getRole, canEdit, isUuid } from "@/lib/access";
import { getSession } from "@/lib/session";

// Refresh the sidebar (it lives in the workspace layout)
function refresh(orgId: string) {
  revalidatePath(`/w/${orgId}`, "layout");
}

export async function createPage(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const orgId = String(formData.get("orgId") ?? "");
  if (!isUuid(orgId)) return;
  const title =
    String(formData.get("title") ?? "")
      .trim()
      .slice(0, 200) || "Untitled";
  const parentRaw = String(formData.get("parentId") ?? "");
  const parentId = isUuid(parentRaw) ? parentRaw : null;

  const pageId = await withOrg(orgId, async (client) => {
    if (!canEdit(await getRole(client, session.userId))) {
      throw new Error("You don't have permission to create pages");
    }
    const res = await client.query(
      `INSERT INTO pages (org_id, parent_id, title, created_by)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [orgId, parentId, title, session.userId],
    );
    return res.rows[0].id as string;
  });

  refresh(orgId);
  redirect(`/w/${orgId}/p/${pageId}`);
}

export async function renamePage(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const orgId = String(formData.get("orgId") ?? "");
  const pageId = String(formData.get("pageId") ?? "");
  const title = String(formData.get("title") ?? "")
    .trim()
    .slice(0, 200);
  if (!isUuid(orgId) || !isUuid(pageId) || !title) return;

  await withOrg(orgId, async (client) => {
    if (!canEdit(await getRole(client, session.userId))) {
      throw new Error("You don't have permission to rename pages");
    }
    await client.query(
      "UPDATE pages SET title = $1, updated_at = now() WHERE id = $2",
      [title, pageId],
    );
  });

  refresh(orgId);
  redirect(`/w/${orgId}/p/${pageId}`);
}

export async function deletePage(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const orgId = String(formData.get("orgId") ?? "");
  const pageId = String(formData.get("pageId") ?? "");
  if (!isUuid(orgId) || !isUuid(pageId)) return;

  await withOrg(orgId, async (client) => {
    if (!canEdit(await getRole(client, session.userId))) {
      throw new Error("You don't have permission to delete pages");
    }
    // Sub-pages are deleted too (ON DELETE CASCADE)
    await client.query("DELETE FROM pages WHERE id = $1", [pageId]);
  });

  refresh(orgId);
  redirect(`/w/${orgId}`);
}
