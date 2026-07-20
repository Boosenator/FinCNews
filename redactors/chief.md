# Victor Kane — Chief Editor
**Статус:** ✅ Реалізовано і задеплоєно

---

## Хто він

**ID:** `victor-kane`
**Role:** Chief Editor, finc.news

Двадцять років у фінансовій журналістиці. Reuters, потім Bloomberg Opinion. Бачив як народжувались і вмирали десятки фінансових медіа. Знає різницю між контентом який будує авторитет і контентом який заповнює сторінки.

Не пише сам. Його робота — тримати планку редакції і не давати персонам деградувати в автоматичний рерайт.

**Характер:**
- Нетерпимий до загальних фраз і "narrative pollution"
- Цінує сміливі позиції більше ніж правильні
- Помічає повтори раніше ніж читач
- Не злий — але прямий

**Чого Victor ніколи не робить:**
- Не публікує статті на сайт
- Не має byline/avatar
- Не змінює контент після публікації — тільки впливає на наступну генерацію

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

## Файлова структура

```
lib/personas/chief-editor/
  ├── data-collector.ts  — collectData(): Sanity статті + Supabase context паралельно
  ├── patterns.ts        — detectPatterns(): repeated openings, topic overlap, weak conclusions
  ├── evaluate.ts        — LLM call з Victor Kane промптом → EditorialSession JSON
  ├── memory.ts          — saveFeedbackToAnalysts() + saveEditorSession() + updateStandards()
  └── index.ts           — runChiefEditor() orchestrator
```

---

## DB

**Migrations:**
```
migration_015.sql  — додає: editor_feedback, session, directive_history, editorial_standard
```

**seed_personas.sql** — Victor Kane INSERT (`is_active=true`, `model=claude-sonnet-4-5`).

**Активується автоматично** — `is_active=true` за замовчуванням (Victor завжди активний якщо є аналітики що публікують).

---

## Пайплайн

```
21:00 UTC — CHIEF EDITOR DAILY RUN
│
├─ is_active check — false: exit
│
├─ collectData()
│   ├─ today's articles from Sanity (persona IN ['elena-voss','marcus-webb','leo-cruz'])
│   └─ Якщо 0 статей → log 'quiet desk', exit (Victor не запускається)
│
│   Для кожної персони що публікувала (паралельно):
│   ├─ last5Articles:    Sanity LIMIT 5 (для патерн-детекції)
│   ├─ openForecasts:    persona_memory type='forecast' AND status='open'
│   ├─ recentFeedback:   persona_memory type='editor_feedback' LIMIT 3
│   │                    (Victor's last 3 FEEDBACK RECORDS — не статті)
│   └─ directiveHistory: persona_memory (victor-kane) type='directive_history'
│                         WHERE persona_ref=X LIMIT 3
│
├─ verifyPreviousDirectives() — чи аналітики виконали минулі директиви (before evaluate)
│
├─ detectPatterns() — per persona:
│   ├─ repeated opening phrase (same first 3 words in 3+ articles)
│   ├─ topic overlap (same keyword group 3+ times in 7 days)
│   └─ weak/question conclusion (no numeric threshold in closing paragraph)
│
├─ detectOverlap() — embeddings, без LLM
│   ├─ cosine similarity між статтями аналітиків (threshold 0.6)
│   └─ OverlapReport → іде в кожен individual eval як контекст
│
├─ ПАРАЛЕЛЬНО: evaluateAnalyst() × N published — claude-sonnet-4-5
│   ├─ кожен аналітик отримує dedicated call (більше tokens, глибша оцінка)
│   ├─ бачить: свою статтю + history + patterns + relevant overlap
│   └─ isBaseline = ctx.recentFeedback.length === 0
│       → true: baseline mode (перша стаття, no compliance language)
│       → false: directive mode (чи виконав попередню директиву?)
│
├─ synthesizeDeskNote() — claude-haiku (синтез з 3 scorecards)
│   input:  structured scorecards + overlap summary
│   output: desk_note (1-2 sentences, must match actual scores)
│
├─ saveFeedbackToAnalysts()
│   └─ пише type='editor_feedback' в persona_memory КОЖНОГО аналітика
│      [з'являється в buildContext() при наступній генерації]
│
├─ saveDirectiveHistory() — нові директиви в Victor's own memory
│
├─ updateEditorialStandards() — rolling avg score + trend per analyst
│
└─ saveEditorSession() + logRun()
```

---

## EditorialSession (вивід evaluate())

```typescript
interface EditorialSession {
  date: string;
  editorial_session: {
    [personaId: string]: {
      published_today:  boolean;
      score:            number;            // 0-100
      strengths:        string[];          // max 2
      priority_fix:     string;            // ONE specific thing
      directive:        string;            // instruction for next article
      pattern_warning:  string | null;
    } | null;   // null якщо не публікував сьогодні
  };
  desk_note: string;   // загальний коментар по редакції, 1-2 речення
}
```

**Rubric (20 pts × 5 = 100):**
1. Thesis clarity — one clear, arguable point?
2. Data specificity — named metrics + values, source cited?
3. Voice consistency — sounds like THIS analyst?
4. Signal value — actionable/novel?
5. Conclusion strength — specific watch/threshold, not a question?

---

## Власна пам'ять Victor Kane

