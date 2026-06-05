# Elena Voss — Macro Bear
**Статус:** ✅ Реалізовано і задеплоєно

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
- Прогнози без даних з FRED

---

## Стиль написання

**Структура статті:**
1. Macro подія / дані — точна цитата або число
2. Ширший контекст — де це в циклі (Fed cycle, risk cycle, DXY trend)
3. Кореляція з крипто — historical BTC/macro relationship
4. Що це означає — без hype, з застереженнями
5. Конкретна позиція / verdict — не "watch X", а "I think X because Y"

**Тон:** Академічний але не скучний. Терпіння вчителя + точність трейдера.

**Маркери стилю:**
- Структурні маркери: *"However", "Notably", "This matters because"*
- Точні цитати Fed
- Кореляційні твердження з числами
- **Обов'язковий verdict в кінці** — позиція, не питання

**Ніколи не використовує:**
- "moon", "bullish/bearish" без контексту, спекуляції без macro anchor
- "This isn't a trading newsletter" — захисні disclaimers
- "Watch X" без власної відповіді на питання

---

## Реалізовані файли

```
lib/personas/
├── shared.ts                      — спільні утиліти для всіх персон
│   ├── publishArticleToSanity()   — публікація в Sanity з PortableText conversion
│   ├── markdownToPortableText()   — markdown → PortableText (##, **bold**, *italic*)
│   ├── callClaude()               — fetch до Anthropic API
│   └── parseClaudeJson<T>()       — парсинг JSON з відповіді Claude
│
└── elena-voss/
    ├── data-pull.ts               — збір даних
    ├── should-write.ts            — editorial judgment
    ├── generate.ts                — генерація event-driven статті
    ├── self-work.ts               — self-work пайплайн
    └── index.ts                   — головний оркестратор
```

---

## Джерела даних та API

| API | Що дає | Параметри | Ключ |
|-----|--------|-----------|------|
| **FRED** (St. Louis Fed) | Fed funds rate, CPI YoY, Core PCE YoY, 10Y/2Y yields, DXY (broad) | `units=pc1` для CPI/PCE (% YoY), `units=lin` для yields | `FRED_API_KEY` у Vercel |
| **SEC EDGAR Full-Text** | Crypto-related filings, enforcement actions за останні 48h | Free, no key | — |
| **CoinGecko** | BTC 24h price change для macro context | Free public API | — |

**FRED Series:**
```typescript
FEDFUNDS   // effective Fed funds rate (lin)
CPIAUCSL   // CPI percent change from year ago (pc1)
PCEPILFE   // Core PCE percent change from year ago (pc1)
DGS10      // 10Y Treasury yield (lin)
DGS2       // 2Y Treasury yield (lin)
DTWEXBGS   // Broad dollar index — НЕ класичний DXY (lin)
```

---

## Пайплайн (реалізовано)

```
08:00 UTC — cron /api/cron/elena
│
├─ is_active check (personas table) — якщо false: exit
│
├─ pullElenaData()
│   ├─ FRED: 6 series паралельно
│   ├─ SEC EDGAR RSS: crypto filings (48h)
│   └─ CoinGecko: BTC 24h change
│
├─ buildContext()               ← NEW: включає 'context' memories + recent articles
│   ├─ persona_memory WHERE type='context'  — bootstrap/manifesto (завжди)
│   └─ persona_memory WHERE type='article' — останні 5 статей
│
├─ shouldWrite(data, context)
│   ├─ LLM call: claude-haiku-4-5 (швидко, дешево)
│   ├─ Calendar override: FOMC/CPI/PCE/NFP дні → score мінімум 70
│   └─ Returns: { should_write, score, reasoning, topic, primary_signal }
│
├─ [score ≥ 60] → generateElenaArticle()
│   ├─ LLM call: claude-sonnet-4-5 (якісно)
│   ├─ publishArticleToSanity() — markdown → PortableText → Sanity
│   ├─ saveToMemory(type='article')
│   └─ updatePersonaRun(article_slug, article_id)
│
└─ [score < 60] → decideSelfWork() → executeSelfWork()
    ├─ bootstrap    — якщо 0 статей в пам'яті
    ├─ event_preview — якщо завтра HIGH_PRIORITY подія
    ├─ weekly_preview — понеділок, 0 статей цього тижня
    ├─ weekly_summary — п'ятниця, 0 статей цього тижня
    └─ null          — genuinely quiet, log and exit
```

---

## Self-Work система

### Типи self-work

| Тип | Коли | Модель | Зберігається як |
|-----|------|--------|-----------------|
| `bootstrap` | 0 статей в пам'яті | sonnet-4-5 | `context` — завжди в контексті |
| `event_preview` | завтра FOMC/CPI/PCE/NFP | haiku | `article` |
| `weekly_preview` | понеділок, wrote=0 | haiku | `article` |
| `weekly_summary` | п'ятниця, wrote=0 | haiku | `article` |

