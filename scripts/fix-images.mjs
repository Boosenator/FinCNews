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

const FIX = [
  { slug: "ethereum-pectra-upgrade-live-2026", photoId: "1639762681057-074b7f938ba0" },
  { slug: "nvidia-earnings-record-ai-chips-2026", photoId: "1558618666-fcd25c85cd64" },
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
  for (const item of FIX) {
    process.stdout.write(`${item.slug}... `);
    try {
      const url = `https://images.unsplash.com/photo-${item.photoId}?w=1200&h=630&fit=crop&q=80`;
      const { buffer, contentType } = await fetchBuffer(url);
      const asset = await sanity.assets.upload("image", buffer, {
        filename: `${item.slug}.jpg`,
        contentType: contentType || "image/jpeg",
      });
      const article = await sanity.fetch(`*[_type == "article" && slug.current == $slug][0]{ _id }`, { slug: item.slug });
      if (!article) { console.log("✗ not found"); continue; }
      await sanity.patch(article._id).set({ coverImage: { _type: "image", asset: { _type: "reference", _ref: asset._id } } }).commit();
      console.log("✓");
    } catch (e) {
      console.log(`✗ ${e.message}`);
    }
  }
}

run();
