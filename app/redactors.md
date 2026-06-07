FinCNews — AI Editorial System
Інструкція для Claude Code: продумай архітектуру нейро-редакції

Контекст проекту
Є медіа-ресурс finc.news — автоматизований US crypto & fintech signal desk.
Зараз агенти рерайтять новини з RSS. Потрібно перейти від реактивної моделі до проактивної редакції з трьома AI-персонами.
Кожна персона — незалежний агент зі своєю філософією, джерелами даних, пам'яттю і editorial judgment. Агенти не чекають на новини — вони самі оцінюють ринок і вирішують чи є про що говорити сьогодні.

Три персони
Marcus Webb — On-chain Analyst

Філософія: "Ринок — це потоки. Все що рухається залишає слід on-chain."
Пише про: whale movements, exchange inflows/outflows, miner behavior, network health
Тон: сухо, цифри, без емоцій. "Glassnode показує X. Це означає Y."
Мовчить коли: немає аномалій в on-chain метриках
Джерела: Glassnode API, Nansen, CryptoQuant, Dune Analytics, CoinGecko

Elena Voss — Macro Bear

Філософія: "BTC — це ризиковий актив. Поки Fed не розвернувся — все це шум."
Пише про: Fed/FOMC, DXY, облігації, кореляція крипто з macro, regulatory
Тон: скептичний, широкий контекст, TradFi perspective
Мовчить коли: тихий macro день, немає даних від Fed або SEC
Джерела: FRED API, CME FedWatch, SEC EDGAR RSS, TradingView, Koyfin

Leo Cruz — Narrative Hunter

Філософія: "Ринок рухається нарративами. Хто перший зрозумів нарратив — той виграв."
Пише про: trending токени, нові narrative хвилі, sentiment shifts, hype cycles
Тон: живо, трохи провокаційно, доступно для широкої аудиторії
Мовчить коли: sentiment рівний, нічого не trending вище базового рівня
Джерела: LunarCrush, Santiment, Google Trends API, X/Twitter trending, Polymarket


Що потрібно спроектувати
1. Database Schema
Спроектуй PostgreSQL схему для:
personas          — опис кожної персони (system prompt, config, sources)
persona_memory    — довготривала пам'ять (статті, прогнози, позиції по активах)
articles          — опубліковані статті з прив'язкою до персони
hub_pages         — SEO-хаби (Bitcoin ETF, SEC Regulation, Stablecoins, тощо)
daily_runs        — лог щоденних запусків (хто писав, score, reasoning)
forecasts         — прогнози персон + результат (збулось чи ні)
Для persona_memory потрібен pgvector для семантичного пошуку релевантних спогадів.

2. should_write() — Editorial Judgment
Це окремий LLM-виклик до генерації статті.
Логіка:
input:  persona config + live data pull зі своїх джерел
output: { should_write: bool, score: int (0-100), reasoning: string, topic: string }
Поріг: score >= 60 → персона пише.
Напиши:

Базовий should_write prompt template для кожної персони
FastAPI endpoint POST /api/personas/{persona_id}/evaluate
Структуру response


3. Memory System
Перед генерацією статті підтягуємо релевантний контекст:
pythondef build_context(persona_id: str, topic: str) -> dict:
    # 1. Останні 10 статей персони (хронологічно)
    # 2. Семантично схожі статті по topic (pgvector similarity search)
    # 3. Активні прогнози персони (незакриті)
    # 4. Поточна "позиція" персони по головних активах
    # 5. Теми які персона вже розкривала цього тижня
Спроектуй цю функцію і структуру даних яку вона повертає.

4. Generation Pipeline
CRON (07:00 UTC)
  → для кожної персони паралельно:
      → data_pull(persona)          # тягне живі дані зі своїх API
      → should_write(persona, data) # editorial judgment
      → if score >= 60:
          → memory_context = build_context(persona, topic)
          → article = generate_article(persona, data, memory_context)
          → outputs = generate_outputs(article)  # всі формати
          → publish(outputs)
          → update_memory(persona, article)
      → else:
          → log_silent_day(persona, reasoning)
          → maybe: self_work(persona)  # оновити hub, зробити follow-up
