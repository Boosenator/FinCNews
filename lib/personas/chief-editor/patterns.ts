import type { ArticleSummary } from './data-collector';

export interface PatternAlert {
  personaId: string;
  warning:   string;
}

// Extract the opening sentence/phrase of an article body or title
function openingPhrase(article: ArticleSummary): string {
  const text = article.body || article.title;
  return text.split(/[.!?]/)[0]?.trim().slice(0, 80).toLowerCase() ?? '';
}

// Extract first meaningful word group (first 3 words)
function openingWords(article: ArticleSummary): string {
  return openingPhrase(article).split(/\s+/).slice(0, 3).join(' ');
}

export function detectPatterns(
  personaId:    string,
  todayArticle: ArticleSummary,
  history:      ArticleSummary[]   // last 5-7 articles, not including today
): PatternAlert[] {
  const alerts: PatternAlert[] = [];

  if (history.length < 2) return alerts;

  // 1. Repeated opening pattern (same first 3 words in 3+ articles)
  const todayOpening = openingWords(todayArticle);
  const matchingOpens = history.filter(
    (a) => openingWords(a) === todayOpening && todayOpening.length > 8
  );
  if (matchingOpens.length >= 2) {
    alerts.push({
      personaId,
      warning: `Opening pattern repeated: "${todayOpening}..." appears in ${matchingOpens.length + 1} of last ${history.length + 1} articles`,
    });
  }

  // 2. Repeated topic (same primary tag 3+ times in 7 days)
  const todayWords = (todayArticle.title + ' ' + todayArticle.excerpt).toLowerCase();
  const topicKeywords = [
    ['exchange', 'inflow', 'netflow'],
    ['yield curve', 'treasury', '10-year'],
    ['fomc', 'fed funds', 'rate decision'],
    ['bitcoin l2', 'btc l2'],
    ['ai token', 'artificial intelligence'],
    ['solana', 'sol ecosystem'],
    ['miner', 'hashrate'],
    ['mempool', 'fee'],
  ];

  for (const keyGroup of topicKeywords) {
    const todayHit = keyGroup.some((k) => todayWords.includes(k));
    if (!todayHit) continue;

    const historyHits = history.filter((a) => {
      const text = (a.title + ' ' + a.excerpt).toLowerCase();
      return keyGroup.some((k) => text.includes(k));
    });

    if (historyHits.length >= 2) {
      alerts.push({
        personaId,
        warning: `Topic overlap: "${keyGroup[0]}" covered ${historyHits.length + 1} times in last ${history.length + 1} articles`,
      });
      break;
    }
  }

  // 3. Conclusion pattern: ended without a specific threshold/number (question or vague)
  const conclusion = todayArticle.body.split(/\n/).slice(-3).join(' ').toLowerCase();
  const hasSpecificConclusion = /\d/.test(conclusion) && /(watch|if|when|above|below|crosses)/.test(conclusion);
  const endsWithQuestion = conclusion.trim().endsWith('?');

  if (endsWithQuestion) {
    alerts.push({
      personaId,
      warning: `Conclusion ends with a question — should close with a specific metric and threshold`,
    });
  } else if (!hasSpecificConclusion && todayArticle.body.length > 200) {
    alerts.push({
      personaId,
      warning: `Weak conclusion: no specific numeric threshold detected in closing paragraph`,
    });
  }

  return alerts;
}
