import Link from "next/link";

type Coin = {
  id: string;
  symbol: string;
  label: string;
  price: number;
  change: number;
};

const COINS: Coin[] = [
  { id: "bitcoin",      symbol: "BTC",  label: "Bitcoin",  price: 67234, change: 2.3 },
  { id: "ethereum",     symbol: "ETH",  label: "Ethereum", price: 3456,  change: 1.2 },
  { id: "solana",       symbol: "SOL",  label: "Solana",   price: 145,   change: -0.5 },
  { id: "binancecoin",  symbol: "BNB",  label: "BNB",      price: 589,   change: 0.8 },
  { id: "ripple",       symbol: "XRP",  label: "XRP",      price: 0.52,  change: -1.1 },
  { id: "dogecoin",     symbol: "DOGE", label: "Dogecoin", price: 0.18,  change: 3.4 },
];

async function getCoins(): Promise<Coin[]> {
  try {
    const ids = COINS.map((c) => c.id).join(",");
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(3000) },
    );
    if (!res.ok) return COINS;
    const data = await res.json();
    return COINS.map((c) => ({
      ...c,
      price: data[c.id]?.usd ?? c.price,
      change: data[c.id]?.usd_24h_change ?? c.change,
    }));
  } catch {
    return COINS;
  }
}

function fmt(price: number): string {
  if (price >= 10000) return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (price >= 1)     return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

export default async function MarketBar() {
  const coins = await getCoins();

  return (
    <section className="border-y border-white/[0.06] bg-zinc-900/30 py-4">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
            Crypto Prices
          </span>
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          <span className="text-[10px] text-zinc-700">Live</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {coins.map((coin) => {
            const up = coin.change >= 0;
            return (
              <Link
                key={coin.symbol}
                href="/crypto"
                className="group flex flex-col gap-1 rounded-xl border border-white/[0.06] bg-zinc-900/60 p-3.5 transition hover:border-white/[0.12] hover:bg-zinc-900"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    {coin.symbol}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                      up ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {up ? "+" : ""}{coin.change.toFixed(2)}%
                  </span>
                </div>
                <span className="text-sm font-bold tabular-nums text-white">
                  ${fmt(coin.price)}
                </span>
                <span className="text-[10px] text-zinc-600">{coin.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
