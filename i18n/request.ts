import { getRequestConfig } from "next-intl/server";
import { defaultLocale, getMessages, isLocale } from "@/lib/i18n";

export default getRequestConfig(async ({ locale, requestLocale }) => {
  const requestedLocale = locale ?? (await requestLocale);
  const safeLocale = requestedLocale && isLocale(requestedLocale) ? requestedLocale : defaultLocale;

  return {
    locale: safeLocale,
    messages: await getMessages(safeLocale),
  };
});