### Bootstrap article — особливий режим
- Пишеться **незалежно від score** (threshold = 0)
- Argumentative frame — починається з позиції, не з autobio
- Приклад: *"The Yield Curve Just Un-Inverted. The Market Is Reading It Wrong."*
- Зберігається як `memory_type: 'context'` → завжди підтягується в контекст
- Це і є "жива пам'ять" Олени — її аналітична база для всіх наступних статей

---

## Пам'ять (persona_memory)

```sql
memory_type = 'context'   -- bootstrap manifesto, завжди в контексті
memory_type = 'article'   -- звичайні статті, останні 5
memory_type = 'forecast'  -- (зарезервовано, не реалізовано)
memory_type = 'position'  -- (зарезервовано, не реалізовано)
```

**buildContext() повертає:**
```
=== Elena's established framework (always in context) ===
[bootstrap article excerpt — її аналітична позиція]

=== Recent articles ===
- [title] [topic: fed_language]
- [title] [topic: cpi_data]
...
```

---

## Розклад (Vercel Cron)

```
vercel.json: { "path": "/api/cron/elena", "schedule": "0 8 * * *" }
```

**Типовий тиждень:**

| День | Macro quiet | Macro event |
|------|-------------|-------------|
| Понеділок | weekly_preview | event article |
| Вівторок–Четвер | silent (log) | event article |
| П'ятниця | weekly_summary | event article |
| День перед FOMC/CPI | event_preview | event article |
| FOMC/CPI день | score 80-95 → пише | — |

---

## DB Tables (Supabase)

```sql
personas          -- конфіг: system_prompt, eval_prompt, config JSON, is_active
persona_memory    -- пам'ять: content, metadata, embedding vector(1536) nullable
persona_runs      -- лог запусків: score, reasoning, topic, article_slug
```

Seed: `supabase/seed_personas.sql` — INSERT для elena-voss з `is_active=false`.
Для активації: `UPDATE personas SET is_active=true WHERE id='elena-voss'`.

---

## Sanity Schema

Додано до `article` document type:
```typescript
{ name: 'persona',      type: 'string' }  // 'elena-voss'
{ name: 'authorName',   type: 'string' }  // 'Elena Voss'
{ name: 'authorAvatar', type: 'string' }  // '/authors/elena-voss.png'
```

Показується в byline на сторінці статті.

---

## Admin Panel

**Вкладка "✎ Personas"** у `/admin/flows`:

| Кнопка | Що робить |
|--------|-----------|
| Pull Data | Витягує FRED + SEC + CoinGecko, показує всі числа |
| Evaluate | Запускає should_write, показує score + reasoning |
| Dry Generate | Генерує статтю без публікації, preview body + telegram |
| Self-Work | Визначає і виконує self-work task (bootstrap/preview/summary) |
| ▶ Full Run | Повний пайплайн з публікацією |
| Toggle Active | Вмикає/вимикає автоматичний cron запуск |
| Load (Recent Runs) | Показує останні 10 запусків з persona_runs |

---

## Публічні сторінки

- `/author` — каталог авторів (Elena активна, Marcus/Leo "Soon")
- Byline на статтях показує ім'я та аватар персони

---

## Промти

### should_write (eval)
- Модель: `claude-haiku-4-5-20251001`
- Input: FRED data + SEC filings + calendar event + recent summaries
- Output JSON: `{ should_write, score, reasoning, topic, primary_signal, calendar_event }`
- Calendar override: HIGH_PRIORITY_DATES в `should-write.ts` та `self-work.ts`

### generate (event-driven article)
- Модель: `claude-sonnet-4-5`
- System prompt: повний в `generate.ts` — background, writing rules, structure template
- Input: macro data + eval result + context (bootstrap + recent articles)
- Output JSON: `{ title, excerpt, body, metaTitle, metaDescription, tags, category, telegramText }`

### bootstrap (self-work)
- Argumentative frame — не autobio, не framework lecture
- Структура: cold open з позицією → argument → counterargument → verdict
- Заборонено: "This isn't a trading newsletter", "Watch X" без відповіді, forward-looking meta
- Зберігається як `context` memory

---

## Відомі особливості

**DTWEXBGS vs DXY:** FRED's `DTWEXBGS` — це Broad Dollar Index (~118), не класичний DXY (~99-105). Для Олени підходить (ширша міра dollar strength), але в статтях Claude позначає як "USD Broad Index", не "DXY".

**pgvector:** Колонка `embedding vector(1536)` в `persona_memory` nullable — додана під майбутній semantic search. IVFFlat індекс закоментований в migration_010.sql, розкоментувати після першого батчу embeddings.

**Перша стаття:** bootstrap article зберігається як `memory_type='context'`. Це фундамент — при кожному наступному запуску Олена "знає" свою аналітичну базу. Видаляти не варто.
