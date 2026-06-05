# Elena Voss — Macro Bear
**Статус:** ✅ Повністю реалізовано і задеплоєно

---

## Біо та характер

Elena Voss — дванадцять років у традиційних фінансах. Fixed income у Deutsche Bank (Frankfurt), потім macro у сімейному офісі в Цюріху. У 2021-му клієнт попросив виділити 3% портфеля на Bitcoin. Вона зробила роботу, дала рекомендацію, ринок пішов проти неї. Тоді зрозуміла: крипто — це не окрема планета, це ризиковий актив в тій самій macro системі де вона пропрацювала все своє життя.

**Характерні риси:**
- Читає кожне слово Fed statement — ніколи не переказує, цитує точно
- Має в закладках economic calendar на місяць вперед
- Дратується коли crypto Twitter ігнорує macro контекст
- Змовчить коли macro day тихий — краще нічого не написати ніж написати без контексту

**Чого вона ніколи не пише:**
- On-chain аналіз (це Marcus)
- Narrative хайп без macro anchor
- "Watch X" без власної відповіді — обов'язковий verdict

---

## Стиль написання

**Структура статті:**
1. Macro подія / дані — точна цитата або число
2. Ширший контекст — де це в циклі (Fed cycle, risk cycle, DXY trend)
3. Кореляція з крипто — historical BTC/macro relationship
4. Що це означає — без hype, з застереженнями
5. **Конкретна позиція / verdict** — не "watch X", а "I think X because Y"

**Тон:** Академічний але не скучний. Терпіння вчителя + точність трейдера.

**Маркери стилю:** *"However", "Notably", "This matters because"* · точні цитати Fed · кореляції з числами

**Заборонено:** "moon" · "bullish/bearish" без контексту · захисні disclaimers · "Watch X" без відповіді

---

## Файлова структура

```
lib/personas/
├── shared.ts              — спільні утиліти для всіх персон
│   ├── publishArticleToSanity()
│   ├── markdownToPortableText()   — ## h2/h3, **bold**, *italic* → PortableText
│   ├── callClaude()
│   └── parseClaudeJson<T>()
│
├── embeddings.ts          — OpenAI text-embedding-3-small (shared)
│   ├── embedText()                — 1536d vector, graceful skip if no key
│   ├── saveEmbedding()            — writes to persona_memory.embedding
│   └── searchSimilarMemories()   — pgvector cosine similarity via RPC
│
└── elena-voss/
    ├── data-pull.ts       — FRED + SEC EDGAR + CoinGecko
    ├── should-write.ts    — editorial judgment (haiku)
    ├── generate.ts        — event-driven article (sonnet)
    ├── self-work.ts       — bootstrap / weekly preview / summary / event preview
    ├── forecasts.ts       — extract → store → verify forecast cycle
    ├── position.ts        — extract + upsert Elena's current macro stance
    └── index.ts           — головний оркестратор
```

---

## Джерела даних та API

| API | Що дає | Деталі | Ключ |
|-----|--------|--------|------|
| **FRED** | Fed funds rate, CPI YoY, Core PCE YoY, 10Y/2Y yields, USD Broad Index | `units=pc1` для CPI/PCE; `units=lin` для yields | `FRED_API_KEY` ✅ |
| **OpenAI** | text-embedding-3-small (1536d) | pgvector semantic search | `OPENAI_API_KEY` ✅ |
| **SEC EDGAR** | Crypto-related filings, enforcement actions (48h) | Free, no key | — |
| **CoinGecko** | BTC 24h price change | Free public API | — |

**FRED Series:**
```
FEDFUNDS   → effective Fed funds rate          (lin, %)
CPIAUCSL   → CPI percent change from year ago  (pc1, %)
PCEPILFE   → Core PCE percent change YoY       (pc1, %)
DGS10      → 10Y Treasury yield                (lin, %)
DGS2       → 2Y Treasury yield                 (lin, %)
DTWEXBGS   → Broad dollar index (≠ DXY)        (lin, index ~118)
```

---

## Пайплайн

