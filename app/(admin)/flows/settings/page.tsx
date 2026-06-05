import { supabaseAdmin, type RssSource } from "@/lib/supabase";
import AdminNav from "../_components/AdminNav";
import SettingsTab from "../_components/SettingsTab";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const db = supabaseAdmin();
  const { data: sources } = await db.from("rss_sources").select("*").order("name");

  return (
    <div className="min-h-screen bg-zinc-950">
      <AdminNav />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <SettingsTab sources={(sources ?? []) as RssSource[]} />
      </div>
    </div>
  );
}