Напиши:

FastAPI структуру сервісів (не весь код, але модулі і їх відповідальність)
Які async завдання, де використовувати celery або просто asyncio
Як обробляти помилки (API недоступний, LLM timeout)


5. Output Package
Одна стаття = пакет форматів:
pythonclass ArticleOutputs:
    site_article: str        # повна стаття для finc.news (HTML або Markdown)
    telegram_signal: str     # 5-7 рядків + посилання
    x_post: str              # до 280 символів
    x_thread: list[str]      # якщо тема сильна (score > 80)
    email_digest_block: str  # короткий блок для Daily Brief
    video_script: str        # 20-35 секунд, один тезис
    hub_update: dict | None  # якщо тема відноситься до hub page
Напиши prompt template для генерації кожного формату.

6. Self-Work Logic
Якщо персона не пише сьогодні (score < 60):
pythondef self_work(persona_id: str) -> None:
    # Варіанти:
    # а) Перегляд старих прогнозів → закрити або підтвердити
    # б) П'ятниця → weekly summary по своїх темах
    # в) Оновити hub page свіжими даними без нової статті
    # г) Нічого не робити (valid outcome)

7. Stack
Орієнтуємось на:

Backend: FastAPI + PostgreSQL + pgvector + Redis (для черг)
LLM: Anthropic Claude API (claude-sonnet-4-20250514)
Scheduler: APScheduler або Celery Beat
Frontend: Next.js (існуючий finc.news)
Deployment: Railway або Render


Що очікується на виході від Claude Code

Повна структура проекту (директорії, модулі, файли)
Database migrations (Alembic або raw SQL)
Persona configs — JSON або YAML для кожної персони з system prompt
Core services:

PersonaService — управління персонами і пам'яттю
EvaluationService — should_write логіка
GenerationService — генерація статті і всіх форматів
PublishService — дистрибуція по каналах
MemoryService — читання і запис пам'яті


CRON orchestrator — головний pipeline
API endpoints для моніторингу і ручного запуску


Важливі constraints

Персони ніколи не публікують якщо score < 60
Кожна стаття обов'язково прив'язана до одного з hub pages
Telegram пост завжди веде на finc.news, не є кінцевим пунктом
Пам'ять персони не скидається між запусками — це ключово для "живого" характеру
Google "scaled content abuse" — кожна стаття мусить мати шар: what happened / why it matters / who is affected / what to watch next
Перші 60 днів немає агресивної монетизації в контенті


Додаткові питання для опрацювання

Як вирішувати конфлікти якщо дві персони хочуть писати про одну тему?
Як логувати і відображати reasoning персони (прозорість для редактора)?
Як тестувати should_write без реальних API calls (mock data strategy)?
Як реалізувати "прогноз + верифікація" цикл для Marcus і Elena?

---

# RSS Pipeline — Redesign Plan
**Статус:** ✅ Реалізовано (Phase 1)
**Погоджено:** 2026-06-07

## Проблеми поточного RSS агента

| Проблема | Деталь |
|----------|--------|
| Слабка дедуплікація | Jaccard по словах >3 символи — SEC, ETF, BTC, Fed не порівнюються |
| Вузьке вікно | 12 годин — події тижневої давності невидимі |
| Низький поріг | MIN_SCORE=45 пропускає майже все, реальний фільтр — hard cap 2/год |
| Generic journalist | Безликий стиль, немає голосу персони |
| Сліпий scoring | Haiku оцінює новини без знання що вже опубліковано |
| Немає пам'яті | Кожна стаття з нуля, continuation не розпізнається |
| Hard cap 2/год | Breaking news черга — при 3+ гарячих новинах одночасно губимо їх |
| Немає перевірки актуальності | Стаття з черги через 2+ год може бути вже застарілою |

---

## Ключові рішення

