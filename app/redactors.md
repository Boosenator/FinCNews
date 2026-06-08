# FinCNews — AI Editorial System
**Статус:** Production · finc.news

---

## Три персони

| Персона | Роль | Тон | Пише коли |
|---------|------|-----|-----------|
| **Marcus Webb** | On-chain Analyst | Сухо, цифри, без емоцій | Аномалії в on-chain метриках |
| **Elena Voss** | Macro Bear | Скептичний, TradFi perspective | Fed/FOMC, DXY, yields, SEC дані |
| **Leo Cruz** | Narrative Hunter | Живо, провокаційно | Trending токени, sentiment shifts |

Мовчать коли score < 60 (proactive) або нема релевантного RSS (reactive).

---

## RSS Pipeline

### Флоу (кожна година)

```
Collect (*/30 хв)
  → RSS fetch + фільтрація (URL, вік <12h, фін. ключові слова)
  → AI Scoring (Haiku, 0-100): ≥80 breaking · 60-79 standard · <60 drop
  → Semantic dedup (embeddings → coverage_log cosine similarity)
      similarity >0.85 → drop
      0.65-0.85 → continuation (той хто писав оригінал)
      <0.65 → triage

Generate (0 * * * *)
  → Triage (Sonnet): {persona, angle, urgency, expires_at}
  → Staleness check: queued >2h → haiku re-evaluate · expires_at минув → drop
  → Context: persona_memory + signal_snapshot + coverage_log
  → Angle discovery (Sonnet) → Draft (Sonnet) → Critique (Sonnet)
  → Victor Kane pre-publish review: approve / edit / block
  → Publish: Sanity → Telegraph → Pexels → Telegram
  → Memory update: persona_memory + coverage_log
```

### Треки
- **Breaking (≥80):** fast lane, публікується в поточному run, dynamic maxArticles
- **Standard (60-79):** normal queue, maxArticles=2 per run

### Triage — призначення персони
| Персона | Теми |
|---------|------|
| Elena | macro, Fed, регуляторика, DXY, yields, SEC enforcement |
| Marcus | on-chain flows, exchange data, whale activity, miner behavior |
| Leo | narrative shifts, trending tokens, sentiment, retail psychology |

Tiebreaker: coverage_log semantic proximity.

### Per-persona article structures (RSS)

| Persona | Структура |
|---------|-----------|
| Elena Voss | `## Context / ## What Changed / ## Macro Implications / ## What to Watch` |
| Marcus Webb | `## The Signal / ## On-Chain Context / ## Historical Precedent / ## What to Watch` |
| Leo Cruz | `## The Narrative Shift / ## What the Data Shows / ## Where This Has Been Before / ## The Signal to Watch` |

### Data pull rules
- Marcus — завжди fresh pull (on-chain metrics = основа статті)
- Elena — pull тільки коли тема macro/Fed/yields/DXY
- Leo — рідко, тільки якщо LunarCrush суттєво додає; narrative з RSS достатньо

---

## Proactive Pipeline

Щоденні запуски по персонах:

| Cron | Персона | Час UTC |
|------|---------|---------|
| `/api/cron/elena` | Elena Voss | 08:00 |
| `/api/cron/marcus` | Marcus Webb | 07:00 + 13:00 |
| `/api/cron/leo` | Leo Cruz | 10:00 |
| `/api/cron/chief-editor` | Victor Kane nightly | 21:00 |

Флоу: data pull → should_write (score 0-100, поріг 60) → якщо так: signal_snapshot → context build → draft → Victor pre-publish → publish.

---

## Signal Snapshot System

Кожен запуск персони зберігає знімок ринкових даних в `persona_memory` (`memory_type: 'signal_snapshot'`).

**Навіщо:**
- Victor Kane бачить що саме бачив аналітик під час генерації
- Delta між запусками (rankDelta для Leo, тренди для Marcus/Elena)

### Структура snapshot

**Leo Cruz**
```
content: Trending coins з rankDelta, Fear&Greed, sentiment, top signals
metadata: {trendingCoins[{id,symbol,name,score}], fearGreedCurrent, fearGreedDelta7d,
           sentimentBreakdown, hotPosts_count, dexBoosts_count, topSignals, pulledAt}
```

**Marcus Webb**
```
content: BTC price/vol/dom, exchange netflow, miner outflows, hashrate, fear&greed, anomalies
metadata: {btcPrice, btcVolumeRatio, btcDominance, btcExchangeNetflow, minerOutflows,
           mempoolTxCount, mempoolAvgFeeRate, btcHashrate, fearGreedIndex, topAnomalies, pulledAt}
```

