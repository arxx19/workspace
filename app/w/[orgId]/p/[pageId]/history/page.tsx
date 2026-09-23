import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { withOrg } from "@/lib/db";
import { getRole, canEdit, isUuid } from "@/lib/access";
import { getSession } from "@/lib/session";
import { listVersions, restoreVersion } from "@/app/page-actions";
import ConfirmButton from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ orgId: string; pageId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { orgId, pageId } = await params;
  if (!isUuid(orgId) || !isUuid(pageId)) notFound();

  const role = await withOrg(orgId, (client) =>
    getRole(client, session.userId),
  );
  if (!role) notFound();

  const versions = await listVersions(orgId, pageId);
  const editable = canEdit(role);

  return (
    <main className="mx-auto max-w-xl p-8">
      <Link
        href={`/w/${orgId}/p/${pageId}`}
        className="text-sm text-gray-400 underline"
      >
        ← Back to page
      </Link>
      <h1 className="mb-6 mt-3 text-2xl font-bold">Version history</h1>

      <ul className="flex flex-col gap-2">
        {versions.length === 0 && (
          <li className="text-sm text-gray-500">No saved versions yet.</li>
        )}
        {versions.map((v, i) => (
          <li
            key={v.id}
            className="flex items-center justify-between rounded border border-gray-600 p-2"
          >
            <span className="text-sm">
              <span className="font-semibold">{v.title}</span>{" "}
              <span className="text-gray-500">
                — {v.author}, {new Date(v.created_at).toLocaleString()}
                {i === 0 && " (latest)"}
              </span>
            </span>
            {editable && i !== 0 && (
              <form action={restoreVersion}>
                <input type="hidden" name="orgId" value={orgId} />
                <input type="hidden" name="pageId" value={pageId} />
                <input type="hidden" name="versionId" value={v.id} />
                <ConfirmButton
                  title="Restore this version?"
                  confirmLabel="Restore"
                  message="This replaces the current content with this older version. The current content is kept as a version too, so you can undo this."
                  className="text-sm text-blue-400 underline"
                >
                  Restore
                </ConfirmButton>
              </form>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
