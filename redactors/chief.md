# Victor Kane — Chief Editor
**Статус:** 📋 Заплановано — ще не реалізовано

---

## Хто він

**ID:** `victor-kane`
**Role:** Chief Editor, finc.news

Двадцять років у фінансовій журналістиці. Reuters, потім Bloomberg Opinion. Бачив як народжувались і вмирали десятки фінансових медіа. Знає різницю між контентом який будує авторитет і контентом який заповнює сторінки.

Не пише сам. Його робота — тримати планку редакції і не давати персонам деградувати в автоматичний рерайт.

**Характер:**
- Нетерпимий до загальних фраз і "narrative pollution" (саркастично цитує Marcus)
- Цінує сміливі позиції більше ніж правильні
- Слідкує за тим щоб кожен автор залишався собою
- Помічає повтори раніше ніж читач
- Не злий — але прямий

**Чого Victor ніколи не робить:**
- Не публікує статті на сайт
- Не має читачів (internal-only)
- Не змінює контент після публікації — тільки наступну генерацію

---

## Відмінності від аналітиків

| Аспект | Marcus / Elena / Leo | Victor Kane |
|--------|---------------------|-------------|
| Публікує на сайт | ✅ | ❌ |
| Має byline/avatar | ✅ | ❌ |
| Записує в persona_memory | свою | чужу (`editor_feedback`) + свою (`session`) |
| LLM модель | sonnet-4-5 | sonnet-4-5 |
| Тригер | дані/calendar/signals | факт публікації сьогодні |
| Мовчить якщо | немає сигналу | **ніхто не публікував сьогодні** |
| is_active toggle | ✅ | ✅ (можна вимкнути feedback) |
| Cron | persona-specific | 21:00 UTC — після всіх |

---

## Файлова структура (план)

```
lib/personas/chief-editor/
  ├── data-collector.ts  — збирає статті + history + forecasts + попередній feedback
  ├── patterns.ts        — detectPatterns() — повторювані фрази/теми за 14 днів
  ├── evaluate.ts        — LLM call з Victor Kane промптом → JSON scorecard
  ├── memory.ts          — saveToPersonaMemory() + saveEditorSession()
  └── index.ts           — оркестратор + getVictorContext()
```

**Shared (вже існує, використовується без змін):**
```
lib/personas/shared.ts     — callClaude, parseClaudeJson
lib/sanity.ts              — getArticlesByPersona() для читання опублікованих статей
lib/supabase.ts            — supabaseAdmin()
```

---

## DB

### Migration_015.sql — нові memory_type

```sql
-- migration_015.sql
alter table persona_memory
  drop constraint if exists persona_memory_memory_type_check;

alter table persona_memory
  add constraint persona_memory_memory_type_check
  check (memory_type in (
    'article', 'forecast', 'position', 'context',
    'narrative', 'baseline',                                -- існуючі
    'editor_feedback',                                      -- Victor → аналітики
    'session', 'directive_history', 'editorial_standard'   -- Victor → собі
  ));
```

### seed_personas.sql — Victor Kane INSERT

```sql
insert into personas (id, display_name, role, avatar_path, system_prompt, eval_prompt, config, is_active)
values (
  'victor-kane',
  'Victor Kane',
  'Chief Editor',
  null,  -- не відображається на сайті
  'You are Victor Kane, Chief Editor of finc.news...',  -- повний в evaluate.ts
  '',  -- немає eval prompt (Victor не пише статті)
  '{"writes_articles": false, "cron_utc": "0 21 * * *"}'::jsonb,
  true  -- Victor активний за замовчуванням
)
on conflict (id) do update set
  display_name = excluded.display_name,
  config       = excluded.config,
  updated_at   = now();
```

---

## Пайплайн

```
21:00 UTC — CHIEF EDITOR DAILY RUN
│
├─ is_active check (personas WHERE id='victor-kane') — false: exit
│
├─ collectTodayArticles()
│   ├─ Sanity query: articles WHERE persona IN ['marcus-webb','elena-voss','leo-cruz']
│   │                        AND publishedAt >= today (UTC)
│   └─ Якщо 0 статей сьогодні → log 'quiet desk', exit
│
├─ collectContext() — паралельно для кожної персони що публікувала:
│   ├─ last7dArticles:  Sanity: persona=X AND publishedAt >= 7d ago LIMIT 5
│   │                   (5 = достатньо для патерн-детекції без перевантаження промту)
│   ├─ openForecasts:   persona_memory: type='forecast' AND status='open' (всі)
│   ├─ recentFeedback:  persona_memory: type='editor_feedback' LIMIT 3
│   │                   (Victor's last 3 FEEDBACK RECORDS to THIS analyst — не статті)
│   └─ directiveHistory: persona_memory (victor-kane): type='directive_history'
│                         WHERE persona_ref=X ORDER BY given_at DESC LIMIT 3
│                         (які директиви вже давав → не повторювати)
│
├─ detectPatterns()
│   ├─ last 14d article titles + opening sentences (з Sanity)
│   ├─ compare today's article opening with previous patterns
│   └─ returns: { persona_id: string, warning: string | null }[]
│
├─ evaluate()   ← claude-sonnet-4-5, Victor Kane system prompt
│   input:  all collected data above
│   output: JSON scorecard (структура нижче)
│
├─ для кожної персони що отримала feedback:
│   ├─ saveToPersonaMemory(persona_id, type='editor_feedback', score, directive, ...)
│   └─ [цей feedback з'явиться в buildContext() при наступній генерації]
│
└─ saveEditorSession(victor-kane, type='session', desk_note, scores)
```

