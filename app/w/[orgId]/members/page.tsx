import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { withOrg } from "@/lib/db";
import { getRole } from "@/lib/access";
import { getSession } from "@/lib/session";
import { addMember, removeMember, changeRole } from "@/app/member-actions";
import ConfirmButton from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Member = { id: string; name: string; email: string; role: string };

export default async function MembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { orgId } = await params;
  const { error } = await searchParams;
  if (!UUID.test(orgId)) notFound();

  const data = await withOrg(orgId, async (client) => {
    const role = await getRole(client, session.userId);
    if (!role) return null;
    const res = await client.query(
      `SELECT u.id, u.name, u.email, m.role
       FROM memberships m JOIN users u ON u.id = m.user_id
       ORDER BY (m.role <> 'owner'), u.name`,
    );
    return { role, members: res.rows as Member[] };
  });

  if (!data) notFound();
  const isOwner = data.role === "owner";

  return (
    <main className="mx-auto max-w-xl p-8">
      <Link href={`/w/${orgId}`} className="text-sm text-gray-400 underline">
        ← Back to workspace
      </Link>
      <h1 className="mb-6 mt-3 text-2xl font-bold">Members</h1>

      {error && (
        <p className="mb-4 rounded border border-red-500 p-2 text-red-400">
          {error}
        </p>
      )}

      <ul className="mb-8 flex flex-col gap-2">
        {data.members.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between rounded border border-gray-600 p-2"
          >
            <span>
              {m.name} <span className="text-sm text-gray-500">{m.email}</span>{" "}
              <span className="text-sm text-gray-400">({m.role})</span>
            </span>
            {isOwner && m.role !== "owner" && (
              <div className="flex items-center gap-3">
                <form action={changeRole} className="flex items-center gap-1">
                  <input type="hidden" name="orgId" value={orgId} />
                  <input type="hidden" name="userId" value={m.id} />
                  <select
                    name="role"
                    defaultValue={m.role}
                    className="rounded border border-gray-500 bg-white p-1 text-sm text-black"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button className="text-sm underline">Save</button>
                </form>
                <form action={removeMember}>
                  <input type="hidden" name="orgId" value={orgId} />
                  <input type="hidden" name="userId" value={m.id} />
                  <ConfirmButton
                    title="Remove member?"
                    confirmLabel="Remove member"
                    message={`Remove ${m.name} from this workspace? They will lose access immediately.`}
                    className="text-sm text-red-400 underline"
                  >
                    Remove
                  </ConfirmButton>
                </form>
              </div>
            )}
          </li>
        ))}
      </ul>

      {isOwner ? (
        <>
          <h2 className="mb-3 text-xl font-bold">Add a member</h2>
          <form action={addMember} className="flex flex-col gap-3">
            <input type="hidden" name="orgId" value={orgId} />
            <input
              name="email"
              type="email"
              placeholder="Their email (must have an account)"
              required
              className="rounded border border-gray-500 bg-white p-2 text-black placeholder-gray-500"
            />
            <select
              name="role"
              className="rounded border border-gray-500 bg-white p-2 text-black"
            >
              <option value="editor">Editor (can post and edit)</option>
              <option value="viewer">Viewer (read only)</option>
            </select>
            <button className="rounded bg-blue-600 p-2 text-white">Add</button>
          </form>
        </>
      ) : (
        <p className="text-sm text-gray-500">
          Only owners can add or remove members.
        </p>
      )}
    </main>
  );
}