**Elena Voss**
```
content: Fed funds, CPI, PCE, yields, curve, DXY, BTC 24h, SEC filings
metadata: {fedFundsRate, cpiYoY, corePce, tenYearYield, twoYearYield,
           dxyIndex, yieldCurveSpread, btcChange24h, secFilings_count, pulledAt}
```

### rankDelta (Leo)
`detectSignals()` приймає `prevCoins?: Array<{id, score}>`. Перед запуском Leo: `fetchPrevSnapshotCoins()` → для кожного trending coin `rankDelta = prevScore - currentScore` (позитивне = покращення).

### Victor Kane context
`buildVictorKaneContext()` у всіх трьох персон завантажує 2 останніх `signal_snapshot` і додає під `=== Signal data (last 2 snapshots) ===`.

---

## Victor Kane

Два режими:

| | Pre-publish | Nightly (21:00) |
|--|-------------|-----------------|
| Коли | До публікації | Після всього дня |
| Що бачить | Draft + директива + signal_snapshot | Опубліковані статті + директиви + патерни |
| Рішення | `approve / edit / block` | Score + нова директива на наступний цикл |
| Block | Тільки при явній фабрикації або дублікаті | — |

`directive_followed` лог з pre-publish → Nightly Victor бачить і враховує.

---

## Email System

### Inbound (отримання листів)

**Домен:** `@e.finc.news` (MX → Resend inbound)

**Флоу:**
```
Лист на *@e.finc.news
  → Resend отримує, зберігає (resend.com/emails/receiving)
  → Webhook POST /api/webhook/inbound-email?secret=...
      auth: RESEND_INBOUND_SECRET query param
      payload: {type: "email.received", data: {email_id, from, to, subject, ...}}
  → loadRoutes() з email_routes таблиці
  → resolveRoute(): точний match → wildcard * → null (skip)
  → fetch повного body: GET https://api.resend.com/emails/receiving/{email_id}
  → forward via resend.emails.send()
      subject: [finc.news > {mailbox}] Original Subject
      replyTo: from address
  → log в inbound_email_logs
```

**DB таблиці:**
```sql
email_routes     — recipient (text unique), forward_to, label, is_active
inbound_email_logs — from_address, to_address, subject, forwarded_to, status, skip_reason, received_at
```

**Поточні маршрути (редагуються в адмінці → Email → Routes):**
| Mailbox | Адреса |
|---------|--------|
| editorial | `editorial@e.finc.news` |
| privacy | `privacy@e.finc.news` |
| legal | `legal@e.finc.news` |
| ads | `ads@e.finc.news` |
| tech | `tech@e.finc.news` |
| * | catch-all для будь-якого іншого |

**Env vars:**
- `RESEND_INBOUND_SECRET` — секрет для webhook auth
- `RESEND_API_KEY` — для fetch body + forward

**Resend webhook:** `https://finc.news/api/webhook/inbound-email?secret={RESEND_INBOUND_SECRET}` · event: `email.received`

### Outbound (відправка листів)

**Домен відправки:** `@e.finc.news` (ізольований від finc.news для репутації)

**Типи листів:** `confirmation / welcome / breaking / digest`

Всі відправки логуються в `email_logs`.

### Admin UI (адмінка → Email)

| Subtab | Що показує |
|--------|-----------|
| Inbound | `inbound_email_logs`: від кого, кому, тема, куди форвардили, статус |
| Outbound | `email_logs`: тип, отримувач, тема, статус, час |
| Routes | `email_routes`: список з on/off toggle + форма додавання/видалення |
| Active | Підписники (confirmed + pending) з кнопкою unsub |
| Unsub | Відписані, відсортовані по даті |

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

## Публікація — порядок каналів

**Фіксований порядок:** Sanity → Telegraph → Pexels → Telegram

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

## Ключові файли

```
lib/automation.ts                      — RSS collect + score + dedup + queue
lib/automation/triage.ts               — persona assignment + urgency
lib/automation/generate-desk.ts        — RSS article generation (3-pass Sonnet)
lib/automation/coverage-log.ts         — coverage_log read/write
lib/automation/staleness-check.ts      — expires_at + age validation

lib/personas/elena-voss/index.ts       — proactive pipeline + signal_snapshot
lib/personas/marcus-webb/index.ts      — proactive pipeline + signal_snapshot
lib/personas/leo-cruz/index.ts         — proactive pipeline + signal_snapshot
lib/personas/leo-cruz/signals.ts       — detectSignals + rankDelta
lib/personas/chief-editor/            — Victor Kane (evaluate + memory + directives)

app/api/webhook/inbound-email/route.ts — Resend inbound webhook
app/api/admin/email-routes/route.ts    — CRUD для email routes
app/(admin)/flows/_components/EmailTab.tsx — email admin UI
```
