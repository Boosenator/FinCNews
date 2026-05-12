import Link from "next/link";

type CoinPrice = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
};

const FALLBACK: CoinPrice[] = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", price: 67234, change24h: 2.3 },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", price: 3456, change24h: 1.2 },
  { id: "solana", symbol: "SOL", name: "Solana", price: 145, change24h: -0.5 },
  { id: "binancecoin", symbol: "BNB", name: "BNB", price: 589, change24h: 0.8 },
  { id: "ripple", symbol: "XRP", name: "XRP", price: 0.52, change24h: -1.1 },
  { id: "cardano", symbol: "ADA", name: "Cardano", price: 0.45, change24h: 1.5 },
  { id: "polkadot", symbol: "DOT", name: "Polkadot", price: 7.8, change24h: -0.3 },
  { id: "chainlink", symbol: "LINK", name: "Chainlink", price: 14.2, change24h: 3.1 },
];

async function getPrices(): Promise<CoinPrice[]> {
  try {
    const ids = FALLBACK.map((c) => c.id).join(",");
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(3000) },
    );
    if (!res.ok) return FALLBACK;
    const data = await res.json();
    return FALLBACK.map((coin) => ({
      ...coin,
      price: data[coin.id]?.usd ?? coin.price,
      change24h: data[coin.id]?.usd_24h_change ?? coin.change24h,
    }));
  } catch {
    return FALLBACK;
  }
}

function fmt(price: number): string {
  if (price >= 1000) return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (price >= 1) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

export default async function PriceTicker() {
  const coins = await getPrices();
  const doubled = [...coins, ...coins];

  return (
    <div className="border-b border-white/[0.06] bg-zinc-900/60 py-2 overflow-hidden">
      <div className="flex animate-ticker gap-8 whitespace-nowrap">
        {doubled.map((coin, i) => {
          const up = coin.change24h >= 0;
          return (
            <Link
              key={`${coin.id}-${i}`}
              href={`/crypto`}
              className="inline-flex shrink-0 items-center gap-2 text-xs transition hover:opacity-80"
            >
              <span className="font-bold text-zinc-300">{coin.symbol}</span>
              <span className="tabular-nums text-white">${fmt(coin.price)}</span>
              <span className={`tabular-nums font-semibold ${up ? "text-emerald-400" : "text-red-400"}`}>
                {up ? "▲" : "▼"} {Math.abs(coin.change24h).toFixed(2)}%
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
