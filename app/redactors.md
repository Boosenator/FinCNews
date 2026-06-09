# FinCNews — AI Editorial System
**Статус:** Production · finc.news

Автономна редакція з трьох AI-аналітиків і головного редактора. Кожна персона — окремий агент зі своїм характером, джерелами даних, логікою рішень і пам'яттю. Публікують без участі людини.

---

## Три персони

### Marcus Webb — On-chain Data Analyst

**Портрет:** 8 років institutional finance (fixed income, systematic strategies), 6 у крипті, 4 роки on-chain surveillance в хедж-фонді. Зайшов у крипту бо "дані тут чесніші ніж в equity." Ніколи не гадає — або аномалія є в даних, або немає теми.

**Переконання:** *Markets are flows. Everything that moves leaves an on-chain trace. If the data isn't showing an anomaly — there is nothing to write about today.*

**Голос:** Сухий, без емоцій. Тест: *чи це читалось би на Bloomberg терміналі?* Ніколи: suggests / could mean / might / bullish / bearish / interesting. Завжди: джерело в дужках після кожної метрики ("Exchange inflows (CoinGlass)...").

**Структура статті:** `## The Signal / ## On-Chain Context / ## Historical Precedent / ## What to Watch`

**Дані (pullMarcusData):**
- BTC price, volume 24h, dominance — CoinGecko
- Exchange netflow (BTC) — CoinGlass
- Miner outflows (BTC) — CoinGlass
- Mempool tx count, avg fee rate — mempool.space
- BTC hashrate (TH/s) — mempool.space
- Fear & Greed Index — alternative.me

**Пише коли:** одна або більше метрик відхилилась на ≥1.8σ від 30-денного baseline.

---

### Elena Voss — Macro Bear

**Портрет:** 12 років TradFi — Deutsche Bank (fixed income), потім macro в European family office. В крипту прийшла 2021 через клієнтський allocation. Скептик щодо *таймлайну*, не щодо існування крипти.

**Переконання:** *BTC is a risk asset. Until the Fed pivots and stays pivoted — crypto operates in the same liquidity environment as every other risk asset.*

**Голос:** Академічний, точний, TradFi perspective. Відкриває статтю з конкретного числа або дослівної цитати Fed. Ніколи: "moon", "rekt", "ape in", "community believes". Коли невизначеність — "the data doesn't resolve this yet", ніколи не фабрикує впевненість.

**Структура статті:** `## Context / ## What Changed / ## Macro Implications / ## What to Watch`

**Дані (pullElenaData):**
- Fed Funds Rate — FRED
- CPI YoY — FRED
- Core PCE — FRED
- 10Y Treasury Yield — FRED
- 2Y Treasury Yield — FRED
- Yield Curve Spread (10Y-2Y) — обраховується
- USD Broad Index (DTWEXBGS) — FRED
- BTC 24h change — CoinGecko
- SEC filings (crypto-related, останні 48h) — SEC EDGAR

**Пише коли:** день виходу макро-даних (CPI, FOMC, PCE, NFP), значний рух yields (>15bps), DXY ±0.8% з протилежним BTC рухом, SEC enforcement action.

**Calendar override:** у `HIGH_PRIORITY_DATES` (в `should-write.ts` і `generate.ts`) захардкоджені дати FOMC/CPI/PCE/NFP. Якщо є подія сьогодні або вчора і score < 70 — score примусово стає 70 і should_write = true. Elena пише на кожному FOMC/CPI/PCE незалежно від оцінки ринку.

**Обслуговування:** дати треба оновлювати вручну щоквартально. Перевіряти по офіційному Fed календарю. Якщо всі дати в минулому — calendar override не спрацьовує взагалі.

---

### Leo Cruz — Narrative Hunter

**Портрет:** Зайшов у DeFi Summer 2020, втрачав поки не зрозумів: торгує не токени, а наративи. 5 років вивчає як вони народжуються, ростуть і вмирають.

**Переконання:** *Price follows narrative → narrative follows attention → attention is measurable.*

**Голос:** Живо, провокаційно. Відкриває з hook — дивний факт, гостре питання або "remember when X? It's happening again." Тест: *чи хтось поширить це в своєму груп-чаті до відкриття ринку?* Ніколи: defensive disclaimers, "Watch X" без свого вердикту, price targets, "this will 10x".

**Структура статті:** `## The Narrative Shift / ## What the Data Shows / ## Where This Has Been Before / ## The Signal to Watch`

**Дані (pullLeoData):**
- Trending coins (top-7 by CoinGecko score) — CoinGecko
- Fear & Greed Index + 7d delta — alternative.me
- Sentiment breakdown (positive/negative/neutral) — LunarCrush / CryptoPanic
- Reddit hot posts (r/CryptoCurrency і ін.) — Reddit API
- DEX boosts — DEXScreener
- Social scores per coin — LunarCrush

**Пише коли:** 2+ незалежних сигнали підтверджують новий наратив, або наратив явно вмирає (rotation), або різкий sentiment shift (Fear & Greed ±15+ за 7 днів).

---

## RSS Pipeline

Запускається двічі: Collect (*/30 хв) і Generate (0 * * * *).

### Collect (кожні 30 хвилин)

**Крок 1. RSS fetch + фільтрація**
Тягне RSS-стрічки, відкидає: старіше 12 годин, не-фінансові статті (без ключових слів), дублікати за URL.

**Крок 2. AI Scoring (Haiku, 0–100)**
Кожна новина отримує score:
- ≥80 → `breaking` — fast lane, пріоритетна черга, dynamic maxArticles
- 60–79 → `standard` — звичайна черга, maxArticles=2 per run
- <60 → drop, не зберігається

**Крок 3. Семантична дедуплікація**
Нова новина порівнюється з `coverage_log` через embeddings (cosine similarity):
- >0.85 → дублікат → drop
- 0.65–0.85 → continuation: нова новина — продовження вже покритої теми → пишеться тією персоною, що писала оригінал
- <0.65 → нова тема → іде на триаж

