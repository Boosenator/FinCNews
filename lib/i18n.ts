export const categories = [
  "crypto",
  "markets",
  "economy",
  "fintech",
  "policy",
  "companies",
] as const;

export type Category = (typeof categories)[number];

export const categoryLabels: Record<Category, string> = {
  crypto: "Crypto",
  markets: "Markets",
  economy: "Economy",
  fintech: "Fintech",
  policy: "Policy",
  companies: "Companies",
};

export const categoryIcons: Record<Category, string> = {
  crypto: "₿",
  markets: "📈",
  economy: "🏦",
  fintech: "⚡",
  policy: "⚖️",
  companies: "🏢",
};

export function isCategory(value: string): value is Category {
  return categories.includes(value as Category);
}
