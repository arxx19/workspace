import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { withOrg } from "@/lib/db";
import { getRole, canEdit, isUuid } from "@/lib/access";
import { getSession } from "@/lib/session";
import { createPage } from "@/app/page-actions";
import PageTree, { type PageNode } from "@/components/PageTree";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { orgId } = await params;
  if (!isUuid(orgId)) notFound();

  const data = await withOrg(orgId, async (client) => {
    const role = await getRole(client, session.userId);
    if (!role) return null;
    const org = await client.query("SELECT name FROM organizations");
    const pages = await client.query(
      "SELECT id, title, parent_id FROM pages ORDER BY created_at",
    );
    return {
      role,
      orgName: org.rows[0]?.name as string,
      pages: pages.rows as PageNode[],
    };
  });

  if (!data) notFound();

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r border-gray-800 p-4">
        <Link href="/" className="text-xs text-gray-500 underline">
          ← All workspaces
        </Link>
        <Link
          href={`/w/${orgId}`}
          className="mb-4 mt-2 block truncate text-lg font-bold"
        >
          {data.orgName}
        </Link>

        <form action={`/w/${orgId}/search`} className="mb-4">
          <input
            name="q"
            placeholder="Search…"
            className="w-full rounded border border-gray-500 bg-white p-1 text-sm text-black placeholder-gray-500"
          />
        </form>

        <div className="mb-4 flex flex-col gap-1 text-sm text-gray-400"></div>

        <div className="mb-4 flex flex-col gap-1 text-sm text-gray-400">
          <Link
            href={`/w/${orgId}`}
            className="rounded px-2 py-1 hover:bg-gray-800"
          >
            # general (chat)
          </Link>
          <Link
            href={`/w/${orgId}/members`}
            className="rounded px-2 py-1 hover:bg-gray-800"
          >
            Members
          </Link>
        </div>

        <h2 className="mb-1 px-2 text-xs font-semibold uppercase text-gray-500">
          Pages
        </h2>
        <PageTree orgId={orgId} pages={data.pages} />

        {canEdit(data.role) && (
          <form action={createPage} className="mt-4 flex gap-1">
            <input type="hidden" name="orgId" value={orgId} />
            <input type="hidden" name="parentId" value="" />
            <input
              name="title"
              placeholder="New page"
              className="min-w-0 flex-1 rounded border border-gray-500 bg-white p-1 text-sm text-black placeholder-gray-500"
            />
            <button className="rounded bg-blue-600 px-2 text-sm text-white">
              +
            </button>
          </form>
        )}
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