| memory_type | Що зберігає | Кількість |
|-------------|-------------|-----------|
| `session` | date, desk_note, scores per analyst | 1/день |
| `directive_history` | directive + followed (true/false/null) | ~15-20 активних |
| `editorial_standard` | avg_score_30d + trend (improving/stable/declining) | 3 (по аналітику, upsert) |

**`directive_history.followed`** — Victor перевіряє наступну статтю аналітика і проставляє `true/false`. Якщо директива проігнорована — наступний feedback це зазначає.

**`editorial_standard.trend`** — Victor знає чи аналітик росте або деградує без перечитування всіх статей.

---

## Як feedback потрапляє в генерацію

Два рівні інтеграції:

**1. System prompt** (вже реалізовано в усіх `generate.ts`):
```
EDITORIAL DIRECTIVE:
Your context may include feedback from Victor Kane (Chief Editor).
If it does — treat it as a direct instruction, not a suggestion:
- "Priority fix" → the ONE thing you must improve in THIS article
- "Directive" → active standing instruction, apply it now
- "Pattern warning" → consciously avoid this opening or structure
Victor Kane's feedback overrides your default patterns. Ignoring it is not an option.
```

**2. buildContext() шар** (⚠️ ще не реалізовано — залишилось):
```typescript
// Додати в buildContext() кожного аналітика:
const { data: editorFeedback } = await supabase
  .from('persona_memory')
  .select('content, metadata, created_at')
  .eq('persona_id', PERSONA_ID)
  .eq('memory_type', 'editor_feedback')
  .order('created_at', { ascending: false })
  .limit(1);

// Додати як шар в контекст:
if (editorFeedback?.length) {
  parts.push('=== Editorial feedback (Victor Kane) ===');
  parts.push(editorFeedback[0].content);
}
```
Без цього шару аналітики бачать інструкцію в system prompt, але не бачать конкретний feedback. Потрібно додати в `elena-voss/index.ts`, `leo-cruz/index.ts`, `marcus-webb/index.ts`.

---

## detectPatterns() — що перевіряє

| Перевірка | Порогове значення | Приклад попередження |
|-----------|-------------------|---------------------|
| Repeated opening | Ті самі перші 3 слова в 3+ статтях | "Opening 'Exchange inflows hit' — 3rd article" |
| Topic overlap | Ключова група в 3+ статтях за 7 днів | "Topic 'exchange flows' covered 3× in 7 days" |
| Question conclusion | Стаття закінчується знаком питання | "Conclusion ends with a question" |
| No numeric threshold | Немає цифри в останньому параграфі | "Weak conclusion: no specific threshold" |

---

## Розклад

```
vercel.json: { "path": "/api/cron/chief-editor", "schedule": "0 21 * * *" }
```

Після всіх аналітиків: Marcus 07:00/13:00, Elena 08:00, Leo 10:00 → Victor 21:00.

**Quiet desk:** якщо ніхто не публікував → Victor не запускається, один `persona_runs` запис зі status silent.

---

## Admin Panel (`/flows/editorial` → Personas tab)

Victor Kane показується окремою карткою з **amber темою** (відрізняється від синіх карток аналітиків).

| Елемент | Дія |
|---------|-----|
| ▶ Run Feedback | Ручний запуск evaluate() + збереження feedback |
| Recent Sessions | Останні 10 сесій з scores per analyst |
| Немає: | Pull Data, Evaluate, Dry Generate, Self-Work |

---

## ENV Variables

| Змінна | Використання | Статус |
|--------|-------------|--------|
| `ANTHROPIC_API_KEY` | evaluate() | ✅ є |
| `SANITY_PROJECT_ID` + `SANITY_TOKEN` | читання статей | ✅ є |
| `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | persona_memory | ✅ є |
| `CRON_SECRET` | cron auth | ✅ є |

**Нових ключів не потрібно.**

---

## Відомі особливості

**Quiet desk є нормою** — Victor мовчить більшість днів (аналітики не завжди пишуть щодня). Це нормально, не баг.

**Pattern detection — евристичний** — перевіряє перші 3 слова і список keyword груп. Для більш точного аналізу потрібен LLM-based comparison (Phase 2).

**directive_history.followed** — верифікація часткова: перевіряється тільки кілька простих патернів (кінцівка з питанням і т.д.). Повна верифікація "чи аналітик застосував директиву" потребує LLM (Phase 2).

**isBaseline визначається по recentFeedback, не по directives** — `ctx.recentFeedback.length === 0` є єдиним надійним індикатором. Orphaned directive records з попередніх broken sessions не блокують baseline mode.

**Slug bug** — у ранніх сесіях `article_slug` приходив як `null` через помилку в GROQ projection (`r.slug.current` замість `r.slug`). Виправлено в `data-collector.ts`. Якщо в directive tracker є записи без slug — це сліди до-фіксу.

**WHO YOU MANAGE + BANNED DIRECTIVES** — ці секції є і в DB `system_prompt` і в code промті `evaluate.ts`. DB `system_prompt` для Victor не передається в Claude API call (немає `system:` параметра), тому все критичне повинно бути в `evaluate.ts` prompt безпосередньо.

**buildContext() editor_feedback шар** — реалізовано в усіх трьох персонах (`elena-voss`, `leo-cruz`, `marcus-webb` `index.ts`). Формат:
```
=== Victor Kane — last directive ===
Score: 74/100 (2026-06-10)
Priority fix: "..."
Directive: "..." (PENDING або resolved)
Pattern: [none]
```
Якщо `status=resolved` → директива не показується в контексті (не захаращує промт).