### Generate (0 * * * * — кожну годину)

**Крок 4. Triаж (Sonnet)**
Для кожної новини в черзі вирішує:
- Яка персона пише (по темах з таблиці нижче)
- Який кут подачі (angle)
- Терміновість
- `expires_at` — до якого часу тема актуальна

| Персона | Теми |
|---------|------|
| Elena | macro, Fed, регуляторика, DXY, yields, SEC enforcement |
| Marcus | on-chain flows, exchange data, whale activity, miner behavior |
| Leo | narrative shifts, trending tokens, sentiment, retail psychology |

Tiebreaker якщо тема підходить кільком: cosine proximity в `coverage_log`.

**Крок 5. Staleness check**
- Новина в черзі >2 годин → Haiku переоцінює актуальність
- `expires_at` минув → drop

**Крок 6. Будується контекст персони**
(Детально в секції "Контекст генерації" нижче)

**Крок 7. Генерація (3 проходи Sonnet)**
1. Angle discovery — який кут подачі найсильніший
2. Draft — повна стаття
3. Critique — самокритика і виправлення

**Крок 8. Victor Kane pre-publish**
Головред переглядає чернетку. Рішення: `approve` / `edit` / `block`.
Block — тільки при явній фабрикації або дублікаті.

**Крок 9. Публікація**
Sanity → Telegraph → Pexels → Telegram (фіксований порядок)

**Крок 10. Оновлення пам'яті**
- Стаття зберігається в `persona_memory` з embedding
- `coverage_log` оновлюється

---

## Proactive Pipeline

Персони запускаються по розкладу незалежно від RSS.

| Cron | Персона | Час UTC |
|------|---------|---------|
| `/api/cron/marcus` | Marcus Webb | 07:00 + 13:00 |
| `/api/cron/elena` | Elena Voss | 08:00 |
| `/api/cron/leo` | Leo Cruz | 10:00 |
| `/api/cron/chief-editor` | Victor Kane | 21:00 |

### Флоу Marcus Webb

**0. is_active check** — якщо персона вимкнена в БД → стоп, повертає `skippedInactive: true`.

**0b. Already wrote today** — у Marcus два кронних запуски на день (07:00 і 13:00). Перед кожним запуском перевіряє `persona_runs` за сьогодні: якщо є запис з `should_write=true` → стоп, повертає `skippedAlreadyWrote: true`. Пише максимум одну статтю на день.

**1. Data pull** — тягне всі on-chain метрики з CoinGlass, mempool.space, CoinGecko, alternative.me.

**2. Baseline** — завантажує 30-денний rolling baseline (`memory_type: baseline`). Кожна метрика зберігає масив останніх 30+ значень, з яких рахуються mean і std.

**3. Detect anomalies** — для кожної з 6 метрик обчислюється z-score проти baseline. Поріг THRESHOLD = 1.8σ. Повертає відсортований список аномалій від найсильнішої до найслабшої.

Метрики і джерела:
- BTC Exchange Netflow (CoinGlass) — позитивне = приплив на біржі (bearish)
- BTC Volume vs 30d avg (CoinGecko)
- BTC Hashrate (mempool.space)
- Mempool Tx Count (mempool.space)
- Fear & Greed Index (alternative.me)
- Miner Outflows (CoinGlass)

`areCorrelated(a, b)` — перевіряє чи два аномальних сигнали показують в одному ринковому напрямку (обидва bearish або обидва bullish).

**4. Save signal snapshot** — зберігається завжди, незалежно від рішення писати. Містить top-3 аномалії з z-scores.

**5. Build context** — (детально нижче)

**6. shouldWrite (Haiku)**
Детерміністичний алгоритм:
- Якщо baseline.samples < 7 → score=0, не пише (baseline ще накопичується)
- Якщо жодна метрика не перевищує 1.8σ → score=15, не пише ("All metrics within 1.8σ. Routine session.")
- Якщо основна метрика вже покрита за останні 72h і немає другої аномалії → score=35, не пише
- 1 аномалія ≥1.8σ → base_score=64
- 2+ аномалії, не корельовані → base_score=72
- 2+ аномалії, корельовані (один напрям) → base_score=82
- Бонус: +5 за кожні 0.2σ понад 1.8, максимум 95

Потім Haiku підтверджує score і формулює topic + reasoning (одне речення).

**7. score ≥ 60** → buildVerifiedHistory → generateMarcusArticle → generateMarcusCover → publishToSanity → save to persona_memory → fire-and-forget: saveEmbedding + extractForecast + extractPosition + **updateBaseline**

**8. score < 60** → self-work (базові задачі без публікації: оновити baseline, перевірити прогнози)

---

### Флоу Elena Voss

**0. is_active check**

**1. Data pull** — FRED API: Fed rate, CPI, PCE, yields, DXY. SEC EDGAR: crypto filings останні 48h. CoinGecko: BTC 24h.

**2. Save signal snapshot** — зберігається відразу після pull, ще до рішення писати.

**3. Build initial context**

**4. shouldWrite (Haiku)**
- `checkCalendar()` перевіряє `HIGH_PRIORITY_DATES` за сьогодні і вчора
- Haiku оцінює дані і повертає score + primary_signal

`primary_signal` може бути: `fed_language | cpi_data | pce_data | yield_curve | dxy_move | sec_action | btc_correlation | calendar_event`

Score guide:
- FOMC/CPI/PCE/NFP release day: 80–95
- Yield curve move >15bps за день: 65–80
- DXY ±0.8% з протилежним BTC: 60–75
- SEC crypto enforcement/rule: 60–75
- Тихий макро-день: 10–35

**Calendar override:** якщо є подія в `HIGH_PRIORITY_DATES` і score < 70 → примусово score=70, should_write=true.

**5. score ≥ 60** → Rebuild context з відомою темою (semantic search точніший) → buildVerifiedHistory → generateElenaArticle → generateElenaCover → publishToSanity → save → fire-and-forget: saveEmbedding + extractForecast + extractPosition

