import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "FinCNews — Finance & Crypto Intelligence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#09090b",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-end",
          padding: "64px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          background: "radial-gradient(ellipse at 20% 40%, rgba(34,211,238,0.13) 0%, transparent 55%)" }} />

        {/* Logo text (matches brand) */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "auto" }}>
          <span style={{ fontSize: 52, fontWeight: 900, color: "#fff", letterSpacing: "-1px" }}>
            Fin
          </span>
          <span style={{ fontSize: 52, fontWeight: 900, color: "#22d3ee", letterSpacing: "-1px" }}>
            C
          </span>
          <span style={{ fontSize: 52, fontWeight: 900, color: "#fff", letterSpacing: "-1px" }}>
            News
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ fontSize: 56, fontWeight: 900, color: "#fff", lineHeight: 1.1, margin: 0, letterSpacing: "-1.5px" }}>
            Crypto. Markets. Macro.
          </p>
          <p style={{ fontSize: 24, color: "#a1a1aa", margin: 0 }}>
            AI-powered finance news — breaking stories as they happen.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "24px", marginTop: "40px" }}>
          {["Crypto", "Markets", "Economy", "Fintech", "Policy"].map((cat) => (
            <span key={cat} style={{ fontSize: 13, fontWeight: 700, color: "#52525b", letterSpacing: "2px", textTransform: "uppercase" }}>{cat}</span>
          ))}
        </div>

        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "4px",
          background: "linear-gradient(90deg, #22d3ee, transparent)" }} />
      </div>
    ),
    { ...size },
  );
}
