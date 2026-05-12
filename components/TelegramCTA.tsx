type TelegramCTAProps = {
  title: string;
  text: string;
  href?: string;
};

export default function TelegramCTA({ title, text, href }: TelegramCTAProps) {
  return (
    <aside className="rounded-lg border border-cyan-300/30 bg-cyan-300/10 p-5">
      <h2 className="text-base font-semibold text-cyan-100">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-300">{text}</p>
      {href ? (
        <a
          href={href}
          className="mt-4 inline-flex rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200"
          target="_blank"
          rel="noreferrer"
        >
          Telegram
        </a>
      ) : null}
    </aside>
  );
}
