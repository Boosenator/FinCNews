import createMiddleware from "next-intl/middleware";

export default createMiddleware({
  locales: ["ua", "en", "ru", "pl"],
  defaultLocale: "ua",
  localePrefix: "always",
});

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
