import { createClient } from "@sanity/client";
import https from "https";
import http from "http";

const sanity = createClient({
  projectId: "x55aaanw",
  dataset: "production",
  token: process.env.SANITY_TOKEN,
  apiVersion: "2024-01-01",
  useCdn: false,
});

// Unsplash photo IDs curated per topic (no API key needed)
const ARTICLE_IMAGES = [
  {
    slug: "ethereum-pectra-upgrade-live-2026",
    keywords: "ethereum,blockchain,cryptocurrency",
    photoId: "1621504450829-5d98e95a5ea1", // Ethereum/crypto
  },
  {
    slug: "sp500-record-high-ai-rally-2026",
    keywords: "stock,market,trading,charts",
    photoId: "1611974789855-9c2a0a7236a3", // Stock market charts
  },
  {
    slug: "gold-hits-3200-safe-haven-demand-2026",
    keywords: "gold,bars,precious,metal",
    photoId: "1610375461246-83df859d849d", // Gold bars
  },
  {
    slug: "fed-holds-rates-powell-signals-cut-2026",
    keywords: "federal,reserve,washington,economy",
    photoId: "1559526324-593bc073d938", // Government building / economy
  },
  {
    slug: "us-inflation-cpi-april-2026",
    keywords: "inflation,economy,prices,market",
    photoId: "1579621970588-a35d0e7ab9b6", // Economy/finance abstract
  },
  {
    slug: "stripe-stablecoin-payments-launch-2026",
    keywords: "payment,mobile,fintech,app",
    photoId: "1563013544-824ae1b704d3", // Mobile payment
  },
  {
    slug: "revolut-banking-license-us-2026",
    keywords: "banking,fintech,mobile,app",
    photoId: "1520333789090-1afc82db536a", // Banking/fintech
  },
  {
    slug: "sec-crypto-broker-dealer-rules-2026",
    keywords: "regulation,law,government,sec",
    photoId: "1589829545856-d10d557cf95f", // Law/regulation
  },
  {
    slug: "nvidia-earnings-record-ai-chips-2026",
    keywords: "nvidia,chip,gpu,technology,semiconductor",
    photoId: "1591405351951-4983fba83fdf", // Semiconductor/chip
  },
  {
    slug: "solana-defi-tvl-record-2026",
    keywords: "solana,defi,blockchain,crypto",
    photoId: "1642104704074-907c0698cbd9", // Crypto/blockchain abstract
  },
];

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchBuffer(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers["content-type"] }));
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function run() {
  for (const item of ARTICLE_IMAGES) {
    process.stdout.write(`Processing ${item.slug}... `);

    try {
      // 1. Fetch image from Unsplash
      const url = `https://images.unsplash.com/photo-${item.photoId}?w=1200&h=630&fit=crop&q=80`;
      const { buffer, contentType } = await fetchBuffer(url);

      // 2. Upload to Sanity assets
      const asset = await sanity.assets.upload("image", buffer, {
        filename: `${item.slug}.jpg`,
        contentType: contentType || "image/jpeg",
        source: {
          id: item.photoId,
          name: "unsplash",
          url: `https://unsplash.com/photos/${item.photoId}`,
        },
      });

      // 3. Find article in Sanity by slug
      const article = await sanity.fetch(
        `*[_type == "article" && slug.current == $slug][0]{ _id }`,
        { slug: item.slug }
      );

      if (!article) {
        console.log(`✗ Article not found`);
        continue;
      }

      // 4. Patch article with image reference
      await sanity
        .patch(article._id)
        .set({
          coverImage: {
            _type: "image",
            asset: { _type: "reference", _ref: asset._id },
          },
        })
        .commit();

      console.log(`✓ Uploaded & linked`);
    } catch (err) {
      console.log(`✗ ${err.message}`);
    }
  }

  console.log("\nDone.");
}

run();
