import { ImageResponse } from "next/og";
import { getArticle } from "@/lib/sanity";
import { isCategory, categoryLabels, type Category } from "@/lib/i18n";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CATEGORY_EMOJI: Record<string, string> = {
  crypto: "₿", markets: "📈", economy: "🏦",
  fintech: "⚡", policy: "⚖️", companies: "🏢",
};

export default async function ArticleOGImage({
  params,
}: {
  params: { category: string; slug: string };
}) {
  if (!isCategory(params.category)) return new Response("Not found", { status: 404 });

  const article = await getArticle(params.slug);
  const t = article?.en;
  const label = categoryLabels[params.category as Category] ?? params.category;
  const emoji = CATEGORY_EMOJI[params.category] ?? "📰";
  const title = t?.title ?? "FinCNews";

  return new ImageResponse(
    (
      <div
        style={{
          background: "#09090b",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "60px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Background glow */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          background: "radial-gradient(ellipse at 15% 50%, rgba(34,211,238,0.12) 0%, transparent 55%)",
        }} />

        {/* Category badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: "10px", marginBottom: "auto",
        }}>
          <span style={{
            background: "rgba(34,211,238,0.15)", border: "1px solid rgba(34,211,238,0.3)",
            borderRadius: "8px", padding: "6px 14px",
            fontSize: 18, fontWeight: 700, color: "#22d3ee", letterSpacing: "2px",
            textTransform: "uppercase",
          }}>
            {emoji}  {label}
          </span>
        </div>

        {/* Title */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "auto" }}>
          <p style={{
            fontSize: title.length > 60 ? 42 : 52,
            fontWeight: 900,
            color: "#ffffff",
            lineHeight: 1.15,
            margin: 0,
            letterSpacing: "-1px",
            maxWidth: "1000px",
          }}>
            {title.length > 90 ? title.slice(0, 87) + "..." : title}
          </p>

          {/* FinCNews brand */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: "#fff" }}>Fin</span>
            <span style={{ fontSize: 28, fontWeight: 900, color: "#22d3ee" }}>C</span>
            <span style={{ fontSize: 28, fontWeight: 900, color: "#fff" }}>News</span>
            <span style={{ fontSize: 14, color: "#52525b", marginLeft: "12px", letterSpacing: "2px" }}>
              FINANCE INTELLIGENCE
            </span>
          </div>
        </div>

        {/* Bottom accent */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: "4px",
          background: "linear-gradient(90deg, #22d3ee, transparent)",
        }} />
      </div>
    ),
    { ...size },
  );
}
