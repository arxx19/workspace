import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { withOrg } from "@/lib/db";
import { getRole, canEdit, isUuid } from "@/lib/access";
import { getSession } from "@/lib/session";
import { createPage, renamePage, deletePage } from "@/app/page-actions";
import ConfirmButton from "@/components/ConfirmButton";
import Editor from "@/components/Editor";

export const dynamic = "force-dynamic";

type Item = { id: string; title: string };

const input =
  "rounded border border-gray-500 bg-white p-2 text-black placeholder-gray-500";

export default async function PageView({
  params,
}: {
  params: Promise<{ orgId: string; pageId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { orgId, pageId } = await params;
  if (!isUuid(orgId) || !isUuid(pageId)) notFound();

  const data = await withOrg(orgId, async (client) => {
    const role = await getRole(client, session.userId);
    if (!role) return null;

    const res = await client.query(
      "SELECT id, title, parent_id, content FROM pages WHERE id = $1",
      [pageId],
    );
    const page = res.rows[0] as
      | { id: string; title: string; parent_id: string | null; content: object }
      | undefined;
    if (!page) return null;

    const children = await client.query(
      "SELECT id, title FROM pages WHERE parent_id = $1 ORDER BY created_at",
      [pageId],
    );
    let parent: Item | null = null;
    if (page.parent_id) {
      const p = await client.query(
        "SELECT id, title FROM pages WHERE id = $1",
        [page.parent_id],
      );
      parent = (p.rows[0] as Item) ?? null;
    }
    return { role, page, parent, children: children.rows as Item[] };
  });

  if (!data) notFound();
  const editable = canEdit(data.role);

  return (
    <main className="mx-auto max-w-2xl p-8">
      {data.parent && (
        <Link
          href={`/w/${orgId}/p/${data.parent.id}`}
          className="text-sm text-gray-400 underline"
        >
          ↑ {data.parent.title}
        </Link>
      )}

      {editable ? (
        <form action={renamePage} className="mb-6 mt-2 flex gap-2">
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="pageId" value={pageId} />
          <input
            name="title"
            defaultValue={data.page.title}
            required
            className={`${input} flex-1 text-2xl font-bold`}
          />
          <button className="rounded border border-gray-600 px-3 text-sm">
            Save
          </button>
        </form>
      ) : (
        <h1 className="mb-6 mt-2 text-3xl font-bold">{data.page.title}</h1>
      )}

      <div className="mb-8">
        <Editor
          orgId={orgId}
          pageId={pageId}
          initialContent={data.page.content as never}
          editable={editable}
        />
      </div>

      <h2 className="mb-2 text-lg font-bold">Sub-pages</h2>
      <ul className="mb-4 flex flex-col gap-1">
        {data.children.length === 0 && (
          <li className="text-sm text-gray-500">None yet.</li>
        )}
        {data.children.map((c) => (
          <li key={c.id}>
            <Link href={`/w/${orgId}/p/${c.id}`} className="underline">
              {c.title}
            </Link>
          </li>
        ))}
      </ul>

      {editable && (
        <>
          <form action={createPage} className="mb-10 flex gap-2">
            <input type="hidden" name="orgId" value={orgId} />
            <input type="hidden" name="parentId" value={pageId} />
            <input
              name="title"
              placeholder="New sub-page title"
              className={`${input} flex-1`}
            />
            <button className="rounded bg-blue-600 px-4 text-white">Add</button>
          </form>

          <form action={deletePage}>
            <input type="hidden" name="orgId" value={orgId} />
            <input type="hidden" name="pageId" value={pageId} />
            <ConfirmButton
              title="Delete this page?"
              confirmLabel="Delete page"
              message="This permanently deletes the page and all of its sub-pages. This can't be undone."
              className="text-sm text-red-400 underline"
            >
              Delete page
            </ConfirmButton>
          </form>
        </>
      )}
    </main>
  );
}
