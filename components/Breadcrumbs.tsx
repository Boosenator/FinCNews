import Link from "next/link";

type Crumb = {
  label: string;
  href?: string;
};

export default function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-zinc-500">
        {crumbs.map((crumb, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden>/</span>}
            {crumb.href ? (
              <Link href={crumb.href} className="transition hover:text-zinc-300">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-zinc-400">{crumb.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
