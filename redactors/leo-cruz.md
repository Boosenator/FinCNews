# Leo Cruz — Narrative Hunter
**Статус:** ✅ Реалізовано і задеплоєно

---

## Біо та характер

Leo Cruz зайшов у крипто в DeFi Summer 2020. Купив SUSHI на хайпі, продав у мінус, потім купив знову і заробив. Цей цикл повторився кілька разів поки він не зрозумів патерн: він не торгує токени — він торгує narratives. Хто першим зрозумів narrative до того як він став мейнстрімом — той виграв. Хто зайшов коли всі вже говорять — той купив топ.

Зараз Leo відстежує де зароджується наступний narrative — у Twitter threads, Reddit постах, Discord серверах. Він не аналізує ончейн і не читає Fed statements. Він читає те що читають люди.

**Характерні риси:**
- Перший з трьох хто відстежує токени нижче топ-50
- Знає що "sentiment shifts before price"
- Не довіряє власним інстинктам без даних — але використовує дані для підтвердження інстинктів
- Пише так щоб retail інвестор зрозумів про що мова за 30 секунд
- Іноді провокаційний але ніколи не знущається над читачем

**Чого він ніколи не пише:**
- Технічний аналіз (ліній, свічок, патернів)
- On-chain або macro без social confirmation
- "BTC впав на X%" без розповіді чому саме зараз це важливо для narrative
- "Watch X" без власного verdict

---

## Стиль написання

**Структура статті:**
1. Hook — одне речення що одразу ставить питання або дає несподіваний факт
2. The narrative — що саме відбувається в ринковій психології прямо зараз
3. The signal — конкретні дані (trending, sentiment score) що підтверджують
4. Who's talking — хто рухає narrative (retail, whales, builders, media)
5. The setup — де narrative в своєму циклі (emerging/growing/peak/fading)
6. What to watch — конкретний тригер що підтверджує або вбиває narrative

**Тон:** Живо, трохи провокаційно, але завжди з повагою до читача.

**Маркери стилю:**
- Риторичні питання: *"Remember when everyone was talking about AI tokens? It's happening again — but with a twist."*
- *"Here's what's actually happening:", "The setup:", "Why this matters:"*
- Narrative labeling: *"This is a classic rotation play.", "The narrative is hitting mainstream"*

**Ніколи не використовує:** "guaranteed", "100x incoming", fear-mongering без даних

---

## Файлова структура

```
lib/personas/
├── shared.ts              — спільні утиліти (publishArticleToSanity, callClaude, etc.)
├── embeddings.ts          — OpenAI text-embedding-3-small (shared з Elena)
│
└── leo-cruz/
    ├── data-pull.ts       — CoinGecko + Fear&Greed + CryptoPanic + Reddit + DexScreener
    ├── signals.ts         — detectSignals() — 5 типів сигналів
    ├── narratives.ts      — NarrativeTracker CRUD (persona_memory type='narrative')
    ├── should-write.ts    — signal-based editorial judgment (haiku)
    ├── generate.ts        — narrative article (claude-sonnet-4-5)
    ├── self-work.ts       — bootstrap / weekly_narrative_map / update_tracker_only
    └── index.ts           — оркестратор + getLeoContext()
```

---

## Джерела даних та API

| API | Що дає | Ключ |
|-----|--------|------|
| **CoinGecko Public** | Trending coins (топ-7 за 24h) | Немає |
| **Alternative.me Fear & Greed** | Sentiment 0-100, 7-денна історія | Немає |
| **CryptoPanic** | Trending news + sentiment (positive/negative/neutral) | `CRYPTOPANIC_API_KEY` — безкоштовна реєстрація |
| **Reddit (public JSON)** | Hot posts з r/CryptoCurrency, r/Bitcoin — **без OAuth** | Немає (`User-Agent` header) |
| **DexScreener token boosts** | Топ токени що отримують attention/promotion | Немає |

**Важливо:** Reddit використовується через публічний JSON endpoint (`reddit.com/r/...hot.json`) без OAuth — не потрібні `REDDIT_CLIENT_ID/SECRET`. Достатньо `User-Agent` header.

**Google Trends:** немає офіційного Node.js API — пропущено в Phase 1.

### Phase 2 — платні

| API | Що дає | Ціна |
|-----|--------|------|
| **LunarCrush** | Social volume, engagement, AltRank | $29/міс |
| **Santiment** | Social dominance, dev activity | $49/міс |

---

## Ключова унікальна риса: Narrative Cycle Tracker

На відміну від Elena (яка відстежує macro позицію), Leo відстежує **де кожен narrative знаходиться в своєму циклі**.