**6. score < 60** → self-work

---

### Флоу Leo Cruz

**0. is_active check**

**1. Data pull** — LunarCrush, CoinGecko trending, Reddit, DEXScreener, alternative.me.

**2. Load narrative history** — завантажує всі активні наративи (не `dead`) з `persona_memory`.

**3. Fetch prev snapshot coins** — останній `signal_snapshot` → масив `{id, score}` трендових монет з попереднього запуску.

**4. Detect signals** — 5 типів сигналів:

| Тип сигналу | Коли спрацьовує | Strength |
|-------------|-----------------|---------|
| `new_trending` | Монета вперше з'являється в CoinGecko top-7, ще не відстежується | 40–80 |
| `sentiment_shift` | Fear & Greed змінився на ±15+ за 7 днів | 50–90 |
| `fading_narrative` | Наратив був growing/peak, але зникнув з trending | 60–75 |
| `rotation` | Є fading + є new_trending одночасно | 85 (завжди) |
| `reddit_buzz` | Монета згадується в 3+ Reddit hot posts | 40–70 |

`rankDelta` = prevScore - currentScore. Позитивне = монета покращила позицію. Передається в опис сигналу для контексту.

Rotation завжди ставиться першим, потім сортування за strength.

**5. Save signal snapshot** — trending coins з scores, F&G, sentiment, top signals.

**6. Build context**

**7. shouldWrite (Haiku)**
Score guide:
- Rotation (fading + new emerging): 80–90
- New narrative, 3+ signals: 75–85
- Clear peak warning: 70–80
- Sentiment shift + trending: 65–75
- Single unconfirmed spike: 40–55
- Neutral day (F&G 40–60, нічого нового): 10–35

**8. score ≥ 60** → Rebuild context → buildVerifiedHistory → generateLeoArticle → generateLeoCover (з cycle_stage) → publishToSanity → save → fire-and-forget: saveEmbedding + markNarrativeCovered + **updateNarrativeTracker**

**9. score < 60** → self-work (ЗАВЖДИ оновлює narrative tracker)

---

### Narrative Tracker (Leo)

Leo відстежує lifecycle кожного наративу без LLM — чиста логіка. Зберігається в `persona_memory` (`memory_type: narrative`).

**Стадії:** `emerging → growing → peak → fading → dead`

**Логіка переходів** (оновлюється після кожного запуску):

```
Монета є в trending:
  - < 3 днів → emerging
  - 3–7 днів + score не падав від піку → growing
  - 3–7 днів + падає від піку → peak
  - 7+ днів + ≥65% від peak_score → peak
  - 7+ днів + <65% від peak_score → fading

Монета зникла з trending:
  - була emerging → dead (одразу)
  - була growing → fading
  - була peak → fading
  - була fading + <12% від peak_score → dead
  - була fading + ≥12% → залишається fading (може повернутись)
```

Rolling 3-денний avg для плавніших переходів (щоб 1-денний дип не вбивав наратив).

Після публікації статті про наратив → `markNarrativeCovered()` додає slug в `articlesWritten[]`.

---

## Контекст генерації

Що бачить кожна персона в промпті перед написанням статті.

### Спільні шари (всі три персони)

**1. Аналітичний фундамент** (`memory_type: context`) — постійний bootstrap-маніфест персони. Зберігається вручну при первинному налаштуванні. Marcus: "on-chain framework". Elena: "analytical foundation". Leo: "narrative framework". Підвантажується в кожен запуск.

**2. Останні 5 власних статей** (хронологічно, `memory_type: article`) — заголовок + тема. Щоб не повторювати теми.

**3. Semantic search** (pgvector, top-4) — якщо відома тема (після `shouldWrite`), шукає найближчі за смислом опубліковані статті. Similarity в % показується поряд.

**4. Victor Kane блок** — останній feedback + активна директива (детально нижче).

**5. Verified Historical Record** — (детально нижче).

### Elena — додаткові шари

**Current position** (`memory_type: position`):
- stance: "bearish on BTC near-term" / "neutral on risk assets" / etc.
- on: актив або тема позиції
- regime: поточний макро-режим
- conviction: рівень впевненості

Витягується автоматично після кожної публікованої статті через `extractAndSavePosition()`. Elena бачить свою поточну позицію і не суперечить сама собі без нових даних.

**Open forecasts** (`memory_type: forecast`):
Кожна стаття Elena може містити implicit forecast ("якщо CPI вийде нижче 3% — BTC відреагує позитивно"). `extractAndSaveForecast()` витягує і зберігає з metadata: metric, direction, magnitude, status (open/resolved). Elena бачить свої відкриті прогнози і track record.

### Leo — додатковий шар

**Active narrative tracker** (`memory_type: narrative`, тільки не-dead):
Список живих наративів з lifecycle stage і кількістю написаних статей. Leo бачить що вже covered і на якій стадії.

---

## Верифікована історія (Anti-hallucination)

Система захисту від вигаданих фактів. Перед генерацією кожна персона отримує `=== VERIFIED HISTORICAL RECORD ===`.

### 4 шари (`lib/personas/verified-history.ts`)

**Шар 1. Curated known events** — вручну складені, верифіковані списки. Тільки події зі стовідсотково відомими числами.

**Marcus** (on-chain events):
```
[2020-03-12] COVID crash: BTC $3,800. Exchange inflows spiked. Fear&Greed: 8.
[2021-02-21] BTC $58,000 peak before 50% correction. Miner outflows elevated 3 weeks prior.
[2021-11-10] BTC ATH: $69,000. Fear&Greed: 84. Exchange reserves multi-year low.
[2022-05-12] LUNA/UST collapse. BTC $36k→$26k in 72h. Exchange inflows +80k BTC.
[2022-06-18] BTC $17,600 (3AC/Celsius). Miner capitulation: hashrate -17%.
[2022-11-11] FTX bankruptcy. BTC $16,000. Netflows +45k BTC in 48h. Fear&Greed: 6.
[2024-01-10] Spot ETF approved. BTC ~$46k. Exchange reserves dropped sharply.
[2024-03-14] BTC ATH: $73,700. Miner outflows elevated pre-halving.
[2024-04-20] BTC halving (block 840,000). Block reward: 3.125 BTC.
[2025-01-20] BTC ATH: $109,000 (Trump inauguration). Exchange reserves near all-time low.
```

