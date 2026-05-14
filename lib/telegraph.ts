// Telegraph API integration
// Docs: https://telegra.ph/api

type TelegraphNode =
  | string
  | { tag: string; attrs?: Record<string, string>; children?: TelegraphNode[] };

type TelegraphPage = {
  url: string;
  path: string;
  title: string;
};

function buildContent(
  title: string,
  excerpt: string,
  bodyPreview: string,
  siteUrl: string,
  category: string,
): TelegraphNode[] {
  // Extract first 2-3 meaningful sentences from body
  const sentences = bodyPreview
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.length > 40)
    .slice(0, 3)
    .join(" ");

  return [
    // Brief intro — unique, not a copy of the article
    { tag: "p", children: [excerpt] },

    // Key context from body
    ...(sentences
      ? [{ tag: "p", children: [sentences] }]
      : []),

    // Divider
    { tag: "p", children: ["—"] },

    // CTA back to site (the backlink)
    {
      tag: "p",
      children: [
        "Full analysis and market implications: ",
        {
          tag: "a",
          attrs: { href: siteUrl },
          children: [`FinCNews — ${title}`],
        },
      ],
    },

    // Category tag
    {
      tag: "p",
      children: [
        {
          tag: "a",
          attrs: { href: `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://fin-c-news.vercel.app"}/${category}` },
          children: [`#${category}`],
        },
        " #FinCNews #finance",
      ],
    },
  ];
}

export async function createTelegraphPage(opts: {
  title: string;
  excerpt: string;
  bodyPreview: string;
  siteUrl: string;
  category: string;
}): Promise<TelegraphPage | null> {
  const token = process.env.TELEGRAPH_TOKEN;
  if (!token) return null;

  const content = buildContent(
    opts.title,
    opts.excerpt,
    opts.bodyPreview,
    opts.siteUrl,
    opts.category,
  );

  try {
    const res = await fetch("https://api.telegra.ph/createPage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: token,
        title: opts.title.slice(0, 256), // Telegraph title limit
        author_name: "FinCNews",
        author_url: process.env.NEXT_PUBLIC_BASE_URL ?? "https://fin-c-news.vercel.app",
        content,
        return_content: false,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data.ok) return null;

    return {
      url: data.result.url,
      path: data.result.path,
      title: data.result.title,
    };
  } catch {
    return null;
  }
}