```typescript
// Зберігається в persona_memory з memory_type='narrative'
interface NarrativeState {
  narrative:       string;                                          // "Bitcoin L2", "AI tokens"
  currentStage:    'emerging' | 'growing' | 'peak' | 'fading' | 'dead';
  firstDetected:   string;   // ISO date
  lastUpdated:     string;
  trendScores:     number[]; // щоденний score за останні 14 днів
  articlesWritten: string[]; // slugs статей Leo
  peakScore:       number;
}
```

**Логіка оновлення (без LLM):**
- `emerging` → `growing`: 3-7 днів в trending
- `growing` → `peak`: 7+ днів
- Зникає з trending → `fading` або `dead` (залежно від поточного stage)
- Кожен тихий день Leo оновлює tracker **без LLM call** (дешево, але критично для якості контексту)

---

## Пайплайн

```
10:00 UTC — LEO DAILY RUN
│
├─ is_active check (personas table) — false: exit
│
├─ pullLeoData()
│   ├─ CoinGecko: trending coins (топ-7)
│   ├─ Alternative.me: fear & greed (current + 7d history)
│   ├─ CryptoPanic: trending stories + sentiment (якщо є ключ)
│   ├─ Reddit public JSON: hot posts (r/CryptoCurrency + r/Bitcoin)
│   └─ DexScreener: token-boosts/top/v1
│
├─ loadNarrativeHistory()   ← persona_memory WHERE type='narrative' AND stage≠dead
│
├─ detectSignals(data, narrativeHistory)
│   ├─ new_trending:     новий токен не в tracker (strength 40-80)
│   ├─ sentiment_shift:  F&G змінився >15 pts за 7 днів (strength 50-90)
│   ├─ rotation:         fading + new emerging одночасно (strength 85) ← найсильніший
│   ├─ fading_narrative: was growing/peak, вийшов з trending (strength 60-75)
│   └─ reddit_buzz:      3+ posts про той самий токен (strength 40-70)
│
├─ shouldWrite(signals, narratives, data, recentSummary)
│   ├─ claude-haiku-4-5 eval call
│   └─ → { should_write, score, reasoning, topic, narrative_type, cycle_stage }
│
├─ [score ≥ 60]
│   ├─ buildContext(topic)        ← 4 шари (div нижче)
│   ├─ generateLeoArticle()       — claude-sonnet-4-5
│   ├─ publishArticleToSanity()
│   ├─ saveToMemory(type='article')
│   └─ [fire-and-forget]
│       ├─ saveEmbedding()
│       └─ markNarrativeCovered() + updateNarrativeTracker()
│
└─ [score < 60] → decideSelfWork()
    ├─ bootstrap             — 0 статей в пам'яті
    ├─ weekly_narrative_map  — неділя, wrote=0 цього тижня
    └─ update_tracker_only   — ЗАВЖДИ на тихих днях (без LLM)
        └─ updateNarrativeTracker(trendingCoins)
            ├─ оновлює stage кожного active narrative
            └─ додає нові trending coins як 'emerging'
```

---

## buildContext() — 4 шари

```
=== Leo's narrative framework ===
[bootstrap manifesto — завжди, type='context']

=== Active narrative tracker ===
Narrative: Bitcoin L2 | Stage: growing | Since: 2026-05-28
Narrative: AI tokens | Stage: fading | Since: 2026-04-10
...

=== Similar past articles ===   ← pgvector, якщо є OPENAI_API_KEY + topic
  - [title] [similarity: 82%]

=== Recent articles ===
  - [title] [topic: rotation]
  - [title] [topic: new_trending]
```

---

## Пам'ять (persona_memory)

| memory_type | Що зберігається | Особливість |
|-------------|-----------------|-------------|
| `context` | Bootstrap manifesto | 1 запис, завжди в контексті |
| `article` | Опубліковані статті (title + excerpt) | Останні 5 в context |
| `narrative` | NarrativeState для кожного narrative | Upsert by narrative name; stage≠dead |

**Відсутні (на відміну від Elena):** `forecast`, `position` — Leo не робить macro прогнозів і не має "позиції" в тому ж сенсі що Elena.

---

## Self-Work система

| Тип | Тригер | LLM? | memory_type |
|-----|--------|------|-------------|
| `bootstrap` | 0 статей в пам'яті | sonnet-4-5 ✓ | `context` |
| `weekly_narrative_map` | Неділя, wrote=0 цього тижня | haiku ✓ | `article` |
| `update_tracker_only` | Будь-який тихий день | ✗ Без LLM | оновлює `narrative` records |

**Bootstrap** — argumentative frame: cold open з позицією Leo по поточному ринку → narrative hunting framework → що він буде відстежувати. Зберігається як `context`.

**`update_tracker_only`** — унікально для Leo: без LLM call, просто порівнює trending coins з tracker і оновлює stages. Виконується ЗАВЖДИ на тихих днях.

---

## Сигнали та scoring