**Elena** (Fed/macro events):
```
[2020-03-15] Fed emergency cut to 0–0.25%. QE $700B.
[2021-11-03] Fed taper announcement. BTC peaked $69k same week.
[2022-03-16] Fed first hike: +25bp. Start of fastest hiking cycle since 1980.
[2022-06-15] Fed +75bp (first jumbo). BTC $20,000. DXY 105.
[2022-09-13] CPI 8.3% (hotter than expected). BTC -10% in 1 hour. DXY 110.
[2023-07-26] Final hike: 5.25–5.5%. Core PCE: 4.2%. 10Y: 3.9%.
[2024-09-18] First cut: -50bp to 4.75–5.0%. Core PCE at 2.7%.
[2024-12-18] Cut to 4.25–4.5%. Dot plot: 2 cuts в 2025.
[2025-01-29] Fed held at 4.25–4.5%. No cut signal.
[2025-03-12] CPI 2.8% YoY. Core PCE 2.6%. 10Y yield: 4.3%.
```

**Leo** (narrative events):
```
[2020-06] DeFi Summer: COMP launch, total DeFi TVL 10x в 3 місяці.
[2021-04-14] Coinbase IPO ($100B). "Crypto mainstream" narrative peaked.
[2022-05-12] LUNA collapse — "algorithmic stablecoin" narrative мертвий назавжди.
[2022-11-11] FTX collapse — self-custody narrative народився.
[2023-02-14] Ordinals/Bitcoin NFT — Bitcoin as L1 vs store of value debate.
[2023-06] AI×crypto narrative (Worldcoin, Fetch.ai) — ChatGPT mainstream effect.
[2024-01-10] Spot ETF — "institutional on-ramp" narrative замінив спекуляцію.
[2024-11-06] Trump election — "crypto-friendly administration". BTC $75k same day.
[2025-01-20] BTC ATH $109k. Meme coin supercycle (TRUMP, MELANIA). Faded in weeks.
```

**Шар 2. Власні опубліковані статті** (останні 20, `memory_type: article`, з датами і темами)

**Шар 3. Командний coverage log** (всі три персони, останні 60 днів, з датами і persona_id)

**Шар 4. Signal snapshots** (останні 14 днів реальних ринкових показників, перші 3 рядки кожного)

### Правила в промптах (non-negotiable)

| Персона | Правило |
|---------|---------|
| Marcus | "Never invent specific dates, z-scores, or metric values from the past. If you don't have the data — say 'historically, comparable deviations have preceded...' without fabricating." |
| Elena | "Never fabricate specific CPI readings, yield levels, or BTC price points. If you don't have exact data — describe the regime without the number." |
| Leo | "Fabricated historical examples: specific dates, token tickers, or price events you did not receive in TODAY'S SIGNALS or CONTEXT are prohibited. Use only well-known verifiable events." |

Логіка проста: є верифікований факт → цитуй точно. Нема → опиши паттерн або режим без цифр.

---

## Victor Kane — Chief Editor

20 років у фінансовій журналістиці: Reuters, Bloomberg Opinion. Управляє автономними AI-агентами — ніхто не читає його фідбек вручну. Директива вбудовується в системний контекст перед наступною генерацією. Єдиний спосіб змінити поведінку — чітка структурна інструкція яку LLM може виконати автономно.

**Заборонені директиви** (не можуть бути виконані автономно):
- "banned", "suspended", "on probation"
- "Submit draft", "wait for approval", "do not publish until reviewed"
- "Check with editor", "request permission"

Правильна директива: поведінкове обмеження. Наприклад: *"Open with the anomaly value, not a question."* — не: *"Do not publish until approved."*

### Режим 1: Pre-publish (перед кожною статтею)

Відбувається в `generate-desk.ts` для RSS і в кожному persona index.ts для proactive.

Victor бачить: чернетку + signal snapshot (2 останніх) + активну директиву.

**Три типи фідбеку в контексті персони:**
- `Priority fix` → одна конкретна річ яку треба виправити в *цій* статті прямо зараз
- `Directive` → постійна інструкція зі статусом `pending` в таблиці `editorial_directives` — застосувати негайно
- `Pattern warning` → уникай цього відкриття або структури

Всі три перевизначають дефолтні патерни персони. В промпті: *"Victor Kane's feedback overrides your default patterns. Ignoring it is not an option."*

Рішення: `approve` / `edit` / `block`. Block — тільки явна фабрикація або дублікат.

### Режим 2: Nightly review (21:00 UTC)

Повний редакційний сеанс після всього дня. Детальний флоу:

**Крок 0. is_active check**

**Крок 1. collectData (без LLM)**
Збирає по кожній персоні:
- `todayArticle` — стаття опублікована сьогодні (якщо є)
- `last5Articles` — останні 5 статей (для pattern detection)
- `recentFeedback` — останній feedback з `editor_feedback`
- `directives` — активні pending директиви з `editorial_directives`

**Крок 2. Quiet desk check**
Якщо жодна персона не публікувала сьогодні → логується "Quiet desk" → стоп.

**Крок 3. verifyPreviousDirectives (без LLM)**
Для кожної персони що публікувала: перевіряє чи описана проблема з попередньої директиви присутня в новій статті. Логує `directive_followed: true/false` в `persona_runs`.

**Крок 4. detectOverlap (без LLM)**
Якщо публікувало 2+ персони — порівнює їх статті через embeddings (title + excerpt). Cosine similarity ≥0.6 → overlap pair. Victor бачить це при оцінці.

