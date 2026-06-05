import fs from "fs";
import path from "path";
import { createClient } from "@sanity/client";

const DEFAULT_CHANNEL_URL = "https://t.me/FinCNews";
const DEFAULT_CHANNEL_LABEL = "@FinCNews";
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_DELAY_MS = 2500;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

function argValue(name, fallback = undefined) {
  const prefix = `${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function telegraphPathFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\/+/, "");
  } catch {
    return url.replace("https://telegra.ph/", "").split("?")[0];
  }
}

function hasTelegramChannelLink(nodes, channelUrl) {
  return nodes.some((node) => {
    if (typeof node === "string") return node.includes(channelUrl);
    if (node?.attrs?.href === channelUrl) return true;
    return node?.children ? hasTelegramChannelLink(node.children, channelUrl) : false;
  });
}

function telegramCtaNode(channelUrl, channelLabel) {
  return {
    tag: "p",
    children: [
      "For real-time finance and crypto alerts, follow us on Telegram: ",
      {
        tag: "a",
        attrs: { href: channelUrl },
        children: [channelLabel],
      },
    ],
  };
}

async function fetchTelegraphPage(pagePath) {
  const url = `https://api.telegra.ph/getPage?path=${encodeURIComponent(pagePath)}&return_content=true`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`getPage HTTP ${res.status}`);

  const data = await res.json();
  if (!data.ok) throw new Error(`getPage error: ${data.error}`);

  return data.result;
}

async function editTelegraphPage({ token, pagePath, title, content }) {
  const res = await fetch("https://api.telegra.ph/editPage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: token,
      path: pagePath,
      title: title.slice(0, 256),
      author_name: "FinCNews",
      author_url: process.env.NEXT_PUBLIC_BASE_URL ?? "https://finc.news",
      content,
      return_content: false,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`editPage HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(`editPage error: ${data.error}`);
}

async function main() {
  loadEnvFile(path.resolve(".env.local"));
  loadEnvFile(path.resolve(".env.prod"));

  const apply = process.argv.includes("--apply");
  const limit = Number(argValue("--limit", DEFAULT_BATCH_SIZE));
  const offset = Number(argValue("--offset", 0));
  const delayMs = Number(argValue("--delay", DEFAULT_DELAY_MS));
  const channelUrl =
    process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL ??
    process.env.TELEGRAM_CHANNEL_URL ??
    DEFAULT_CHANNEL_URL;
  const channelLabel = process.env.TELEGRAM_CHANNEL_LABEL ?? DEFAULT_CHANNEL_LABEL;
  const telegraphToken = process.env.TELEGRAPH_TOKEN;

  if (apply && !telegraphToken) {
    console.error("Missing TELEGRAPH_TOKEN. Add it to env or run without --apply for dry-run.");
    process.exit(1);
  }

  const sanity = createClient({
    projectId:
      process.env.SANITY_PROJECT_ID ??
      process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ??
      "x55aaanw",
    dataset:
      process.env.SANITY_DATASET ??
      process.env.NEXT_PUBLIC_SANITY_DATASET ??
      "production",
    token: process.env.SANITY_TOKEN,
    apiVersion: "2024-01-01",
    useCdn: false,
  });

  const [articles, total] = await Promise.all([
    sanity.fetch(
      `*[_type == "article" && defined(telegraphUrl)] | order(_createdAt asc)[$offset...$end] {
        telegraphUrl,
        "title": translations.en.title
      }`,
      { offset, end: offset + limit },
    ),
    sanity.fetch(`count(*[_type == "article" && defined(telegraphUrl)])`),
  ]);

  console.log(`${apply ? "Apply" : "Dry-run"} mode`);
  console.log(`Telegram CTA: ${channelLabel} -> ${channelUrl}`);
  console.log(`Batch: ${articles.length}/${total} articles, offset=${offset}, limit=${limit}`);

  const results = [];

  for (let i = 0; i < articles.length; i += 1) {
    const article = articles[i];
    const pagePath = telegraphPathFromUrl(article.telegraphUrl);

    try {
      const page = await fetchTelegraphPage(pagePath);
      const content = page.content ?? [];

      if (hasTelegramChannelLink(content, channelUrl)) {
        results.push({ pagePath, status: "skipped" });
        console.log(`[skip] ${pagePath}`);
      } else {
        const patched = [...content, telegramCtaNode(channelUrl, channelLabel)];

        if (apply) {
          await editTelegraphPage({
            token: telegraphToken,
            pagePath,
            title: article.title ?? page.title ?? pagePath,
            content: patched,
          });
        }

        results.push({ pagePath, status: apply ? "updated" : "would_update" });
        console.log(`[${apply ? "updated" : "would update"}] ${pagePath}`);
      }
    } catch (error) {
      results.push({ pagePath, status: "error", error: String(error) });
      console.log(`[error] ${pagePath}: ${error}`);
    }

    if (i < articles.length - 1 && delayMs > 0) await sleep(delayMs);
  }

  const summary = results.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  const nextOffset = offset + limit < total ? offset + limit : null;
  console.log("Summary:", summary);
  if (nextOffset !== null) {
    console.log(`Next batch: node scripts/add-telegram-link-to-telegraph.mjs --offset=${nextOffset} --limit=${limit}${apply ? " --apply" : ""}`);
  } else {
    console.log("Done.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