1. **Byline персони** — RSS статті виходять під повним іменем автора (Elena Voss, Marcus Webb, Leo Cruz). "FinCNews Desk" відкинуто.
2. **Continuation = той хто починав** — детерміновано, Marcus почав → Marcus продовжує.
3. **Sonnet для генерації** — однаковий стандарт якості з проактивними статтями.
4. **Єдиний coverage_log** — всі статті (проактивні + RSS) в одній карті покриття.
5. **Без балансу по категоріях** — пріоритет виключно по score і urgency.
6. **Два треки** — Breaking (≥80) fast lane, Standard (60-79) normal queue.
7. **Score поріг 60** — замість 45, відсіює "moderate" новини без редакційної цінності.
8. **Перевірка актуальності** — перед генерацією, не тільки при зборі.

---

## Повний флоу

> **Статус реалізації** відзначається символами: ✅ готово · 🔄 в процесі · ⬜ заплановано

### Крок 1 — Збір і базова фільтрація *(кожні 30 хв)* ✅

- Забираємо свіжі записи з усіх активних RSS-джерел паралельно
- Відсіюємо: немає URL, старіше 12 годин, немає фінансових ключових слів
- URL dedup: перевірка по `processed_urls` + `article_queue` (обидві таблиці)

---

### Крок 2 — AI Scoring *(Haiku, batch)* ✅

Haiku оцінює всі свіжі item одним викликом. Score 0-100:
- **≥ 80** — Breaking: major price moves, Fed/SEC rulings, hacks, record highs
- **60-79** — Significant: важливі корпоративні новини, policy impact, ринкові рухи
- **< 60** — drop: generic opinion, analyst fluff, мінімальна новинна цінність

**Поріг: score ≥ 60.** Все нижче не потрапляє в чергу.

Fallback якщо Haiku недоступний: `calculateHypeScore()` (rule-based).

---

### Крок 3 — Семантична дедуплікація *(embeddings)* ✅ *(title-based fixed; embedding dedup — phase 2 після накопичення coverage_log)*

Для кожного item що пройшов scoring:
- Embed `title + excerpt` (OpenAI text-embedding-3-small)
- Cosine similarity search по `coverage_log` (містить ВСІ статті: проактивні + RSS)
- Також перевірка по `article_queue WHERE status IN ('pending','processing')` — захист від batch-дублів

**Три результати:**

| Результат | Умова | Дія |
|-----------|-------|-----|
| **Дублікат** | similarity > 0.85 | Drop, не публікуємо |
| **Continuation** | similarity 0.65-0.85, published_at < 14 днів тому | Передаємо тому хто писав оригінал |
| **Нова тема** | similarity < 0.65 або старіше 14 днів | Переходимо до triage |

---

### Крок 4 — Triage *(Sonnet, batch)* ✅

Один LLM-виклик який визначає:

```ts
{
  persona: "elena-voss" | "marcus-webb" | "leo-cruz",
  angle: string,          // конкретний кут статті
  urgency: "breaking" | "standard",
  expires_at: string,     // ISO datetime — до коли актуально
  reasoning: string       // чому саме ця персона
}
```

**Правила призначення:**
- Elena → macro, Fed, регуляторика, DXY, yields, SEC enforcement
- Marcus → on-chain flows, exchange data, whale activity, miner behavior
- Leo → narrative shifts, trending tokens, sentiment, retail psychology

**Tiebreaker:** якщо тема підходить двом — перемагає та персона чия попередня стаття ближча семантично (coverage_log).

**`urgency`** визначає трек:
- `breaking` → fast lane, публікується в поточному або наступному run
- `standard` → normal queue, чекає свого часу

**`expires_at`** — дедлайн актуальності:
- Breaking → `now + 3h`
- Standard → `now + 8h`
- Continuation → `now + 12h` (більше часу, контекст вже є)

---

### Крок 5 — Черга і треки ✅

**Fast lane (breaking, score ≥ 80):**
- Стаття не чекає наступного `runGenerate`
- `maxArticles` динамічний: скільки breaking items — стільки й публікуємо
- Якщо `expires_at` минув до генерації → drop

**Normal queue (standard, score 60-79):**
- Стандартна черга, сортування по score
- Перевірка актуальності перед генерацією:
  - Якщо `queued_at > 2h` → haiku re-evaluate: все ще актуально?
  - Якщо `pub_date оригіналу > 6h` → deprioritize
  - Якщо `expires_at` минув → drop
