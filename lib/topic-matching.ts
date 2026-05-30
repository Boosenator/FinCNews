export function normalizeTopicKeywords(keywords: string[]): string[] {
  return keywords
    .map((kw) => kw.trim().toLowerCase())
    .filter((kw) => kw.length > 1)
    .filter((kw, index, arr) => arr.indexOf(kw) === index)
    .slice(0, 12);
}

export function buildTopicArticleFilter(keywords: string[]) {
  const normalized = normalizeTopicKeywords(keywords);
  const params: Record<string, string> = {};
  const clauses = normalized.map((kw, i) => {
    const key = `kw${i}`;
    const exact = `exact${i}`;
    params[key] = `${kw}*`;
    params[exact] = kw;
    return [
      `translations.en.title match $${key}`,
      `translations.en.excerpt match $${key}`,
      `$${exact} in tags[]`,
    ].join(" || ");
  });

  return {
    filter: clauses.length ? clauses.map((clause) => `(${clause})`).join(" || ") : "false",
    params,
  };
}
