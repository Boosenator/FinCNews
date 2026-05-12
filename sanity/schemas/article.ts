export default {
  name: "article",
  title: "Article",
  type: "document",
  fields: [
    {
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "translations.en.title" },
      validation: (R: { required: () => unknown }) => R.required(),
    },
    {
      name: "category",
      title: "Category",
      type: "string",
      options: {
        list: [
          { title: "Crypto", value: "crypto" },
          { title: "Markets", value: "markets" },
          { title: "Economy", value: "economy" },
          { title: "Fintech", value: "fintech" },
          { title: "Policy", value: "policy" },
          { title: "Companies", value: "companies" },
        ],
      },
      validation: (R: { required: () => unknown }) => R.required(),
    },
    { name: "publishedAt", title: "Published at", type: "datetime" },
    { name: "sourceUrl", title: "Source URL", type: "url" },
    {
      name: "translations",
      title: "Content",
      type: "object",
      fields: [
        {
          name: "en",
          title: "English",
          type: "object",
          fields: [
            { name: "title", title: "Title", type: "string" },
            { name: "excerpt", title: "Excerpt", type: "text", rows: 3 },
            { name: "body", title: "Body", type: "array", of: [{ type: "block" }] },
            { name: "metaTitle", title: "Meta title", type: "string" },
            { name: "metaDescription", title: "Meta description", type: "text", rows: 2 },
            { name: "telegramText", title: "Telegram post", type: "text", rows: 4 },
          ],
        },
      ],
    },
    { name: "coverImage", title: "Cover image", type: "image", options: { hotspot: true } },
    { name: "tags", title: "Tags", type: "array", of: [{ type: "string" }] },
  ],
  preview: {
    select: { title: "translations.en.title", category: "category", media: "coverImage" },
    prepare({ title, category, media }: { title?: string; category?: string; media?: unknown }) {
      return { title: title ?? "Untitled", subtitle: category, media };
    },
  },
};
