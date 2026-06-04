# FinCNews — Email Setup Guide

> Домен `finc.news` на Vercel NS — DNS записи через Vercel CLI або Dashboard.
> Відправка — через `e.finc.news` (Resend), отримання — `finc.news` (ImprovMX).

---

## Статус реалізації

| Крок | Що | Статус |
|------|----|--------|
| 1 | ImprovMX + MX в Vercel | ✅ Done |
| 2 | SPF + DMARC | ✅ Done |
| 3 | Оновити email в коді (`@fincnews.com` → `@finc.news`) | ✅ Done |
| 4 | Resend: домен `e.finc.news` верифіковано, API key в Vercel | ✅ Done |
| 5 | Supabase: таблиці `subscribers` + `email_logs` | ✅ Done |
| 6 | Форма підписки (floating bar) | ✅ Done |
| 7 | DOI флоу (`/api/subscribe` → confirm email → `/api/confirm`) | ✅ Done |
| 8 | Email templates (confirmation, welcome, breaking, digest) | ✅ Done |
| 9 | Email tab в адмінці (stats, logs, subscriber list) | ✅ Done |
| 10 | `e.finc.news` → redirect на `finc.news` (next.config) | ✅ Done |
| 11 | Plain-text версія листів + підвищення контрасту | ✅ Done |
| — | Breaking alert: підключити тригер (n8n або API route) | 🔜 Pending |
| — | Weekly digest: cron + pull статей із Sanity | 🔜 Pending |
| — | Підписна форма: A/B тест позиціонування | 🔜 Optional |

---

## Deliverability — SpamAssassin аудит (2026-06-04)

**Результат: Score -1.4** (нижче -5 = spam; нижче 0 = добре)

| Правило | Скор | Що зроблено |
|---------|------|-------------|
| `DKIM_SIGNED` / `DKIM_VALID` / `DKIM_VALID_AU` | ✅ | DKIM через Resend на `e.finc.news` |
| `SPF_PASS` | ✅ | SPF на `e.finc.news` |
| `HTML_FONT_LOW_CONTRAST` | ⚠️ → ✅ | Виправлено: MUTED підвищено з `#52525b` (2.4:1) до `#a1a1aa` (7.3:1) |
| `HTML_IMAGE_ONLY_28` | ⚠️ → ✅ | Виправлено: більше тексту в листах + plain-text версія |
| `FROM_FMBLA_NEWDOM28` | ⏳ | Домен < 28 днів. Зникне автоматично ~2026-06-18 |
| `SPF_HELO_NONE` | ℹ️ | Resend/AWS інфраструктура, не контролюється |

### Що виправлено в коді
- `lib/emails.ts`: колір `FOOTER` = `#a1a1aa` замість `#52525b`
- `lib/emails.ts`: confirmation email містить опис сервісу + 2 bullet-секції
- `lib/emails.ts`: всі функції тепер повертають `{ html, text }` — додана plain-text версія
- `app/api/subscribe/route.ts` + `confirm/route.ts`: відправляють `html` + `text`

---

## Архітектура

### Sending domain: `e.finc.news`
- SPF: `v=spf1 include:_spf.resend.com ~all` (на `e`)
- DKIM: CNAME записи від Resend (на `resend._domainkey.e`)
- DMARC: `v=DMARC1; p=quarantine; rua=mailto:tech@e.finc.news` (на `_dmarc.e`)

### From адреси
- `tech@e.finc.news` — транзакційні (DOI confirmation, welcome)
- `news@e.finc.news` — розсилки (breaking alerts, weekly digest)

### DOI флоу
```
Юзер вводить email у NewsletterBar
  → POST /api/subscribe
    → Supabase: запис зі status='pending', confirm_token=uuid
    → Resend: sends confirmation email з посиланням
    → email_logs: запис (type='confirmation', status='sent'|'failed')
  → Юзер кликає посилання
    → GET /api/confirm?token=xxx
      → Supabase: status → 'confirmed', confirmed_at = now()
      → Resend: sends welcome email
      → email_logs: запис (type='welcome')
      → redirect → /subscribed
```

### Відписка
```
Посилання в листі → GET /api/unsubscribe?token=xxx
  → Supabase: status → 'unsubscribed'
  → redirect → /unsubscribed
```

### Supabase таблиці
- `subscribers` — email, status, confirm_token, confirmed_at (migration_006)
- `email_logs` — type, recipient, status, resend_id, sent_at (migration_007)

---

## Що залишилось зробити

### Breaking alerts
Готовий шаблон `breakingEmail()` в `lib/emails.ts`.
Потрібно підключити тригер — наприклад в n8n після публікації статті з тегом `breaking`:

```typescript
import { breakingEmail } from "@/lib/emails";
import { EMAIL_FROM_NEWS } from "@/lib/config";

const { html, text } = breakingEmail({ headline, excerpt, articleUrl, token, baseUrl });
await resend.emails.send({ from: EMAIL_FROM_NEWS, to: subscriberEmail, subject: headline, html, text });
```

Або через Resend Broadcasts для масової відправки.

### Weekly digest
Готовий шаблон `digestEmail()` в `lib/emails.ts`.
Потрібно:
1. Cron job (Vercel Cron або n8n) — щоп'ятниці
2. Pull топ-статей із Sanity за тиждень
3. Витягнути всіх `confirmed` підписників із Supabase
4. Відправити через `news@e.finc.news`

### e.finc.news web redirect
Щоб `https://e.finc.news` редіректило на `finc.news`:
```bash
vercel dns add finc.news e A 76.76.21.21
```
Потім додати `e.finc.news` як домен у Vercel Project Settings → Domains.
Redirect вже налаштовано в `next.config.mjs`.

---

## Частина 1 — Отримання пошти (ImprovMX) ✅

Форвардить `@finc.news` → Gmail. MX записи додані.

```
editorial  →  твій_gmail@gmail.com
privacy    →  твій_gmail@gmail.com
legal      →  твій_gmail@gmail.com
ads        →  твій_gmail@gmail.com
```

---

## Частина 2 — Розсилка (Resend)

[resend.com](https://resend.com) — ідеально для Next.js, безкоштовно 3000 листів/місяць.

`RESEND_API_KEY` — додати в `.env.local` та Vercel env vars.
