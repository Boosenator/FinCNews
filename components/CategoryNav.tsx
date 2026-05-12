import Link from "next/link";
import { categories, type Locale } from "@/lib/i18n";

const CATEGORY_ICONS: Record<string, string> = {
  finance: "📈",
  crypto: "₿",
  tech: "⚡",
  world: "🌍",
  ukraine: "🇺🇦",
  lifestyle: "✦",
  sport: "⚽",
  auto: "🚗",
  health: "💊",
};

type CategoryNavProps = {
  locale: Locale;
  labels: Record<string, string>;
  activeCategory?: string;
};

export default function CategoryNav({ locale, labels, activeCategory }: CategoryNavProps) {
  return (
    <nav
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
      aria-label="Category navigation"
    >
      <Link
        href={`/${locale}`}
        className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
          !activeCategory
            ? "border-cyan-400 bg-cyan-400 text-zinc-950"
            : "border-white/8 text-zinc-400 hover:border-white/20 hover:bg-white/[0.04] hover:text-zinc-200"
        }`}
      >
        {labels.all}
      </Link>
      {categories.map((category) => {
        const isActive = activeCategory === category;
        return (
          <Link
            key={category}
            href={`/${locale}/${category}`}
            className={`flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
              isActive
                ? "border-cyan-400 bg-cyan-400 text-zinc-950"
                : "border-white/8 text-zinc-400 hover:border-white/20 hover:bg-white/[0.04] hover:text-zinc-200"
            }`}
          >
            <span aria-hidden>{CATEGORY_ICONS[category]}</span>
            {labels[category] ?? category}
          </Link>
        );
      })}
    </nav>
  );
}
