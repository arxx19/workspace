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
export async function savePageContent(
  orgId: string,
  pageId: string,
  content: unknown,
  contentText: string,
) {
  const session = await getSession();
  if (!session) throw new Error("Not logged in");
  if (!isUuid(orgId) || !isUuid(pageId)) throw new Error("Invalid id");

  await withOrg(orgId, async (client) => {
    if (!canEdit(await getRole(client, session.userId))) {
      throw new Error("You don't have permission to edit this page");
    }
    const current = await client.query(
      "SELECT title FROM pages WHERE id = $1",
      [pageId],
    );
    const title = current.rows[0]?.title ?? "Untitled";

    await client.query(
      "UPDATE pages SET content = $1, content_text = $2, updated_at = now() WHERE id = $3",
      [JSON.stringify(content), contentText, pageId],
    );
    await client.query(
      `INSERT INTO page_versions (org_id, page_id, title, content, content_text, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        orgId,
        pageId,
        title,
        JSON.stringify(content),
        contentText,
        session.userId,
      ],
    );
    // Keep only the most recent 50 versions per page
    await client.query(
      `DELETE FROM page_versions WHERE page_id = $1 AND id NOT IN (
         SELECT id FROM page_versions WHERE page_id = $1
         ORDER BY created_at DESC LIMIT 50
       )`,
      [pageId],
    );
  });
}

export async function listVersions(orgId: string, pageId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not logged in");
  if (!isUuid(orgId) || !isUuid(pageId)) throw new Error("Invalid id");

  return withOrg(orgId, async (client) => {
    if (!(await getRole(client, session.userId)))
      throw new Error("Not a member");
    const res = await client.query(
      `SELECT v.id, v.title, v.created_at, u.name AS author
       FROM page_versions v JOIN users u ON u.id = v.created_by
       WHERE v.page_id = $1
       ORDER BY v.created_at DESC`,
      [pageId],
    );
    return res.rows as {
      id: string;
      title: string;
      created_at: string;
      author: string;
    }[];
  });
}

export async function restoreVersion(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const orgId = String(formData.get("orgId") ?? "");
  const pageId = String(formData.get("pageId") ?? "");
  const versionId = String(formData.get("versionId") ?? "");
  if (!isUuid(orgId) || !isUuid(pageId) || !isUuid(versionId)) return;

  await withOrg(orgId, async (client) => {
    if (!canEdit(await getRole(client, session.userId))) {
      throw new Error("You don't have permission to restore versions");
    }
    const v = await client.query(
      "SELECT title, content, content_text FROM page_versions WHERE id = $1 AND page_id = $2",
      [versionId, pageId],
    );
    if (v.rowCount === 0) throw new Error("Version not found");
    const { title, content, content_text } = v.rows[0];

    await client.query(
      "UPDATE pages SET title = $1, content = $2, content_text = $3, updated_at = now() WHERE id = $4",
      [title, content, content_text, pageId],
    );
    // Restoring is itself saved as a new version, so it can be undone too
    await client.query(
      `INSERT INTO page_versions (org_id, page_id, title, content, content_text, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [orgId, pageId, title, content, content_text, session.userId],
    );
  });

  refresh(orgId);
  redirect(`/w/${orgId}/p/${pageId}`);
}
