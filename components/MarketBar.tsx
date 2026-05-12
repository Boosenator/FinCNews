import Link from "next/link";

type MarketItem = {
  label: string;
  symbol: string;
  price: number;
  change: number;
  id?: string;
};

const FALLBACK_MARKETS: MarketItem[] = [
  { symbol: "BTC", label: "Bitcoin", price: 67234, change: 2.3, id: "bitcoin" },
  { symbol: "ETH", label: "Ethereum", price: 3456, change: 1.2, id: "ethereum" },
  { symbol: "SOL", label: "Solana", price: 145, change: -0.5, id: "solana" },
  { symbol: "S&P", label: "S&P 500", price: 5234, change: 0.3 },
  { symbol: "GOLD", label: "Gold", price: 2345, change: 0.1 },
  { symbol: "DXY", label: "USD Index", price: 104.2, change: -0.2 },
];

async function getMarkets(): Promise<MarketItem[]> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true",
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(3000) },
    );
    if (!res.ok) return FALLBACK_MARKETS;
    const data = await res.json();
    return FALLBACK_MARKETS.map((item) => {
      if (!item.id) return item;
      return {
        ...item,
        price: data[item.id]?.usd ?? item.price,
        change: data[item.id]?.usd_24h_change ?? item.change,
      };
    });
  } catch {
    return FALLBACK_MARKETS;
  }
}

function formatPrice(price: number, symbol: string): string {
  if (symbol === "DXY") return price.toFixed(2);
  if (price >= 10000) return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (price >= 100) return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function MarketBar() {
  const markets = await getMarkets();

  return (
    <section className="border-y border-white/[0.06] bg-zinc-900/30 py-4">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Market Snapshot</span>
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          <span className="text-[10px] text-zinc-700">Live</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {markets.map((item) => {
            const up = item.change >= 0;
            return (
              <Link
                key={item.symbol}
                href={item.id ? `/crypto` : `/markets`}
                className="group flex flex-col gap-1 rounded-xl border border-white/[0.06] bg-zinc-900/60 p-3.5 transition hover:border-white/[0.12] hover:bg-zinc-900"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    {item.symbol}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                      up ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {up ? "+" : ""}{item.change.toFixed(2)}%
                  </span>
                </div>
                <span className="text-sm font-bold tabular-nums text-white">
                  {item.symbol !== "DXY" && item.symbol !== "S&P" ? "$" : ""}
                  {formatPrice(item.price, item.symbol)}
                </span>
                <span className="text-[10px] text-zinc-600">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
