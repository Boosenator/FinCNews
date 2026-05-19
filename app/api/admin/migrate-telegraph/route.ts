import { NextRequest, NextResponse } from "next/server";
import { sanityAdmin } from "@/lib/sanity";
import type { TelegraphNode } from "@/lib/telegraph";
import { isAuthedOrN8n } from "@/lib/auth";

export const maxDuration = 300;

const OLD = "fin-c-news.vercel.app";
const NEW = "finc.news";

type MigrateResult = { path: string; status: string };

function patchNodes(nodes: TelegraphNode[]): { nodes: TelegraphNode[]; changed: boolean } {
  let changed = false;
  const patched = nodes.map((node): TelegraphNode => {
    if (typeof node === "string") {
      if (node.includes(OLD)) { changed = true; return node.replaceAll(OLD, NEW); }
      return node;
    }
    const newAttrs = node.attrs
      ? Object.fromEntries(
          Object.entries(node.attrs).map(([k, v]) => {
            if (v.includes(OLD)) { changed = true; return [k, v.replaceAll(OLD, NEW)]; }
            return [k, v];
          }),
        )
      : node.attrs;
    const childResult = node.children ? patchNodes(node.children) : null;
    if (childResult?.changed) changed = true;
    return { ...node, attrs: newAttrs, children: childResult?.nodes ?? node.children };
  });
  return { nodes: patched, changed };
}

async function migrateOne(path: string, title: string, token: string): Promise<MigrateResult> {
  const getRes = await fetch(
    `https://api.telegra.ph/getPage?path=${encodeURIComponent(path)}&return_content=true`,
    { signal: AbortSignal.timeout(10000) },
  );
  if (!getRes.ok) return { path, status: "fetch_error" };
  const getData = await getRes.json();
  if (!getData.ok) return { path, status: `tph_error: ${getData.error}` };

  const content: TelegraphNode[] = getData.result.content ?? [];
  const { nodes: patched, changed } = patchNodes(content);
  if (!changed) return { path, status: "skipped" };

  const editRes = await fetch("https://api.telegra.ph/editPage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: token,
      path,
      title: title.slice(0, 256),
      content: patched,
      return_content: false,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!editRes.ok) return { path, status: "edit_fetch_error" };
  const editData = await editRes.json();
  if (!editData.ok) return { path, status: `edit_error: ${editData.error}` };

  return { path, status: "updated" };
}

export async function POST(req: NextRequest) {
  if (!isAuthedOrN8n(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = process.env.TELEGRAPH_TOKEN;
  if (!token) return NextResponse.json({ error: "TELEGRAPH_TOKEN not set" }, { status: 500 });
  if (!sanityAdmin) return NextResponse.json({ error: "Sanity not configured" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const limit = 20;

  const [slice, total] = await Promise.all([
    sanityAdmin.fetch<{ telegraphUrl: string; title: string }[]>(
      `*[_type == "article" && defined(telegraphUrl)] | order(_createdAt asc)[${offset}...${offset + limit}] { telegraphUrl, "title": translations.en.title }`,
    ),
    sanityAdmin.fetch<number>(`count(*[_type == "article" && defined(telegraphUrl)])`),
  ]);

  if (total === 0) return NextResponse.json({ message: "No Telegraph articles found", done: true });

  const nextOffset = offset + limit < total ? offset + limit : null;
  const results: MigrateResult[] = [];

  for (let i = 0; i < slice.length; i++) {
    const { telegraphUrl, title } = slice[i];
    const path = telegraphUrl.replace("https://telegra.ph/", "").split("?")[0];
    results.push(await migrateOne(path, title ?? path, token));
    if (i < slice.length - 1) await new Promise((r) => setTimeout(r, 2500));
  }

  const updated = results.filter((r) => r.status === "updated").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors = results.filter((r) => !["updated", "skipped"].includes(r.status));

  return NextResponse.json({
    total,
    offset,
    processed: slice.length,
    updated,
    skipped,
    errors,
    nextOffset,
    done: nextOffset === null,
    results,
  });
}
