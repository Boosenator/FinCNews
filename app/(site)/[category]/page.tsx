import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CategoryArchive, { CATEGORY_DESCRIPTIONS } from "./CategoryArchive";
import { BASE_URL } from "@/lib/config";
import { categories, categoryLabels, isCategory, type Category } from "@/lib/i18n";

type Props = { params: { category: string } };

export function generateStaticParams() {
  return categories.map((category) => ({ category }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isCategory(params.category)) return {};
  const cat = params.category as Category;
  const label = categoryLabels[cat];
  const description = CATEGORY_DESCRIPTIONS[cat] ?? `Latest ${label} news and analysis on FinCNews.`;

  return {
    title: `${label} News - Latest Updates & Analysis`,
    description,
    alternates: { canonical: `/${cat}` },
    openGraph: {
      title: `${label} News | FinCNews`,
      description,
      type: "website",
      url: `${BASE_URL}/${cat}`,
      siteName: "FinCNews",
      images: [{ url: `${BASE_URL}/opengraph-image`, width: 1200, height: 630, alt: `FinCNews ${label}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${label} News | FinCNews`,
      description,
      site: "@fincnews",
      images: [`${BASE_URL}/opengraph-image`],
    },
  };
}

export default function CategoryPage({ params }: Props) {
  if (!isCategory(params.category)) notFound();
  return <CategoryArchive category={params.category} />;
}
