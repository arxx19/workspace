import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { withOrg } from "@/lib/db";
import { getRole, canEdit } from "@/lib/access";
import { getSession } from "@/lib/session";
import { postMessage } from "@/app/actions";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Message = { id: string; body: string; author: string };

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { orgId } = await params;
  if (!UUID.test(orgId)) notFound();

  const data = await withOrg(orgId, async (client) => {
    const role = await getRole(client, session.userId);
    if (!role) return null;

    const org = await client.query("SELECT name FROM organizations");
    const msgs = await client.query(
      `SELECT m.id, m.body, u.name AS author
       FROM messages m JOIN users u ON u.id = m.user_id
       ORDER BY m.created_at ASC`,
    );
    return {
      role,
      orgName: org.rows[0]?.name as string,
      messages: msgs.rows as Message[],
    };
  });

  if (!data) notFound();

  return (
    <main className="mx-auto max-w-xl p-8">
      <div className="flex items-center justify-between text-sm text-gray-400">
        <Link href="/" className="underline">
          ← All workspaces
        </Link>
        <Link href={`/w/${orgId}/members`} className="underline">
          Members
        </Link>
      </div>
      <h1 className="mb-1 mt-3 text-2xl font-bold">{data.orgName}</h1>
      <p className="mb-6 text-sm text-gray-500">
        # general · you are{" "}
        {data.role === "editor"
          ? "an editor"
          : `a${data.role === "owner" ? "n owner" : " viewer"}`}
      </p>

      <ul className="mb-6 flex flex-col gap-2">
        {data.messages.length === 0 && (
          <li className="text-gray-500">No messages yet.</li>
        )}
        {data.messages.map((m) => (
          <li key={m.id} className="rounded border border-gray-600 p-2">
            <span className="font-semibold">{m.author}: </span>
            {m.body}
          </li>
        ))}
      </ul>

      {canEdit(data.role) ? (
        <form action={postMessage} className="flex gap-2">
          <input type="hidden" name="orgId" value={orgId} />
          <input
            name="body"
            placeholder="Write a message"
            required
            className="flex-1 rounded border border-gray-500 bg-white p-2 text-black placeholder-gray-500"
          />
          <button className="rounded bg-blue-600 px-4 text-white">Send</button>
        </form>
      ) : (
        <p className="text-sm text-gray-500">You have view-only access.</p>
      )}
    </main>
  );
}
