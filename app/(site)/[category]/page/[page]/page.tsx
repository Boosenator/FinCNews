import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CategoryArchive, { CATEGORY_DESCRIPTIONS } from "../../CategoryArchive";
import { BASE_URL } from "@/lib/config";
import { categories, categoryLabels, isCategory, type Category } from "@/lib/i18n";

type Props = { params: { category: string; page: string } };

export function generateStaticParams() {
  return categories.map((category) => ({ category, page: "2" }));
}

function parsePage(value: string) {
  const page = Number(value);
  return Number.isInteger(page) && page > 1 ? page : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isCategory(params.category)) return {};
  const page = parsePage(params.page);
  if (!page) return {};

  const cat = params.category as Category;
  const label = categoryLabels[cat];
  const description = CATEGORY_DESCRIPTIONS[cat] ?? `Latest ${label} news and analysis on FinCNews.`;
  const url = `${BASE_URL}/${cat}/page/${page}`;

  return {
    title: `${label} News - Page ${page} | FinCNews`,
    description,
    alternates: {
      canonical: `/${cat}/page/${page}`,
      languages: { "en-US": `/${cat}/page/${page}` },
    },
    openGraph: {
      title: `${label} News - Page ${page} | FinCNews`,
      description,
      type: "website",
      url,
      siteName: "FinCNews",
      images: [{ url: `${BASE_URL}/opengraph-image`, width: 1200, height: 630, alt: `FinCNews ${label}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${label} News - Page ${page} | FinCNews`,
      description,
      site: "@fincnews",
      images: [`${BASE_URL}/opengraph-image`],
    },
  };
}

export default function CategoryArchivePage({ params }: Props) {
  if (!isCategory(params.category)) notFound();
  const page = parsePage(params.page);
  if (!page) notFound();

  return <CategoryArchive category={params.category} page={page} />;
}