- `maxArticles = 2` per normal run

---

### Крок 6 — Збір контексту перед генерацією ✅

| Тип статті | Контекст |
|------------|---------|
| Continuation | Пам'ять персони (last 5) + останній data snapshot + excerpt оригінальної статті |
| Нова тема — Marcus | Пам'ять персони + **свіжий data pull завжди** |
| Нова тема — Elena | Пам'ять персони + data pull якщо тема macro/Fed/yields/DXY |
| Нова тема — Leo | Пам'ять персони (data pull рідко — тільки якщо LunarCrush суттєво додає) |

**Правило data pull — від природи персони, не від типу статті:**
- Marcus пише цифрами — без z-score і on-chain метрик це не Marcus
- Elena — pull тільки коли тема потребує живих macro даних
- Leo — narrative і sentiment достатньо з RSS тексту

**Data snapshot для continuation:** якщо snapshot старший 8 годин — використовується як фоновий контекст ("станом на ранок..."), не як primary data.

---

### Крок 7 — Генерація *(Sonnet, 3 проходи)* ✅

**7a. Angle discovery** *(Sonnet)*
- Sonnet читає RSS item + пам'ять персони + останні статті з coverage_log
- Знаходить конкретний кут якого ще не було — одне речення
- Результат передається в draft як редакційне завдання

**7b. Draft** *(Sonnet з системним промптом персони)*
- Голос і аналітичні акценти призначеної персони
- Continuation → явне посилання: "Раніше ми писали що..."
- RSS текст = основна нова інформація; data snapshot = аналітичний шар
- Структура: What Happened / Key Details / Why It Matters / What Happens Next

**7c. Critique** *(Sonnet self-review)*
- Той самий Sonnet читає draft і шукає: слабкий висновок, порушення голосу, вигадані числа
- Повертає або `{ approved: true }` або конкретні виправлення
- Якщо є правки → один targeted rewrite, не повна перегенерація

---

### Крок 8 — Victor Kane pre-publish review *(Sonnet)* ✅

Victor отримує: article draft + активна директива для цієї персони + generation_type.

```ts
// Victor returns:
{
  decision: "approve" | "edit" | "block",
  edit_instruction?: string,  // одна конкретна правка
  reason: string,
  directive_followed: boolean
}
```

- **approve** → одразу публікуємо
- **edit** → один Sonnet pass з `edit_instruction` → публікуємо
- **block** → стаття в `review_queue`, не публікується автоматично

**block** — тільки при явній фабрикації фактів або дублікаті.
**edit** — для будь-якого одного виправного дефекту.

Victor як pre-publish ≠ Victor як nightly reviewer:
| | Nightly (21:00) | Pre-publish |
|--|-----------------|-------------|
| Коли | Після публікації | До публікації |
| Що бачить | Опублікована стаття + патерни | Чорновик + директива |
| Рішення | Score, directive на майбутнє | approve/edit/block |
| Мета | Еволюція якості персони | Контроль конкретного матеріалу |

Nightly Victor тепер бачить `directive_followed` лог з pre-publish — дає точніший feedback за тиждень.

---

### Крок 9 — Публікація ✅

Одна стаття = чотири канали, послідовно:

**9a. Sanity** — стаття на finc.news/{category}/{slug}, повний byline персони, аватар

**9b. Telegraph** — preview сторінка:
- excerpt + перші 3 речення body
- CTA → finc.news (backlink)
- `By Elena Voss → finc.news/author/elena-voss`
- Автор Telegraph акаунту: FinCNews (не змінюється)
- Fallback: якщо Telegraph недоступний → пряме посилання

**9c. Pexels cover image:**
- Haiku генерує фотожурналістичний query (4-6 слів, без логотипів/монет)
- Фото → Sanity assets → патч документа
- Telegram отримує менший розмір (`src.large`)

**9d. Telegram channel** — caption без категорії:
```
🚨 BREAKING  ← тільки якщо breaking

<b>Заголовок статті</b>

Excerpt 1-2 речення

Full story 👇
https://telegra.ph/...

By <a href="finc.news/author/elena-voss">Elena Voss</a>
#bitcoin #crypto #FinCNews
```

