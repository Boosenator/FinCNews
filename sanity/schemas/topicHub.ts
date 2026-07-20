export default {
  name: "topicHub",
  title: "Topic Hub",
  type: "document",
  fields: [
    {
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title" },
      validation: (R: { required: () => unknown }) => R.required(),
    },
    { name: "title", title: "Title", type: "string", validation: (R: { required: () => unknown }) => R.required() },
    { name: "description", title: "Description", type: "text", rows: 3 },
    { name: "updatedAt", title: "Updated at", type: "datetime" },
    { name: "keywords", title: "Keywords", type: "array", of: [{ type: "string" }] },
    {
      name: "body",
      title: "Body",
      type: "array",
      of: [{ type: "block" }],
    },
    {
      name: "faqs",
      title: "FAQs",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            { name: "question", title: "Question", type: "string" },
            { name: "answer", title: "Answer", type: "text", rows: 3 },
          ],
        },
      ],
    },
  ],
  preview: {
    select: { title: "title", subtitle: "updatedAt" },
  },
};