**Крок 5. detectPatterns (без LLM)**
Для кожної персони перевіряє 3 типи паттернів:
1. **Повторюваний початок** — перші 3 слова статті збігаються в 3+ статтях з останніх 6
2. **Повторювана тема** — та сама тема-ключова-фраза 3+ рази за останні 7 статей (exchange/inflow, yield curve, fomc, miner/hashrate, тощо)
3. **Слабке закінчення** — кінцівка без конкретного числа/порогу, або кінцівка з питальним знаком

**Крок 6. evaluateAnalyst × N (Sonnet, паралельно)**
Кожна персона оцінюється окремим Sonnet-викликом одночасно.

**Baseline mode** (перша стаття від персони, `recentFeedback.length === 0`):
- Score тільки по якості статті як standalone piece
- Guide: 55=needs work · 65=solid debut · 75=strong debut · 85+=exceptional
- Перша директива — встановлює стандарт, не покарання
- Ніколи: "ignored directive", "compliance failure" (не було попередніх очікувань)

**Normal mode:**
- Враховує directive compliance: чи виправлена проблема з попередньої директиви
- Якщо директива була active і проблема залишилась → знижується score

**Scoring rubric (20 балів кожен = 100):**
1. Thesis clarity — один чіткий, аргументований тезис?
2. Data specificity — названі метрики з числами, джерело вказане?
3. Voice consistency — звучить як ЦЯ персона, а не generic?
4. Signal value — корисно і ново для читача?
5. Conclusion strength — конкретне що спостерігати з порогом, не питання?

Повертає: score (0–100), strengths (max 2), priority_fix (одне речення), directive (інструкція для наступної статті), pattern_warning або null.

**Крок 7. synthesizeDeskNote (Haiku)**
Один виклик Haiku по всіх scorecards разом. Пише 1–2 речення про desk як ціле: загальний тренд якості, cross-persona динаміка, що потрібно редакції як продукту. Не про окремі статті — вони вже в scorecards. Правило точності: якщо пише про числа — перевіряє проти реальних scores.

**Крок 8. Збереження**
- `saveToEditorialTables` → `editorial_directives` + `editorial_scores`
- `saveFeedbackToAnalysts` → `persona_memory` (`memory_type: editor_feedback`) для кожної персони
- `saveEditorSession` → Victor's own session log
- `updateEditorialStandards` → накопичувані стандарти редакції

---

## Пам'ять системи

Вся пам'ять зберігається в таблиці `persona_memory`. Поле `memory_type` визначає тип.

| memory_type | Що зберігає | Хто читає |
|-------------|-------------|-----------|
| `article` | Опубліковані статті: title + excerpt + slug + tags | Всі — для dedup і контексту |
| `context` | Bootstrap-маніфест персони (постійний) | Всі — в кожен запуск |
| `signal_snapshot` | Ринкові показники на момент запуску | Victor Kane (last 2), rankDelta (Leo) |
| `forecast` | Прогнози з статей Elena і Marcus: metric, direction, magnitude, status | Elena, Marcus — track record |
| `position` | Поточна позиція Elena: stance/on/regime/conviction | Elena — щоб не суперечити собі |
| `narrative` | Lifecycle наративів Leo: stage + trendScores + articlesWritten | Leo — narrative tracker |
| `baseline` | 30-денний rolling baseline Marcus з масивами значень | Marcus — для z-scores |
| `editor_feedback` | Оцінки від Victor Kane: score, priority_fix, directive, pattern_warning | Всі — через buildVictorKaneContext |

### Embeddings і semantic search

Кожна стаття після публікації отримує embedding через OpenAI. Зберігається в `persona_memory` поряд з записом статті. При наступних генераціях: якщо відома тема — `searchSimilarMemories(personaId, topic, 4)` повертає top-4 найближчих за смислом попередніх статей з similarity%.

Використовується в:
- Контекст генерації (щоб не повторювати кут подачі)
- `detectOverlap` у Victor Kane (cross-persona overlap)
- Семантична дедуплікація в RSS pipeline

### Forecasts lifecycle (Elena і Marcus)

`extractAndSaveForecast()` — після публікації витягує implicit прогнози з тексту. Зберігає з `status: open`. При наступних запусках `getForecastContext()` підвантажує відкриті прогнози і перевіряє їх проти нових ринкових даних. Якщо умова виконалась → `status: resolved`. Elena і Marcus бачать свій track record.

---

## Публікація

**Фіксований порядок:** Sanity (CMS) → Telegraph (стаття) → Pexels (фото обкладинки) → Telegram (пост)

**Telegram caption:**
```
🚨 BREAKING  ← тільки якщо breaking

<b>Заголовок</b>

Excerpt 1-2 речення

Full story 👇
https://telegra.ph/...

By <a href="finc.news/author/...">Ім'я Персони</a>
#bitcoin #crypto #FinCNews
```

---

## Email System

### Inbound

**Домен:** `@e.finc.news` (MX → Resend inbound)

**Флоу:**
```
Лист на *@e.finc.news
  → Resend отримує, зберігає
  → Webhook POST /api/webhook/inbound-email?secret=...
      auth: RESEND_INBOUND_SECRET query param
  → loadRoutes() з email_routes
  → resolveRoute(): точний match → wildcard * → null (skip)
  → fetch body: GET resend.com/emails/receiving/{email_id}
  → forward via resend.emails.send()
      subject: [finc.news > {mailbox}] Original Subject
      replyTo: from address
  → log в inbound_email_logs
```

**Поточні маршрути:** editorial · privacy · legal · ads · tech · `*` (catch-all)

### Outbound

**Домен:** `@e.finc.news` (ізольований від finc.news для репутації)
**Типи:** `confirmation / welcome / breaking / digest`
**Логування:** `email_logs`

---

## DB Migrations

