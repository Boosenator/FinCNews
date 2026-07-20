export interface TrendingCoin {
  id:     string;
  name:   string;
  symbol: string;
  score:  number;  // CoinGecko rank (lower = more trending)
}

export interface NewsStory {
  title:     string;
  sentiment: 'positive' | 'negative' | 'neutral';
  votes:     number;
  url:       string;
}

export interface RedditPost {
  title:       string;
  subreddit:   string;
  score:       number;
  numComments: number;
  url:         string;
}

export interface DexBoost {
  name:    string;
  symbol:  string;
  chainId: string;
  url:     string;
  boosts:  number;
}

export interface LeoDataPull {
  // CoinGecko
  trendingCoins: TrendingCoin[];

  // Sentiment
  fearGreedCurrent: number;
  fearGreedHistory: number[];    // last 7 days (oldest first)
  fearGreedDelta7d: number;      // current - 7 days ago

  // CryptoPanic
  trendingStories:    NewsStory[];
  sentimentBreakdown: { positive: number; negative: number; neutral: number };

  // Reddit (public JSON, no auth)
  hotPosts: RedditPost[];

  // DexScreener boosted tokens (attention proxy)
  dexBoosts: DexBoost[];

  pulledAt: string;
}

// ─── CoinGecko trending ───────────────────────────────────────────────────────

async function fetchCoinGeckoTrending(): Promise<TrendingCoin[]> {
  const res = await fetch('https://api.coingecko.com/api/v3/search/trending');
  if (!res.ok) return [];
  const data = await res.json() as {
    coins: { item: { id: string; name: string; symbol: string; score: number } }[];
  };
  return (data.coins ?? []).map((c) => ({
    id:     c.item.id,
    name:   c.item.name,
    symbol: c.item.symbol,
    score:  c.item.score,
  }));
}

// ─── Fear & Greed ─────────────────────────────────────────────────────────────

async function fetchFearGreed(): Promise<{ current: number; history: number[]; delta7d: number }> {
  const res = await fetch('https://api.alternative.me/fng/?limit=7');
  if (!res.ok) return { current: 50, history: [], delta7d: 0 };
  const data = await res.json() as { data: { value: string }[] };
  const values = (data.data ?? []).map((d) => parseInt(d.value, 10));
  const current = values[0] ?? 50;
  const week    = values[6] ?? current;
  return {
    current,
    history:  values.slice().reverse(),
    delta7d:  current - week,
  };
}

// ─── CryptoPanic ─────────────────────────────────────────────────────────────

async function fetchCryptoPanic(): Promise<{ stories: NewsStory[]; breakdown: LeoDataPull['sentimentBreakdown'] }> {
  const key = process.env.CRYPTOPANIC_API_KEY;
  if (!key) return { stories: [], breakdown: { positive: 0, negative: 0, neutral: 0 } };

  try {
    const url = `https://cryptopanic.com/api/free/v1/posts/?auth_token=${key}&filter=trending&public=true`;
    const res = await fetch(url);
    if (!res.ok) return { stories: [], breakdown: { positive: 0, negative: 0, neutral: 0 } };

    const data = await res.json() as {
      results: { title: string; votes: { positive: number; negative: number; important: number }; url: string }[];
    };

    const breakdown = { positive: 0, negative: 0, neutral: 0 };
    const stories: NewsStory[] = (data.results ?? []).slice(0, 15).map((r) => {
      const pos = r.votes?.positive ?? 0;
      const neg = r.votes?.negative ?? 0;
      const sentiment: NewsStory['sentiment'] = pos > neg * 1.5 ? 'positive' : neg > pos * 1.5 ? 'negative' : 'neutral';
      breakdown[sentiment]++;
      return { title: r.title, sentiment, votes: pos + neg, url: r.url };
    });

    return { stories, breakdown };
  } catch {
    return { stories: [], breakdown: { positive: 0, negative: 0, neutral: 0 } };
  }
}

// ─── Reddit public JSON (no auth needed) ─────────────────────────────────────

async function fetchRedditHot(subreddit: string, limit = 15): Promise<RedditPost[]> {
  try {
    const res = await fetch(
      `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`,
      { headers: { 'User-Agent': 'finc.news editorial-bot (finc.news)' } }
    );
    if (!res.ok) return [];
    const data = await res.json() as {
      data: { children: { data: { title: string; subreddit: string; score: number; num_comments: number; permalink: string } }[] };
    };
    return (data.data?.children ?? []).map((c) => ({
      title:       c.data.title,
      subreddit:   c.data.subreddit,
      score:       c.data.score,
      numComments: c.data.num_comments,
      url:         `https://reddit.com${c.data.permalink}`,
    }));
  } catch {
    return [];
  }
}

// ─── DexScreener token boosts ─────────────────────────────────────────────────

async function fetchDexBoosts(): Promise<DexBoost[]> {
  try {
    const res = await fetch('https://api.dexscreener.com/token-boosts/top/v1');
    if (!res.ok) return [];
    const data = await res.json() as {
      tokenAddress: string;
      chainId: string;
      url: string;
      description: string;
      links: { label: string; url: string }[];
      amount: number;
      totalAmount: number;
    }[];

    return (Array.isArray(data) ? data : []).slice(0, 10).map((d) => ({
      name:    d.description?.split(' ')[0] ?? d.tokenAddress.slice(0, 8),
      symbol:  '',
      chainId: d.chainId,
      url:     d.url,
      boosts:  d.totalAmount ?? d.amount ?? 0,
    }));
  } catch {
    return [];
  }
}

// ─── Main pull ────────────────────────────────────────────────────────────────

export async function pullLeoData(): Promise<LeoDataPull> {
  const [trendingCoins, fearGreed, cryptoPanic, redditCrypto, redditBitcoin, dexBoosts] =
    await Promise.allSettled([
      fetchCoinGeckoTrending(),
      fetchFearGreed(),
      fetchCryptoPanic(),
      fetchRedditHot('CryptoCurrency'),
      fetchRedditHot('Bitcoin'),
      fetchDexBoosts(),
    ]).then((r) => r.map((x) => (x.status === 'fulfilled' ? x.value : null)));

  const fg = fearGreed as Awaited<ReturnType<typeof fetchFearGreed>> | null;
  const cp = cryptoPanic as Awaited<ReturnType<typeof fetchCryptoPanic>> | null;

  // Combine Reddit from both subreddits, deduplicate by title prefix
  const allPosts = [
    ...((redditCrypto as RedditPost[] | null) ?? []),
    ...((redditBitcoin as RedditPost[] | null) ?? []),
  ].sort((a, b) => b.score - a.score).slice(0, 20);

  return {
    trendingCoins:      (trendingCoins as TrendingCoin[] | null) ?? [],
    fearGreedCurrent:   fg?.current ?? 50,
    fearGreedHistory:   fg?.history ?? [],
    fearGreedDelta7d:   fg?.delta7d ?? 0,
    trendingStories:    cp?.stories ?? [],
    sentimentBreakdown: cp?.breakdown ?? { positive: 0, negative: 0, neutral: 0 },
    hotPosts:           allPosts,
    dexBoosts:          (dexBoosts as DexBoost[] | null) ?? [],
    pulledAt:           new Date().toISOString(),
  };
}
