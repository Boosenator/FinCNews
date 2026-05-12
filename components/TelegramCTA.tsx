type TelegramCTAProps = {
  title: string;
  text: string;
  href?: string;
};

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

export default function TelegramCTA({
  title,
  text,
  href = "https://t.me/fincnews",
}: TelegramCTAProps) {
  return (
    <aside className="relative overflow-hidden rounded-xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 via-cyan-400/5 to-transparent p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-400">
          <TelegramIcon />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-cyan-100">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-400">{text}</p>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-cyan-300 active:scale-95"
          >
            <TelegramIcon />
            Subscribe free
          </a>
        </div>
      </div>
    </aside>
  );
}