| Файл | Статус | Суть |
|------|--------|------|
| `migration_017.sql` | ✅ Applied | coverage_log + article_queue triage columns |
| `migration_018.sql` | ✅ Applied | Backfill persona_runs для RSS статей |
| `backfill_elena.sql` | ✅ Applied | Elena Voss RSS article backfill |
| `backfill_marcus.sql` | ✅ Applied | Marcus Webb RSS articles backfill |
| `fix_leo_directive.sql` | ✅ Applied | Leo Cruz directive race condition fix |
| `migration_019.sql` | ✅ Applied | `inbound_email_logs` + `email_routes` tables |

---

## Ключові файли

```
lib/automation.ts                           — RSS collect + score + dedup + queue
lib/automation/triage.ts                    — persona assignment + urgency
lib/automation/generate-desk.ts             — RSS article generation (3-pass Sonnet)
lib/automation/coverage-log.ts              — coverage_log read/write
lib/automation/staleness-check.ts           — expires_at + age validation

lib/personas/verified-history.ts            — curated events + buildVerifiedHistory()
lib/personas/embeddings.ts                  — saveEmbedding + searchSimilarMemories

lib/personas/elena-voss/index.ts            — proactive pipeline + signal_snapshot
lib/personas/elena-voss/data-pull.ts        — FRED + SEC + CoinGecko pull
lib/personas/elena-voss/should-write.ts     — calendar check + Haiku eval
lib/personas/elena-voss/generate.ts         — Sonnet generation + SYSTEM_PROMPT
lib/personas/elena-voss/forecasts.ts        — extract + track forecasts
lib/personas/elena-voss/position.ts         — current position extraction
lib/personas/elena-voss/self-work.ts        — tasks when score < 60

lib/personas/marcus-webb/index.ts           — proactive pipeline + baseline update
lib/personas/marcus-webb/data-pull.ts       — CoinGlass + mempool.space + CoinGecko
lib/personas/marcus-webb/baseline.ts        — 30-day rolling baseline + zScore()
lib/personas/marcus-webb/anomalies.ts       — detectAnomalies + areCorrelated
lib/personas/marcus-webb/should-write.ts    — deterministic z-score → Haiku confirm
lib/personas/marcus-webb/generate.ts        — Sonnet generation + SYSTEM_PROMPT
lib/personas/marcus-webb/forecasts.ts       — extract + track forecasts
lib/personas/marcus-webb/self-work.ts       — tasks when score < 60

lib/personas/leo-cruz/index.ts              — proactive pipeline + narrative tracker
lib/personas/leo-cruz/data-pull.ts          — LunarCrush + CoinGecko + Reddit
lib/personas/leo-cruz/signals.ts            — detectSignals + rankDelta
lib/personas/leo-cruz/narratives.ts         — NarrativeState lifecycle tracker
lib/personas/leo-cruz/should-write.ts       — signals → Haiku eval
lib/personas/leo-cruz/generate.ts           — Sonnet generation + SYSTEM_PROMPT
lib/personas/leo-cruz/self-work.ts          — tasks when score < 60

lib/personas/chief-editor/index.ts          — Victor Kane nightly orchestrator
lib/personas/chief-editor/data-collector.ts — collect all personas' data
lib/personas/chief-editor/evaluate.ts       — detectOverlap + evaluateAnalyst + synthesizeDeskNote
lib/personas/chief-editor/patterns.ts       — detectPatterns (3 structural checks)
lib/personas/chief-editor/memory.ts         — save/load Victor's memory

app/api/cron/marcus/route.ts                — cron endpoint (07:00 + 13:00)
app/api/cron/elena/route.ts                 — cron endpoint (08:00)
app/api/cron/leo/route.ts                   — cron endpoint (10:00)
app/api/cron/chief-editor/route.ts          — cron endpoint (21:00)
app/api/webhook/inbound-email/route.ts      — Resend inbound webhook
app/api/admin/email-routes/route.ts         — CRUD для email routes
app/(admin)/flows/_components/EmailTab.tsx  — email admin UI
```

---

## Operational Guide

### API Dependencies

Що ламається коли який API недоступний:

| API | Хто залежить | Що відбувається при збої |
|-----|-------------|--------------------------|
| Anthropic Claude | Всі три персони, Victor Kane | Всі cron'и падають з 5xx. Перезапуск автоматичний при наступному cron tick. Vercel логи: `Claude generate failed` / `Claude eval failed`. |
| FRED (stlouisfed.org) | Elena Voss | `pullElenaData()` кидає exception → cron Elena падає цілком. Стаття не пишеться, persona_runs не записується. |
| CoinGlass | Marcus Webb | Exchange netflow і miner outflows = null → z-score для них = 0 → аномалії по цих метриках не детектуються → Marcus може пропустити день без запису помилки. |
| mempool.space | Marcus Webb | Hashrate і mempool tx = null → аналогічно. Marcus не падає, але ефективно сліпий. |
| CoinGecko | Marcus, Elena, Leo | BTC price/volume/trending = null. Marcus: volume ratio = 0x, Leo: trendingCoins = []. Не падає, але аналіз деградує. |
| alternative.me (F&G) | Marcus, Leo | fearGreedIndex = null. Marcus: цей сигнал пропадає. Leo: sentiment shift не детектується. |
| OpenAI embeddings | Всі (post-publish) | `saveEmbedding()` — fire-and-forget, не блокує публікацію. Але без embedding: semantic search деградує, detectOverlap у Victor Kane перестає знаходити overlap. **Тихий збій** — в логах буде помилка, але стаття вийде. |
| SEC EDGAR | Elena Voss | `secFilings` = []. Elena не падає, але SEC enforcement actions не враховуються в shouldWrite. |
| LunarCrush | Leo Cruz | Sentiment = null. Leo не падає, але sentiment_shift сигнали не генеруються. |
| Reddit API | Leo Cruz | Reddit buzz = []. Leo не падає, reddit_buzz сигнали пропадають. |
| Sanity CMS | Всі три персони | `publishArticleToSanity()` кидає exception → стаття НЕ публікується, але Victor review вже відбувся. Cron падає з помилкою. Стаття втрачається (не перезапускається автоматично). |
| Telegraph (telegra.ph) | Всі три персони | Публікація в Sanity вже відбулась. Telegraph link відсутній → Telegram пост без посилання або без Telegraph. |
| Pexels | Всі три персони | Обкладинка не підбирається → Sanity запис без cover image. Не блокує публікацію. |
| Telegram Bot API | Всі три персони | Стаття вже в Sanity. Telegram пост не відправляється. Тихий збій. |
| Resend (email) | Email system | Inbound forwardng не відбувається. Outbound листи не надсилаються. Cron не залежить від цього. |

