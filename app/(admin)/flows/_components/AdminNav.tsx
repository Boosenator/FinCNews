"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/flows",           label: "Dashboard", icon: "⚡" },
  { href: "/flows/editorial", label: "Editorial", icon: "✎", badge: "AI" },
  { href: "/flows/email",     label: "Email",     icon: "✉" },
  { href: "/flows/settings",  label: "Settings",  icon: "⚙" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/flows") return pathname === "/flows";
  return pathname.startsWith(href);
}

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-50 border-b border-white/[0.06] bg-zinc-950/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-black text-white">
            Fin<span className="text-cyan-400">C</span>News
            <span className="ml-2 text-xs font-normal text-zinc-600">/ Admin</span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV.map(({ href, label, icon, ...rest }) => {
              const active = isActive(pathname, href);
              const badge = "badge" in rest ? rest.badge : undefined;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    active
                      ? "bg-white/[0.08] text-white"
                      : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                  }`}
                >
                  <span className="text-[11px] font-black">{icon}</span>
                  {label}
                  {badge && (
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-400">
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4 text-xs text-zinc-600">
          <a href="/api/admin/logout" className="hover:text-zinc-400">Sign out</a>
          <a href="/" className="hover:text-zinc-400">← Site</a>
        </div>
      </div>
    </div>
  );
}
