const languages = ["ua", "en", "ru", "pl"];

export default {
  name: "article",
  title: "Article",
  type: "document",
  fields: [
    { name: "slug", title: "Slug", type: "slug", options: { source: "translations.en.title" } },
    {
      name: "category",
      title: "Category",
      type: "string",
      options: {
        list: ["tech", "finance", "crypto", "world", "ukraine", "lifestyle", "sport", "auto", "health"],
      },
    },
    { name: "publishedAt", title: "Published at", type: "datetime" },
    { name: "sourceUrl", title: "Source URL", type: "url" },
    {
      name: "translations",
      title: "Translations",
      type: "object",
      fields: languages.map((lang) => ({
        name: lang,
        title: lang.toUpperCase(),
        type: "object",
        fields: [
          { name: "title", title: "Title", type: "string" },
          { name: "excerpt", title: "Excerpt", type: "text" },
          { name: "body", title: "Body", type: "array", of: [{ type: "block" }] },
          { name: "metaTitle", title: "Meta title", type: "string" },
          { name: "metaDescription", title: "Meta description", type: "text" },
          { name: "telegramText", title: "Telegram text", type: "text" },
        ],
      })),
    },
    { name: "coverImage", title: "Cover image", type: "image", options: { hotspot: true } },
    { name: "tags", title: "Tags", type: "array", of: [{ type: "string" }] },
  ],
};
