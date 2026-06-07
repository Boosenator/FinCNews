import { BASE_URL, TELEGRAM_CHANNEL_LABEL, TELEGRAM_CHANNEL_URL } from "@/lib/config";

export type TelegraphNode =
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
  authorName?: string,
  authorId?: string,
): TelegraphNode[] {
  const sentences = bodyPreview
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.length > 40)
    .slice(0, 3)
    .join(" ");

  const authorUrl = authorId ? `${BASE_URL}/author/${authorId}` : null;

  return [
    { tag: "p", children: [excerpt] },

    ...(sentences ? [{ tag: "p", children: [sentences] }] : []),

    { tag: "p", children: ["—"] },

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

    // Author link
    ...(authorName && authorUrl
      ? [{
          tag: "p",
          children: [
            "By ",
            {
              tag: "a",
              attrs: { href: authorUrl },
              children: [authorName],
            },
          ],
        }]
      : []),

    {
      tag: "p",
      children: [
        "For real-time finance and crypto alerts, follow us on Telegram: ",
        {
          tag: "a",
          attrs: { href: TELEGRAM_CHANNEL_URL },
          children: [TELEGRAM_CHANNEL_LABEL],
        },
      ],
    },

    {
      tag: "p",
      children: [
        {
          tag: "a",
          attrs: { href: `${BASE_URL}/${category}` },
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
  authorName?: string;
  authorId?: string;
}): Promise<TelegraphPage | null> {
  const token = process.env.TELEGRAPH_TOKEN;
  if (!token) return null;

  const content = buildContent(
    opts.title,
    opts.excerpt,
    opts.bodyPreview,
    opts.siteUrl,
    opts.category,
    opts.authorName,
    opts.authorId,
  );

  try {
    const res = await fetch("https://api.telegra.ph/createPage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: token,
        title: opts.title.slice(0, 256), // Telegraph title limit
        author_name: "FinCNews",
        author_url: BASE_URL,
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
