import Link from "next/link";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { createWorkspace } from "./actions";
import { logout } from "./auth-actions";

export const dynamic = "force-dynamic";

type Workspace = { id: string; name: string; role: string };

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await pool.query("SELECT name FROM users WHERE id = $1", [
    session.userId,
  ]);
  const workspaces = (
    await pool.query("SELECT id, name, role FROM user_workspaces($1)", [
      session.userId,
    ])
  ).rows as Workspace[];

  return (
    <main className="mx-auto max-w-md p-8">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-gray-400">Logged in as {user.rows[0]?.name}</p>
        <form action={logout}>
          <button className="text-sm underline">Log out</button>
        </form>
      </div>

      <h2 className="mb-3 text-xl font-bold">Your workspaces</h2>
      <ul className="mb-8 flex flex-col gap-2">
        {workspaces.length === 0 && (
          <li className="text-gray-500">None yet. Create one below.</li>
        )}
        {workspaces.map((w) => (
          <li key={w.id}>
            <Link
              href={`/w/${w.id}`}
              className="block rounded border border-gray-600 p-2 hover:bg-gray-800"
            >
              {w.name} <span className="text-sm text-gray-500">({w.role})</span>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mb-3 text-xl font-bold">Create a workspace</h2>
      <form action={createWorkspace} className="flex flex-col gap-3">
        <input
          name="name"
          placeholder="Workspace name"
          required
          className="rounded border border-gray-500 bg-white p-2 text-black placeholder-gray-500"
        />
        <button className="rounded bg-blue-600 p-2 text-white">Create</button>
      </form>
    </main>
  );
}
