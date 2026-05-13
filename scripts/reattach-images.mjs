import { createClient } from "@sanity/client";
import https from "https";
import http from "http";

const PEXELS_KEY = process.env.PEXELS_API_KEY;
const SANITY_TOKEN = process.env.SANITY_TOKEN;
const PROJECT_ID = process.env.SANITY_PROJECT_ID ?? process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;

if (!PEXELS_KEY) { console.error("Missing PEXELS_API_KEY"); process.exit(1); }
if (!SANITY_TOKEN) { console.error("Missing SANITY_TOKEN"); process.exit(1); }

const sanity = createClient({
  projectId: PROJECT_ID,
  dataset: "production",
  token: SANITY_TOKEN,
  apiVersion: "2024-01-01",
  useCdn: false,
});

const STOP_WORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with","as",
  "is","was","are","were","has","have","will","would","after","before","than",
  "that","this","from","into","over","just","its","their","our","amid","says",
  "back","new","via","per","how","why","what","when","where","signs","full",
  "returns","amid","boom","surge","record","latest","breaks","hits","drops",
]);

function buildQuery(category, tags, title) {
  if (tags && tags.length > 0) {
    const meaningful = tags
      .map(t => t.replace(/-/g, " ").toLowerCase())
      .filter(t => t.length > 3 && !STOP_WORDS.has(t))
      .slice(0, 2);
    if (meaningful.length > 0) return `${meaningful.join(" ")} finance`;
  }
  if (title) {
    const words = title.split(/\W+/)
      .map(w => w.toLowerCase())
      .filter(w => w.length > 4 && !STOP_WORDS.has(w));
    if (words.length >= 2) return words.slice(0, 3).join(" ");
  }
  const map = {
    crypto: "cryptocurrency digital assets",
    markets: "stock market trading finance",
    economy: "central bank federal reserve economy",
    fintech: "fintech payment technology",
    policy: "law regulation government",
    companies: "corporate office business",
  };
  return map[category] ?? "finance business";
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const opts = { headers: { "User-Agent": "FinCNews/1.0" } };
    lib.get(url, opts, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchBuffer(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve({ buffer: Buffer.concat(chunks), type: res.headers["content-type"] }));
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function getPexelsPhoto(query) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`;
  const { buffer } = await fetchBuffer(url + "|HEADER:Authorization:" + PEXELS_KEY);

  // Use fetch directly for Pexels (needs Authorization header)
  const res = await fetch(url, { headers: { Authorization: PEXELS_KEY } });
  if (!res.ok) return null;
  const { photos } = await res.json();
  if (!photos?.length) return null;
  const idx = Math.floor(Math.random() * Math.min(photos.length, 10));
  return photos[idx]?.src?.large2x ?? null;
}

async function run() {
  // Get all articles — reattach all, not just missing ones
  const articles = await sanity.fetch(
    `*[_type == "article" && defined(translations.en.title)] | order(publishedAt desc)[0...50] {
      _id,
      "slug": slug.current,
      category,
      tags,
      "title": translations.en.title
    }`,
  );

  console.log(`Found ${articles.length} articles. Reattaching images...\n`);

  let ok = 0, fail = 0;

  for (const article of articles) {
    const query = buildQuery(article.category, article.tags, article.title);
    process.stdout.write(`[${article.category}] ${(article.title ?? "").slice(0, 50)}...\n  Query: "${query}" → `);

    try {
      const photoUrl = await getPexelsPhoto(query);
      if (!photoUrl) { console.log("✗ no photo"); fail++; continue; }

      const { buffer, type } = await fetchBuffer(photoUrl);
      const asset = await sanity.assets.upload("image", buffer, {
        filename: `${article.slug}.jpg`,
        contentType: type ?? "image/jpeg",
      });
      await sanity.patch(article._id).set({
        coverImage: { _type: "image", asset: { _type: "reference", _ref: asset._id } },
      }).commit();

      console.log(`✓ attached`);
      ok++;
    } catch (e) {
      console.log(`✗ ${e.message}`);
      fail++;
    }

    // Small delay to respect Pexels rate limit
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\nDone: ${ok} attached, ${fail} failed`);
}

run();
