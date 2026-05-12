import Link from "next/link";
import { categories, type Locale } from "@/lib/i18n";

type CategoryNavProps = {
  locale: Locale;
  labels: Record<string, string>;
  activeCategory?: string;
};

export default function CategoryNav({ locale, labels, activeCategory }: CategoryNavProps) {
  return (
    <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
      <Link
        href={`/${locale}`}
        className={`shrink-0 rounded-md border px-3 py-2 text-sm font-medium ${
          !activeCategory
            ? "border-cyan-300 bg-cyan-300 text-zinc-950"
            : "border-white/10 text-zinc-300 hover:border-white/25 hover:bg-white/[0.04]"
        }`}
      >
        {labels.all}
      </Link>
      {categories.map((category) => (
        <Link
          key={category}
          href={`/${locale}/${category}`}
          className={`shrink-0 rounded-md border px-3 py-2 text-sm font-medium ${
            activeCategory === category
              ? "border-cyan-300 bg-cyan-300 text-zinc-950"
              : "border-white/10 text-zinc-300 hover:border-white/25 hover:bg-white/[0.04]"
          }`}
        >
          {labels[category] ?? category}
        </Link>
      ))}
    </nav>
  );
}