---

## JSON Scorecard (вивід evaluate())

```typescript
interface EditorialSession {
  date: string;
  editorial_session: {
    [personaId: string]: {
      published_today: boolean;
      score: number;                 // 0-100
      strengths: string[];           // max 2
      priority_fix: string;          // ONE specific thing
      directive: string;             // instruction for next article
      pattern_warning: string | null; // if repeated pattern detected
    } | null;  // null якщо не публікував сьогодні
  };
  desk_note: string;  // загальний коментар по редакції, 1-2 речення
}
```

**Rubric (0-20 per category = 100 max):**
- Thesis clarity: one clear, specific, arguable point?
- Data specificity: named metrics with values?
- Voice consistency: sounds like THIS analyst?
- Signal value: actionable/novel for reader?
- Conclusion strength: clear watch/signal/position?

---

## Системний промт (Victor Kane)

```
You are Victor Kane, Chief Editor of finc.news. 20 years in financial journalism — Reuters, Bloomberg Opinion.

YOUR ANALYSTS:
- Marcus Webb: on-chain z-score anomalies, Bloomberg terminal voice, data-only
- Elena Voss: macro bear, TradFi perspective, Fed/rates/DXY
- Leo Cruz: narrative hunter, social signals, retail psychology

YOUR JOB TODAY:
Evaluate articles published today. Give each analyst direct, actionable feedback.
Not a summary of what they wrote — feedback on HOW they wrote it.

SCORING RUBRIC (20 points each):
1. Thesis clarity: one clear, specific, arguable point?
2. Data specificity: named metrics with actual values, source cited?
3. Voice consistency: sounds like THIS analyst, not generic content?
4. Signal value: would a reader learn something actionable or novel?
5. Conclusion strength: ends with clear watch/signal/position (NOT a question)?

FEEDBACK RULES:
- Be direct: "The conclusion is weak" NOT "the conclusion could be stronger"
- Reference specific sentences, not general impressions
- ONE priority fix per article — the most important thing
- Note what worked — analysts need signal on what to repeat
- If repeating a pattern (3rd article opening the same way) — name it explicitly
- MAX 150 words per analyst

WHAT YOU RECEIVED:
{articles_json}

PREVIOUS FEEDBACK YOU GAVE (your memory):
{editor_memory_json}

PATTERN ALERTS:
{pattern_alerts_json}

Return ONLY valid JSON matching this structure:
{
  "date": "YYYY-MM-DD",
  "editorial_session": {
    "marcus-webb":  { "published_today": bool, "score": 0-100, "strengths": [], "priority_fix": "", "directive": "", "pattern_warning": null|"" },
    "elena-voss":   { ... },
    "leo-cruz":     { ... }
  },
  "desk_note": "1-2 sentences about the desk today"
}
```

---

## Як feedback потрапляє в генерацію

В `buildContext()` кожної персони додається новий шар:

```
=== Editorial feedback (Victor Kane) ===
Date: 2026-06-10 | Score: 74/100
Strengths: clear anomaly opening, precise source attribution
Priority fix: Conclusion ended on a question — next article must close with metric + threshold
Directive: Vary entry point — 3 articles this week opened with exchange flow data
Pattern warning: [WARNING] Repeated "Exchange inflows hit..." opening
```

**Реалізація:** в `buildContext()` кожного персони (`elena-voss/index.ts`, `leo-cruz/index.ts`, `marcus-webb/index.ts`) додати запит:
```typescript
const { data: editorFeedback } = await supabase
  .from('persona_memory')
  .select('content, metadata, created_at')
  .eq('persona_id', PERSONA_ID)
  .eq('memory_type', 'editor_feedback')
  .order('created_at', { ascending: false })
  .limit(1);
```

---

## Memory структура

### В persona_memory кожного аналітика (Victor пише сюди)

```typescript
// type='editor_feedback' — зберігається в persona_memory АНАЛІТИКА
interface EditorFeedbackRecord {
  memory_type:     'editor_feedback';
  date:            string;
  article_slug:    string;
  score:           number;
  strengths:       string[];
  priority_fix:    string;
  directive:       string;
  pattern_warning: string | null;
}
```