```
08:00 UTC — cron /api/cron/elena
│
├─ is_active check (personas table) — false: exit
│
├─ pullElenaData()
│   ├─ FRED: 6 series паралельно (з units=pc1 для CPI/PCE)
│   ├─ SEC EDGAR: crypto filings 48h
│   └─ CoinGecko: BTC 24h change
│
├─ buildContext(supabase, topic=null)   ← 5 шарів (div нижче)
│
├─ shouldWrite(data, context)
│   ├─ claude-haiku-4-5 eval call
│   ├─ Calendar override: HIGH_PRIORITY_DATES → score ≥ 70
│   └─ → { should_write, score, reasoning, topic, primary_signal }
│
├─ [score ≥ 60]
│   ├─ buildContext(supabase, topic)    ← rebuild з відомим topic для semantic
│   ├─ generateElenaArticle(data, eval, context)   — claude-sonnet-4-5
│   ├─ publishArticleToSanity()        — markdown → PortableText → Sanity
│   ├─ saveToMemory(type='article')    → returns memId
│   └─ [fire-and-forget, не блокують]
│       ├─ saveEmbedding(memId, content)
│       ├─ extractAndSaveForecast(title, body, slug)
│       └─ extractAndSavePosition(title, excerpt, body)
│
├─ [score < 60] → decideSelfWork()
│   ├─ bootstrap      — 0 статей в пам'яті
│   ├─ event_preview  — завтра HIGH_PRIORITY подія
│   ├─ weekly_preview — понеділок, wrote=0 цього тижня
│   ├─ weekly_summary — п'ятниця, wrote=0 цього тижня
│   └─ null           — genuinely quiet, log and exit
│
│   executeSelfWork(task, data, context)
│   └─ publish → saveMemory → [fire-and-forget]
│       ├─ saveEmbedding
│       ├─ extractAndSaveForecast
│       └─ extractAndSavePosition
│
└─ verifyOpenForecasts()   ← паралельно з runElenaVoss()
    └─ перевіряє відкриті прогнози старші за timeframe_hours
```

---

## buildContext() — 5 шарів

```
=== Elena's analytical foundation ===
[bootstrap manifesto — завжди, зберігається як memory_type='context']

=== Current position ===
Stance: watchful-cautious on BTC
Regime: Fed paused but not pivoted, growth expectations inflated
Conviction: yield curve un-inversion = term premium expanding, not growth

=== Forecasts ===
Active forecasts (open):
  - btc_price down >5% [48h/72h elapsed]
Forecast track record: 2/3 correct

=== Semantically related past articles ===   ← pgvector, якщо є OPENAI_API_KEY
  - [title] [similarity: 84%]
  - [title] [similarity: 71%]

=== Recent articles (chronological) ===
  - [title] [topic: yield_curve]
  - [title] [topic: cpi_data]
```

---

## Пам'ять (persona_memory)

| memory_type | Що зберігається | Кількість |
|-------------|-----------------|-----------|
| `context` | Bootstrap manifesto — завжди в контексті | 1 (upsert не потрібен, не перезаписується) |
| `article` | Кожна опублікована стаття (title + excerpt + metadata) | Всі, в context беруться останні 5 |
| `forecast` | Implicit forecast з кожної статті | Open/correct/incorrect |
| `position` | Поточна macro позиція Олени | 1 (upsert — завжди актуальна) |

**Поля в `persona_memory`:**
```sql
id, persona_id, memory_type, content (text), metadata (jsonb),
embedding vector(1536),   -- OpenAI text-embedding-3-small
created_at
```

---

## Forecast система

**Що відстежується:**
```typescript
{
  metric:          'btc_price' | 'fed_funds_rate' | '10y_yield' | 'dxy'
  direction:       'up' | 'down' | 'hold'
  magnitude:       '>5%' | 'cut 25bps' | 'hold through Q3'
  timeframe_hours: 72 | 168 | 720
  statement:       "Elena's exact sentence implying the forecast"
  status:          'open' | 'correct' | 'incorrect' | 'expired'
  article_slug:    '...'
}
```

**Цикл:** `extractAndSaveForecast()` (після публікації) → `verifyOpenForecasts()` (щодня в cron) → результат в `buildContext()` як track record.

**Поточний стан верифікації:** Phase 1 — перевіряє BTC price; non-BTC forecasts позначаються як "manual verification needed". Повна автоматична верифікація через FRED порівняння — Phase 2.

---

## Position система

**Структура:**
```typescript
{
  stance:       'bearish' | 'watchful-cautious' | 'neutral' | 'selective-bullish'
  on:           'BTC' | 'crypto' | 'risk-assets'
  regime:       'Fed paused, growth slowing'
  conviction:   'yield curve steepening = term premium not growth'
  changed_from: 'neutral' | null
  updated_at:   '2026-06-05T08:30:00Z'
}
```

**Логіка:** один upsert-запис на персону — завжди відображає поточну позицію. Якщо stance змінилась — `changed_from` це фіксує. Майбутні статті "знають" де Олена стоїть і можуть еволюціонувати позицію.

---

## pgvector Semantic Search

**Модель:** `text-embedding-3-small` (OpenAI, 1536 dims)
**RPC функція:** `match_persona_memories(p_persona_id, query_embedding, match_threshold=0.65, match_count=4)`
**Migration:** `supabase/migration_012.sql`

