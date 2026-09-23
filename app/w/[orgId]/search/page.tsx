import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { withOrg } from "@/lib/db";
import { getRole, isUuid } from "@/lib/access";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

type Result = { id: string; title: string; snippet: string };

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { orgId } = await params;
  if (!isUuid(orgId)) notFound();
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const data = await withOrg(orgId, async (client) => {
    if (!(await getRole(client, session.userId))) return null;
    if (!query) return { results: [] as Result[] };

    const res = await client.query(
      `SELECT id, title,
              ts_headline('english', content_text, websearch_to_tsquery('english', $1),
                'MaxFragments=1, MaxWords=25, MinWords=10') AS snippet
       FROM pages
       WHERE search @@ websearch_to_tsquery('english', $1)
       ORDER BY ts_rank(search, websearch_to_tsquery('english', $1)) DESC
       LIMIT 20`,
      [query],
    );
    return { results: res.rows as Result[] };
  });

  if (!data) notFound();

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="mb-6 text-2xl font-bold">Search</h1>
      <form className="mb-6">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search this workspace"
          className="w-full rounded border border-gray-500 bg-white p-2 text-black placeholder-gray-500"
        />
      </form>

      {query && (
        <p className="mb-4 text-sm text-gray-500">
          {data.results.length} result{data.results.length === 1 ? "" : "s"} for
          “{query}”
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {data.results.map((r) => (
          <li key={r.id}>
            <Link
              href={`/w/${orgId}/p/${r.id}`}
              className="font-semibold text-blue-400 underline"
            >
              {r.title}
            </Link>
            <p
              className="text-sm text-gray-400 [&_b]:text-white"
              dangerouslySetInnerHTML={{ __html: r.snippet }}
            />
          </li>
        ))}
      </ul>
    </main>
  );
}