**Порядок фіксований:** Sanity → Telegraph → Pexels → Telegram

**Email** — окремий агент (`email-planner-agent.ts`), читає з Sanity, не частина цього флоу.

---

### Крок 10 — Оновлення пам'яті ✅

- `persona_memory` автора → запис з `source: "rss"`, `generation_type: "rss"`
- `coverage_log` → embedding від **оригінального RSS snippet** (не нашого рерайту — для кращої similarity при майбутніх пошуках)
- Victor Kane бачить статтю у вечірньому review 21:00 UTC

---

## Victor Kane — адаптація для RSS статей

Оцінює всі статті персон включно з RSS. `generation_type` впливає на один критерій:

| Критерій | Proactive | RSS |
|----------|-----------|-----|
| Thesis clarity | стандарт | стандарт |
| Data specificity | власні метрики, z-score, джерело | правильне цитування зовнішнього джерела, без вигаданих цифр |
| Voice consistency | стандарт | стандарт |
| Signal value | стандарт | стандарт |
| Conclusion strength | стандарт | стандарт |

**Директиви для RSS:** тільки структурні і голосові. Директиви про власні дані (Glassnode z-score, FRED pulls) — не видаються для RSS-статей.

---

## Компоненти для реалізації

### DB migrations
```sql
-- coverage_log
CREATE TABLE coverage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embedding vector(1536),
  title text,
  excerpt text,
  slug text NOT NULL,
  persona_id text,
  generation_type text CHECK (generation_type IN ('rss','proactive')),
  source_url text,
  published_at timestamptz DEFAULT now()
);
CREATE INDEX ON coverage_log USING ivfflat (embedding vector_cosine_ops);

-- article_queue: нові колонки
ALTER TABLE article_queue
  ADD COLUMN urgency text CHECK (urgency IN ('breaking','standard')),
  ADD COLUMN expires_at timestamptz,
  ADD COLUMN assigned_persona text,
  ADD COLUMN article_type text CHECK (article_type IN ('new','continuation')),
  ADD COLUMN continuation_of text;  -- slug оригінальної статті

-- RPC
CREATE FUNCTION match_coverage(query_embedding vector, threshold float, match_count int)
```

### Нові файли
```
lib/automation/triage.ts          — embed + similarity search + haiku persona assign
lib/automation/generate-desk.ts   — sonnet генерація з голосом персони
lib/automation/coverage-log.ts    — read/write coverage_log
lib/automation/staleness-check.ts — перевірка актуальності перед генерацією
```

### Зміни в існуючих файлах
```
lib/automation.ts
  — score поріг 45 → 60
  — titleSimilarity: w.length > 2 (було > 3)
  — dedup threshold 0.5 → 0.35
  — dedup window 12h → 24h
  — dynamic maxArticles (breaking count)
  — інтеграція triage + staleness-check + generate-desk

lib/personas/*/index.ts (Elena, Marcus, Leo)
  — після публікації: coverage_log.insert()

lib/personas/chief-editor/data-collector.ts
  — тягнути generation_type з Sanity metadata

lib/personas/chief-editor/evaluate.ts
  — різний стандарт data_specificity по generation_type
```

### Admin UI (після pipeline)
```
LogsTab: нові step labels (triage, data_pull, pre_publish, coverage_log, staleness_check)
LogsTab: article detail — persona badge + type badge (new/continuation)
LogsTab: dedup breakdown — додати embedding_dup count
QueueTab: колонки urgency + assigned_persona + expires_at
```

---

## Edge cases і обмеження

| Ситуація | Рішення |
|----------|---------|
| Data snapshot > 8h (continuation) | Використовується як фон, не primary |
| Marcus data pull timeout | AbortSignal 15s, fallback на останній snapshot |
| Continuation > 14 днів | Нова стаття, але з фоновим контекстом |
| alreadyWrote guard | RSS обходить — окремий entry point |
| Два RSS джерела, та сама подія, один batch | coverage_log + article_queue check блокує другий |
| Breaking expires_at минув до генерації | Drop без публікації |
| Proactive персона + RSS continuation того самого дня | RSS continuation не залежить від proactive score |