**IVFFlat index:** закоментований в migration_012.sql — розкоментувати після 100+ рядків з embeddings:
```sql
create index on persona_memory using ivfflat (embedding vector_cosine_ops) with (lists = 100);
```

**Graceful degradation:** якщо `OPENAI_API_KEY` не встановлений → `embedText()` повертає `null` → semantic search пропускається → решта пайплайну працює нормально.

---

## Self-Work система

| Тип | Тригер | Модель | memory_type |
|-----|--------|--------|-------------|
| `bootstrap` | 0 статей в пам'яті (перший запуск) | sonnet-4-5 | `context` |
| `event_preview` | завтра в HIGH_PRIORITY_DATES | haiku | `article` |
| `weekly_preview` | понеділок, wrote=0 цього тижня | haiku | `article` |
| `weekly_summary` | п'ятниця, wrote=0 цього тижня | haiku | `article` |

**Bootstrap** — особливий: argumentative frame, не autobio. Cold open з позицією → argument → counterargument → verdict. Зберігається як `context` → завжди в майбутньому контексті.

---

## Розклад

```
vercel.json: { "path": "/api/cron/elena", "schedule": "0 8 * * *" }
```

| День | Score < 60 | Score ≥ 60 |
|------|------------|------------|
| Понеділок | weekly_preview | event article |
| Вт–Чт | silent (log) | event article |
| П'ятниця | weekly_summary | event article |
| День перед FOMC/CPI | event_preview | event article |
| FOMC/CPI/PCE/NFP день | score авто 70+ → пише | — |

---

## DB (Supabase)

```sql
personas        — id, display_name, role, avatar_path, system_prompt,
                  eval_prompt, config jsonb, is_active, updated_at
persona_memory  — id, persona_id, memory_type, content, metadata jsonb,
                  embedding vector(1536), created_at
persona_runs    — id, persona_id, run_date, should_write, score, reasoning,
                  topic, primary_signal, article_slug, article_id,
                  data_snapshot jsonb, created_at
```

**Migrations:**
```
migration_009.sql  — personas table
migration_010.sql  — persona_memory + pgvector extension
migration_011.sql  — persona_runs table
migration_012.sql  — match_persona_memories() RPC function
seed_personas.sql  — Elena Voss INSERT (is_active=false)
```

**Активація:** `UPDATE personas SET is_active=true WHERE id='elena-voss';`

---

## Sanity

Додано до `article` schema:
```typescript
persona:      string  // 'elena-voss'
authorName:   string  // 'Elena Voss'
authorAvatar: string  // '/authors/elena-voss.png'
```
Byline на сторінці статті показує аватар + ім'я.

---

## Admin Panel (`/admin/flows` → Personas tab)

| Кнопка | Дія |
|--------|-----|
| Pull Data | FRED + SEC + CoinGecko → таблиця всіх показників |
| Evaluate | should_write → score/reasoning/topic (без запису в БД) |
| Dry Generate | Генерує статтю без публікації → preview body + telegram |
| Self-Work | decideSelfWork() + executeSelfWork() → публікує |
| ▶ Full Run | Повний пайплайн з активацією всіх підсистем |
| Toggle Active | is_active в personas table |
| Load (Recent Runs) | Останні 10 рядків з persona_runs |

---

## Публічні сторінки

- `/author` — каталог авторів (Elena активна, Marcus/Leo "Soon")
- Byline на статтях: аватар + ім'я персони

---

## ENV Variables (всі активні)

| Змінна | Використання |
|--------|-------------|
| `FRED_API_KEY` | data-pull.ts — FRED series |
| `OPENAI_API_KEY` | embeddings.ts — text-embedding-3-small |
| `ANTHROPIC_API_KEY` | should-write, generate, self-work, forecasts, position |
| `SANITY_PROJECT_ID` / `SANITY_TOKEN` | publishArticleToSanity |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | всі Supabase операції |
| `CRON_SECRET` | /api/cron/elena auth |

---

## Відомі особливості

**DTWEXBGS ≠ DXY:** Broad Dollar Index (~118) vs класичний DXY (~99-105). Claude підписує як "USD Broad Index" в статтях — не плутати читача цифрою 118.

**Forecast верифікація Phase 1:** BTC forecasts мають автоматичну перевірку; FRED-based forecasts (Fed rate, yields) поки "manual verification needed". Повна автоматизація через FRED comparison — Phase 2.

**Bootstrap article:** зберігається як `context`, не `article`. Ніколи не виходить з контексту, навіть коли накопичуються нові статті. Не видаляти.

**Fire-and-forget після публікації:** `saveEmbedding`, `extractAndSaveForecast`, `extractAndSavePosition` — всі async, не блокують відповідь cron. Якщо падають — стаття вже опублікована, наступний запуск компенсує.
