export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://finc.news";
export const TELEGRAM_CHANNEL_URL =
  process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL ??
  process.env.TELEGRAM_CHANNEL_URL ??
  "https://t.me/FinCNews";
export const TELEGRAM_CHANNEL_LABEL = process.env.TELEGRAM_CHANNEL_LABEL ?? "@FinCNews";

export const EMAIL_FROM_TECH = "FinCNews <tech@e.finc.news>";
export const EMAIL_FROM_NEWS = "FinCNews Digest <news@e.finc.news>";
export const EMAIL_REPLY_TO = "editorial@e.finc.news";
