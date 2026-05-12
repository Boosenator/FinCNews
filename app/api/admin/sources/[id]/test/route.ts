import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

function isAuthed(req: NextRequest) {
  return req.cookies.get("admin_key")?.value === process.env.ADMIN_KEY;
}

const KEYWORDS = [
  "bitcoin","ethereum","solana","ETF","hack","exploit","listing","regulation",
  "ban","fork","upgrade","airdrop","stablecoin","CBDC","DeFi",
  "Fed","rate","CPI","inflation","recession","FOMC",
  "SEC","CFTC","MiCA","compliance",
  "earnings","IPO","merger","acquisition","bankruptcy",
  "payment","neobank","fintech",
];

function extractCdata(xml: string, tag: string): string {
  const cdataRe = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, "i");
  const m = xml.match(cdataRe);
  if (m) return m[1].trim();
  const plainRe = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, "i");
  const p = xml.match(plainRe);
  return p ? p[1].trim() : "";
}

function extractLink(xml: string): string {
  const plain = xml.match(/<link>([^<]+)<\/link>/i);
  if (plain) return plain[1].trim();
  const attr = xml.match(/<link[^>]+href=["']([^"']+)["']/i);
  if (attr) return attr[1].trim();
  return extractCdata(xml, "guid");
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data: source } = await db
    .from("rss_sources")
    .select("url, name, category")
    .eq("id", params.id)
    .single();

  if (!source) return NextResponse.json({ error: "Source not found" }, { status: 404 });

  try {
    const res = await fetch(source.url, {
      headers: { "User-Agent": "FinCNews-Bot/1.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `HTTP ${res.status}`, source });
    }

    const xml = await res.text();
    const itemRe = /<(item|entry)[\s>][\s\S]*?<\/(item|entry)>/gi;
    const items: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = itemRe.exec(xml)) !== null && items.length < 10) {
      items.push(m[0]);
    }

    const parsed = items.map((item) => {
      const title = extractCdata(item, "title");
      const link = extractLink(item);
      const pubDate = extractCdata(item, "pubDate") || extractCdata(item, "published");
      const snippet = extractCdata(item, "description")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200);

      const text = `${title} ${snippet}`;
      const matched = KEYWORDS.filter((kw) =>
        new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)
      );

      return { title, link, pubDate, snippet, matchedKeywords: matched };
    });

    return NextResponse.json({
      source,
      totalItems: items.length,
      items: parsed,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e), source });
  }
}
