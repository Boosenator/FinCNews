export const PRODUCTION_HOSTS = new Set(["finc.news", "www.finc.news"]);

export function normalizeHost(host: string | null): string {
  return (host ?? "").split(":")[0].toLowerCase();
}

export function isProductionHost(host: string | null): boolean {
  return PRODUCTION_HOSTS.has(normalizeHost(host));
}