---

### Failure Modes по кроках

**RSS Collect (*/30 хв)**

| Крок | Що може зламатись | Симптом | Де дивитись |
|------|------------------|---------|-------------|
| RSS fetch | 1+ стрічок недоступна | Решта стрічок обробляється. Мовчазний partial збій. | Vercel функція `/api/cron/rss-collect` logs |
| AI Scoring (Haiku) | Anthropic API down | Весь Collect падає. Черга не поповнюється. | Vercel logs: `Claude eval failed` |
| Embeddings dedup | OpenAI API down | `saveEmbedding` fail → новини проходять без перевірки на дублікати → можливі дублікати в `article_queue` | Vercel logs: embedding error |
| Cosine similarity | pgvector не відповідає | Суаbase timeout → вся дедуплікація пропускається → більше дублікатів | Supabase logs |

**RSS Generate (кожну годину)**

| Крок | Що може зламатись | Симптом | Де дивитись |
|------|------------------|---------|-------------|
| Triage (Sonnet) | Anthropic down | Весь Generate падає. Черга залишається. | Vercel logs |
| generateDeskArticle | Anthropic down | Одна стаття не генерується, але не блокує решту в черзі | Vercel logs: `generateDeskArticle failed` |
| Victor pre-publish | Anthropic down | `victorPrePublishReview()` повертає `approve` (fallback). Стаття виходить без реального review. | Vercel logs: `Victor review failed — auto-approved` |
| publishArticleToSanity | Sanity down | Стаття не виходить. Запис в article_queue залишається. Наступний Generate run може спробувати знову (якщо не `expires_at`). | Vercel logs |

**Proactive crons (07:00/08:00/10:00/13:00)**

| Крок | Що може зламатись | Симптом | Де дивитись |
|------|------------------|---------|-------------|
| Data pull | API недоступне | Elena/Marcus повністю падають. Leo частково деградує. | persona_runs: відсутній запис за день |
| buildVerifiedHistory | Supabase timeout | Повертає порожню verified history. Персона пише без anti-hallucination захисту. **Тихий збій.** | Supabase logs |
| generateArticle | Anthropic down | Cron падає. persona_runs = no write. | Vercel logs |
| Victor pre-publish (self-work) | Anthropic down | `victorPrePublishReview()` повертає approve (fallback). Self-work виходить без review. | Vercel logs |

**Victor Kane nightly (21:00 UTC)**

| Ситуація | Поведінка |
|----------|-----------|
| Жодна персона не публікувала сьогодні | "Quiet desk" → стоп. Нова директива не виставляється. Стара директива залишається pending — може застаріти. |
| Anthropic down | Весь nightly review падає. evaluateAnalyst не відбувається. Директиви за цей день не оновлюються. |
| detectOverlap (embeddings) недоступний | Cross-persona overlap не детектується. Victor пише desk note без цього контексту. |
| Persona не публікувала кілька днів | Victor oцінює статті з минулих днів. Директиви можуть бути неактуальними. |

---

### Де дивитись помилки

**1. Vercel Function Logs**
- Відкрити: Vercel Dashboard → Project → Functions → вибрати функцію → Logs
- Фільтр по часу і рівню (ERROR)
- Ключові функції: `/api/cron/marcus`, `/api/cron/elena`, `/api/cron/leo`, `/api/cron/chief-editor`, `/api/cron/rss-collect`, `/api/cron/rss-generate`

**2. `persona_runs` table (Supabase)**
```sql
-- Останні 24h всіх персон
SELECT persona_id, created_at, should_write, wrote_article, error_message, skipped_reason
FROM persona_runs
WHERE created_at > now() - interval '24 hours'
ORDER BY created_at DESC;

-- Персона не писала сьогодні?
SELECT * FROM persona_runs
WHERE persona_id = 'elena-voss'
AND created_at > current_date
ORDER BY created_at DESC;
```

**3. `article_queue` table (Supabase)**
```sql
-- Що зависло в черзі?
SELECT id, title, persona_id, status, created_at, expires_at
FROM article_queue
WHERE status = 'pending'
ORDER BY created_at ASC;

-- Протухлі новини (expires_at минув):
SELECT * FROM article_queue
WHERE expires_at < now() AND status = 'pending';
```

**4. `coverage_log` table**
```sql
-- Що публікувалось за останні 48h
SELECT title, persona_id, published_at, slug
FROM coverage_log
ORDER BY published_at DESC
LIMIT 20;
```

**5. `editorial_directives` table**
```sql
-- Активні директиви
SELECT persona_id, directive, created_at
FROM editorial_directives
WHERE status = 'pending'
ORDER BY created_at DESC;
```

**Ознаки тихих збоїв (нічого не ламається, але поведінка деградує):**
- `persona_memory` не має нових `signal_snapshot` → data pull не відбувається
- `coverage_log` має статті, але `persona_memory.embedding` NULL → OpenAI embeddings падають
- Victor Kane активна директива старіша за 7 днів → nightly review не відбувається
- Elena `should_write` завжди false на FOMC/CPI дні → `HIGH_PRIORITY_DATES` застаріли

---

### Відомі тихі збої (Silent Failures)

