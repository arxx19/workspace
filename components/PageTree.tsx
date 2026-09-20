import Link from "next/link";

export type PageNode = { id: string; title: string; parent_id: string | null };

type ByParent = Map<string | null, PageNode[]>;

function Branch({
  parentId,
  byParent,
  orgId,
  depth,
}: {
  parentId: string | null;
  byParent: ByParent;
  orgId: string;
  depth: number;
}) {
  const items = byParent.get(parentId);
  if (!items) return null;

  return (
    <ul className={depth === 0 ? "" : "ml-3 border-l border-gray-700 pl-2"}>
      {items.map((p) => (
        <li key={p.id}>
          <Link
            href={`/w/${orgId}/p/${p.id}`}
            className="block truncate rounded px-2 py-1 text-sm text-gray-300 hover:bg-gray-800"
          >
            {p.title}
          </Link>
          <Branch
            parentId={p.id}
            byParent={byParent}
            orgId={orgId}
            depth={depth + 1}
          />
        </li>
      ))}
    </ul>
  );
}

export default function PageTree({
  orgId,
  pages,
}: {
  orgId: string;
  pages: PageNode[];
}) {
  const byParent: ByParent = new Map();
  for (const p of pages) {
    const list = byParent.get(p.parent_id) ?? [];
    list.push(p);
    byParent.set(p.parent_id, list);
  }

  if (pages.length === 0) {
    return <p className="px-2 text-sm text-gray-500">No pages yet.</p>;
  }
  return <Branch parentId={null} byParent={byParent} orgId={orgId} depth={0} />;
}
