export const locales = ["ua", "en", "ru", "pl"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ua";

export const localeLabels: Record<Locale, string> = {
  ua: "UA",
  en: "EN",
  ru: "RU",
  pl: "PL",
};

export const categories = [
  "tech",
  "finance",
  "crypto",
  "world",
  "ukraine",
  "lifestyle",
  "sport",
  "auto",
  "health",
] as const;

export type Category = (typeof categories)[number];

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function isCategory(value: string): value is Category {
  return categories.includes(value as Category);
}

export async function getMessages(locale: Locale) {
  switch (locale) {
    case "en":
      return (await import("@/messages/en.json")).default;
    case "ru":
      return (await import("@/messages/ru.json")).default;
    case "pl":
      return (await import("@/messages/pl.json")).default;
    case "ua":
    default:
      return (await import("@/messages/ua.json")).default;
  }
}