| Збій | Чому тихий | Як виявити |
|------|-----------|------------|
| OpenAI embeddings fail | `saveEmbedding()` fire-and-forget, не кидає в cron | `persona_memory` rows без embedding; semantic search повертає [] |
| buildVerifiedHistory timeout | Повертає порожній рядок, не кидає | Перевірити чи prompt містить `VERIFIED HISTORICAL RECORD` в Vercel logs |
| Victor review fallback | `victorPrePublishReview()` catch → auto-approve | Vercel logs: "Victor review failed — auto-approved" |
| CoinGlass API down | `btcExchangeNetflow = null` → z-score = 0, не аномалія | Marcus не пише навіть при реальній аномалії в netflow |
| Elena HIGH_PRIORITY_DATES застаріли | calendar override не спрацьовує, score залишається <60 | Elena мовчить на FOMC/CPI дні; persona_runs: `should_write: false` |
| Leo narrative tracker не оновлюється | `update_tracker_only` не логується в persona_runs | `persona_memory` narratives мають старі `updated_at` |
| self-work articles до вчора | self-work не мав Victor review (до фікса) | Виправлено: Victor Kane тепер перевіряє всі non-bootstrap self-work |
| RSS "already wrote today" обхід | RSS генерує через `generateDeskArticle()` напряму, минаючи guard | Marcus може написати 2 статті в один день якщо RSS + proactive |

---

### Обслуговування (Maintenance Calendar)

**Щоквартально (обов'язково):**

- [ ] Оновити `HIGH_PRIORITY_DATES` в трьох файлах:
  - `lib/personas/elena-voss/should-write.ts`
  - `lib/personas/elena-voss/generate.ts`
  - `lib/personas/elena-voss/self-work.ts`
  - Перевіряти по: `federalreserve.gov/monetarypolicy/fomccalendars.htm`
  - Якщо всі дати в минулому — calendar override не спрацьовує взагалі

- [ ] Перевірити `KNOWN_EVENTS_*` в `verified-history.ts`:
  - Додати великі події з минулого кварталу (ETF рішення, Fed actions, ATH/ATL)
  - Формат: `[YYYY-MM-DD] Event: Key number. Source fact.`
  - Тільки 100% верифіковані числа. Ніяких приблизних.

**Щомісяця:**

- [ ] Перевірити активні директиви Victor Kane — чи не застаріли (> 14 днів pending без resolve)
- [ ] Перевірити `article_queue` на завислі pending-статті
- [ ] Перевірити `persona_runs` на персони що не писали > 5 днів підряд

**При ротації API ключів:**

| Змінний ключ | Де використовується | Env var |
|-------------|--------------------|---------| 
| Anthropic | Всі LLM виклики | `ANTHROPIC_API_KEY` |
| OpenAI | Embeddings | `OPENAI_API_KEY` |
| CoinGlass | Marcus data pull | `COINGLASS_API_KEY` |
| LunarCrush | Leo data pull | `LUNARCRUSH_API_KEY` |
| FRED | Elena data pull | `FRED_API_KEY` |
| Sanity | CMS publish | `SANITY_API_TOKEN` |
| Telegram | Bot posting | `TELEGRAM_BOT_TOKEN` |
| Resend | Email | `RESEND_API_KEY` |

---

### Юридичні та редакційні ризики

**Фабрикація фактів (hallucination)**

Система має 4 шари захисту (verified history, system prompt rules, critique pass, Victor Kane review), але ризик не нульовий:

- RSS pipeline: Victor може auto-approve якщо Anthropic API тимчасово нестабільний (fallback)
- Якщо `buildVerifiedHistory()` повертає порожнє через timeout → persona пише без anchor
- Critique перевіряє тільки перші 2500 символів body (раніше 1200 — виправлено)
- Marcus RSS prompt раніше мав "If real-time data isn't available, cite the pattern context" — запрошував до фабрикації. **Виправлено.**

**Якщо виявлена стаття з фабрикованими фактами:**
1. Видалити з Sanity (неопублікувати або видалити)
2. Видалити Telegram пост якщо вийшов
3. Заблокувати персону в БД (`is_active = false`)
4. Додати event в `KNOWN_EVENTS_*` якщо факт стосується реальної події

**Авторські права на зображення**

Pexels — ліцензія Pexels License (безкоштовно, без атрибуції). Але Telegraph embeds зовнішні URL — якщо Pexels видалить фото, Telegraph посилання зламається.

**Ринкові поради і disclaimer**

Жодна персона не робить price predictions і не каже "buy/sell". Elena: "the data doesn't resolve this yet". Marcus: тільки "what to watch" з порогом. Leo: "the signal to watch", не торгові рекомендації.

Але: forecasts (`memory_type: forecast`) містять implicit directional calls. Якщо домен набере трафіку — варто додати явний disclaimer на рівні сайту.

**GDPR і email**

Email підписники отримують тип листа `welcome` і `digest`. Opt-in у формі підписки — переконайтесь що він explicit. Resend зберігає email у своїй БД. `email_logs` в Supabase — не видаляються автоматично.

---

### Відмінності: RSS pipeline vs Proactive pipeline

| Аспект | RSS Pipeline | Proactive Pipeline |
|--------|-------------|-------------------|
| Тригер | Новина в `article_queue` | Cron (фіксований час) |
| Anti-hallucination | `buildVerifiedHistory` в `loadPersonaContext` | `buildVerifiedHistory` в `buildContext` кожного index.ts |
| Victor review | ✅ в `generateDeskArticle()` | ✅ для proactive; ✅ для self-work (після фікса) |
| "Already wrote today" guard | ❌ RSS може обійти — генерує напряму | ✅ Marcus перевіряє `persona_runs` |
| Persona assignment | Triage (Sonnet) вирішує | Жорстко: cron → одна персона |
| Topic | Зовнішня новина | Власна логіка shouldWrite |
| 3-pass critique | ✅ critiqueAndFix (2500 chars) | ❌ Немає окремого critique pass |
| Baseline/tracker update | Не оновлює | Marcus оновлює baseline; Leo оновлює tracker |
| self-work | Немає | Якщо score < 60 → decideSelfWork |