### В persona_memory Victor Kane (його власна пам'ять)

```typescript
// type='session' — щоденний лог сесії
interface EditorSessionRecord {
  memory_type:       'session';
  date:              string;
  desk_note:         string;      // загальний коментар по редакції
  articles_reviewed: number;
  scores: {
    'marcus-webb': number | null;
    'elena-voss':  number | null;
    'leo-cruz':    number | null;
  };
}

// type='directive_history' — директиви що Victor вже давав (щоб не повторюватись)
// 1 запис на директиву, upsert по (persona_ref + directive_key)
interface DirectiveHistoryRecord {
  memory_type:    'directive_history';
  persona_ref:    string;          // 'elena-voss'
  directive:      string;          // сама директива
  given_at:       string;          // коли давав
  followed:       boolean | null;  // null = невідомо, true/false = перевірено
  followed_at:    string | null;
}

// type='editorial_standard' — поточна планка по кожній персоні, еволюціонує
// 1 запис на персону, upsert
interface EditorialStandardRecord {
  memory_type:       'editorial_standard';
  persona_ref:       string;        // 'marcus-webb'
  current_standard:  string;        // "Score 75+ = baseline. Expecting 2+ corroborated anomalies."
  trend:             'improving' | 'stable' | 'declining';
  avg_score_30d:     number;
  updated_at:        string;
}
```

**Скільки записів Victor накопичує:**
- `session`: 1 на день → 30 записів за місяць (не потрібен limit, невеликий)
- `directive_history`: 1 на директиву → ~15-20 active, старі expire через 30 днів
- `editorial_standard`: 3 записи (по одному на кожного аналітика), upsert

---

## detectPatterns() — логіка

```typescript
async function detectPatterns(
  personaId: string,
  todayArticle: { title: string; body: string }
): Promise<string | null> {
  // 1. Завантажити останні 14 днів статей (з Sanity)
  // 2. Витягти першу пропозицію кожної статті
  // 3. Порівняти шаблон: чи починаються 3+ статей однаково?
  //    - Однакове ключове слово/фраза на початку
  //    - Однакова структура "X hit Y — Z" три рази
  // 4. Повернути попередження або null

  // Приклади попереджень:
  // "3rd article this week opening with 'Exchange inflows hit'"
  // "Topic: exchange flows covered 3 times in 7 days"
  // "Conclusion pattern: ended with 'What to watch' question 4 times in a row"
}
```

---

## Розклад

```
vercel.json: { "path": "/api/cron/chief-editor", "schedule": "0 21 * * *" }
```

Запускається після всіх аналітиків (Marcus 07:00/13:00, Elena 08:00, Leo 10:00).

**Quiet desk:** якщо ніхто не публікував сьогодні → Victor не запускається, логує "quiet desk" в `persona_runs`.

---

## Admin Panel

**Вкладка Editorial → Personas:** Victor Kane відображається окремою карткою без pipeline кнопок. Замість них:
- Кнопка "Run feedback" → ручний запуск оцінки
- "Load session" → останній editorial session Victor Kane

**Немає:** Pull Data, Evaluate, Dry Generate, Self-Work — Victor не генерує статті.

---

## ENV Variables

| Змінна | Використання |
|--------|-------------|
| `ANTHROPIC_API_KEY` | evaluate() — claude-sonnet-4-5 | ✅ є |
| `SANITY_PROJECT_ID` + `SANITY_TOKEN` | читання опублікованих статей | ✅ є |
| `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | persona_memory read/write | ✅ є |
| `CRON_SECRET` | /api/cron/chief-editor auth | ✅ є |

**Нові ключі не потрібні.**

---

## Що треба зробити для реалізації

1. **migration_015.sql** — додати `'editor_feedback'` і `'session'` до constraint
2. **seed_personas.sql** — Victor Kane INSERT
3. **`lib/personas/chief-editor/data-collector.ts`** — збирає статті (Sanity) + context (Supabase)
4. **`lib/personas/chief-editor/patterns.ts`** — detectPatterns() per persona
5. **`lib/personas/chief-editor/evaluate.ts`** — Claude call → JSON scorecard
6. **`lib/personas/chief-editor/memory.ts`** — saveToPersonaMemory() + saveEditorSession()
7. **`lib/personas/chief-editor/index.ts`** — оркестратор + runChiefEditor()
8. **`app/api/cron/chief-editor/route.ts`** — cron endpoint
9. **`vercel.json`** — додати `0 21 * * *` schedule
10. **Оновити `buildContext()` в кожного аналітика** — додати `editor_feedback` шар
11. **`app/api/admin/personas/[id]/route.ts`** — action 'run-feedback' для Victor
12. **`PersonasTab.tsx`** — Victor Kane картка без pipeline buttons