| Сигнал | Умова | Strength | Score if sole |
|--------|-------|----------|--------------|
| `rotation` | fading + new emerging одночасно | 85 | 80-90 |
| `new_trending` | новий токен в trending (не було 7 днів) | 40-80 | 40-55 |
| `sentiment_shift` | F&G змінився >15 pts за 7 днів | 50-90 | 65-75 |
| `fading_narrative` | was growing/peak, gone from trending | 60-75 | 60-75 |
| `reddit_buzz` | 3+ hot posts про той самий токен | 40-70 | 40-55 |

Score thresholds:
- Rotation: 80-90
- New narrative, 3+ signals: 75-85
- Peak warning: 70-80
- Sentiment shift + trending: 65-75
- Single spike: 40-55
- Neutral day: 10-35

---

## Розклад

```
vercel.json: { "path": "/api/cron/leo", "schedule": "0 10 * * *" }
```

| День | Score < 60 | Score ≥ 60 |
|------|------------|------------|
| Неділя | weekly_narrative_map + update_tracker | event article |
| Пн–Сб тихий | update_tracker_only | event article |
| Будь-який день | update_tracker_only (завжди) | — |

---

## DB (Supabase)

```sql
-- Ті самі таблиці що і для Elena:
personas        — id='leo-cruz', is_active=false, config jsonb
persona_memory  — type IN ('article','context','narrative')  ← migration_013 додає 'narrative'
persona_runs    — score, reasoning, topic, article_slug
```

**Migrations:**
```
migration_013.sql  — додає 'narrative' до memory_type CHECK constraint
seed_personas.sql  — Leo Cruz INSERT (is_active=false)
```

**Активація:** `UPDATE personas SET is_active=true WHERE id='leo-cruz';`

---

## Sanity

Статті Leo зберігаються з:
```typescript
persona:      'leo-cruz'
authorName:   'Leo Cruz'
authorAvatar: '/authors/leo-cruz.png'
category:     'crypto'  // Leo завжди crypto
```

---

## Admin Panel (`/flows/editorial` → Personas tab)

PersonasTab переписаний як `PersonaCard` підкомпонент — Leo і Elena рівноцінні.

| Кнопка | Що робить |
|--------|-----------|
| Pull Data | CoinGecko + F&G + CryptoPanic + Reddit + DexScreener → показує дані + signals |
| Evaluate | shouldWrite → score/reasoning + signals що спрацювали |
| Dry Generate | Генерує статтю без публікації |
| Self-Work | decideSelfWork() + executeSelfWork() → tracker update або публікація |
| ▶ Full Run | Повний пайплайн |
| Toggle Active | is_active в personas table |
| Load (Recent Runs) | Останні 10 persona_runs |
| Show Memory | buildContext з 4 шарами, включаючи narrative tracker |

---

## ENV Variables

| Змінна | Використання | Статус |
|--------|-------------|--------|
| `CRYPTOPANIC_API_KEY` | data-pull.ts — trending stories | Optional (graceful skip) |
| `ANTHROPIC_API_KEY` | should-write, generate, self-work | ✅ є |
| `OPENAI_API_KEY` | embeddings (shared) | ✅ є |

**Що НЕ потрібно:**
- Reddit OAuth keys — використовується public JSON endpoint
- CoinGecko key — public API
- DexScreener key — public API

---

## Відмінності від Elena Voss

| Аспект | Elena Voss | Leo Cruz |
|--------|-----------|---------|
| Тригер | FRED anomalies + economic calendar | Social signals + trending anomalies |
| Унікальна пам'ять | `forecast` + `position` | `narrative` (cycle tracker) |
| Self-work | Weekly macro preview/summary | Weekly narrative map + daily tracker |
| Quiet day action | Log and exit | **Update tracker без LLM** (завжди) |
| Bootstrap frame | Macro framework manifesto | Narrative hunting manifesto |
| Нові ENV keys | `FRED_API_KEY` | `CRYPTOPANIC_API_KEY` (optional) |
| DB migration | 009-012 | + 013 ('narrative' memory type) |
| Reddit auth | — | Public JSON (no OAuth needed) |

---

## Відомі особливості

**Reddit public JSON:** Використовується `https://www.reddit.com/r/CryptoCurrency/hot.json` без auth. Rate limit може спрацювати при частих запитах. Для Phase 1 — достатньо.

**DexScreener boosts:** Endpoint `/token-boosts/top/v1` показує токени що платять за promotion — це сигнал уваги, не обов'язково органічного trending. Корисний як secondary signal.

**CryptoPanic graceful skip:** Якщо `CRYPTOPANIC_API_KEY` не встановлений → stories і sentiment = порожні. Решта пайплайну працює нормально.

**Narrative tracker перший запуск:** Перші кілька днів tracker буде порожнім — Leo буде додавати trending coins як `emerging`. Сигнали `rotation` і `fading` зʼявляться лише після 3-7 днів роботи.
