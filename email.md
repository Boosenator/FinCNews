# FinCNews — Email Setup Guide

> Домен `finc.news` на Vercel NS — DNS записи додаємо через Vercel CLI або Dashboard.

---

## ⚠️ Проблема в коді

Всі email-адреси на сайті зараз `@fincnews.com`, але домен — `finc.news`.
Після налаштування пошти потрібно замінити адреси в коді (список файлів — в кінці).

---

## Частина 1 — Отримання пошти

### Варіант A: ImprovMX *(безкоштовно, найпростіше)*

Форвардить `@finc.news` → на будь-який Gmail/ящик. Відповідати — з Gmail.

**Крок 1 — Зареєструватись:**
[improvmx.com](https://improvmx.com) → Add domain → `finc.news`

ImprovMX покаже два MX-записи для додавання.

**Крок 2 — Додати MX в Vercel DNS:**
```bash
vercel dns add finc.news @ MX mx1.improvmx.com 10
vercel dns add finc.news @ MX mx2.improvmx.com 20
```

Або в Vercel Dashboard → Domains → finc.news → DNS Records → Add.

**Крок 3 — Додати aliases в ImprovMX:**
```
editorial  →  твій_gmail@gmail.com
privacy    →  твій_gmail@gmail.com
legal      →  твій_gmail@gmail.com
ads        →  твій_gmail@gmail.com
```

**Крок 4 — Gmail "Send as" (щоб відповідати з editorial@finc.news):**
Gmail → Settings → Accounts → "Send mail as" → Add address → `editorial@finc.news`
→ SMTP-сервер: `smtp.improvmx.com`, порт 587, логін/пароль з ImprovMX

**Плюси:** безкоштовно, 5 хвилин, нічого нового вчити  
**Мінуси:** форвард, не повноцінний ящик

---

### Варіант B: Zoho Mail *(безкоштовно, повноцінний ящик)*

Повноцінний `editorial@finc.news` з веб-інтерфейсом. До 5 ящиків безкоштовно.

**Крок 1:**
[zoho.com/mail](https://www.zoho.com/mail/) → Add Domain → `finc.news`

**Крок 2 — MX записи в Vercel:**
```bash
vercel dns add finc.news @ MX mx.zoho.com 10
vercel dns add finc.news @ MX mx2.zoho.com 20
vercel dns add finc.news @ MX mx3.zoho.com 50
```

**Крок 3 — TXT для підтвердження домену:**
Zoho надасть TXT-рядок типу `zoho-verification=xxxxx`:
```bash
vercel dns add finc.news @ TXT "zoho-verification=xxxxx"
```

**Крок 4:** Створити ящики `editorial`, `privacy`, `legal`, `ads`

**Плюси:** безкоштовно, можна відправляти, свій домен  
**Мінуси:** не Gmail-інтерфейс

---

### Варіант C: Google Workspace *($6/місяць)*

Повноцінний Gmail з `@finc.news`. Найзручніше, але платно.

**Крок 1:** [workspace.google.com](https://workspace.google.com) → Start free trial → домен `finc.news`

**Крок 2 — MX в Vercel:**
```bash
vercel dns add finc.news @ MX aspmx.l.google.com 1
vercel dns add finc.news @ MX alt1.aspmx.l.google.com 5
vercel dns add finc.news @ MX alt2.aspmx.l.google.com 5
vercel dns add finc.news @ MX alt3.aspmx.l.google.com 10
vercel dns add finc.news @ MX alt4.aspmx.l.google.com 10
```

**Рекомендація:** один ящик `hello@finc.news` + email aliases (editorial, privacy, legal, ads) — замість 4 платних ящиків.

---

## Частина 2 — Налаштувати відправку (SPF + DKIM)

Незалежно від провайдера — додай SPF щоб листи не потрапляли в спам:

**ImprovMX:**
```bash
vercel dns add finc.news @ TXT "v=spf1 include:spf.improvmx.com ~all"
```

**Zoho:**
```bash
vercel dns add finc.news @ TXT "v=spf1 include:zoho.com ~all"
```

**Google Workspace:**
```bash
vercel dns add finc.news @ TXT "v=spf1 include:_spf.google.com ~all"
```

**DMARC (додати в будь-якому випадку):**
```bash
vercel dns add finc.news _dmarc TXT "v=DMARC1; p=quarantine; rua=mailto:editorial@finc.news"
```

---

## Частина 3 — Оновити адреси в коді

Після налаштування пошти — замінити в цих файлах `@fincnews.com` → `@finc.news`:

- `app/(site)/about/page.tsx` — editorial, ads
- `app/(site)/editorial-policy/page.tsx` — editorial
- `app/(site)/privacy-policy/page.tsx` — privacy (×4)
- `app/(site)/terms-and-conditions/page.tsx` — legal (×2)

Адреси:
```
editorial@fincnews.com  →  editorial@finc.news
privacy@fincnews.com    →  privacy@finc.news
legal@fincnews.com      →  legal@finc.news
ads@fincnews.com        →  ads@finc.news
```

---

## Частина 4 — Розсилка дайджестів (майбутнє)

### Рекомендація: Resend

[resend.com](https://resend.com) — ідеально для Next.js, безкоштовно 3000 листів/місяць.

**Крок 1 — Підключити домен:**
Resend Dashboard → Domains → Add → `finc.news`
Resend покаже DKIM-записи:
```bash
vercel dns add finc.news resend._domainkey TXT "p=MIGfMA0GC..."
```

**Крок 2:**
```bash
RESEND_API_KEY=re_xxxxxxxxxx  # додати у Vercel env vars
npm install resend @react-email/components
```

**Крок 3 — API route для дайджесту:**
```typescript
// app/api/digest/route.ts
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'FinCNews Digest <digest@finc.news>',
  to: subscribers,
  subject: `FinCNews Weekly — ${new Date().toLocaleDateString('en', { month: 'long', day: 'numeric' })}`,
  react: <DigestEmail articles={topArticles} />,
});
```

**Крок 4 — Підписна форма:**
Проста форма на сайті → зберігає email в Supabase таблицю `subscribers` → Resend бере список звідти.

---

## Рекомендований план

| Крок | Що | Час | Вартість |
|------|----|-----|---------|
| ~~1~~ | ~~ImprovMX + MX в Vercel~~ | ~~10 хв~~ | ✅ Done |
| 2 | SPF + DMARC | 5 хв | Безкоштовно |
| 3 | Оновити email в коді | 5 хв | — |
| 4 | Resend DKIM + API key | 10 хв | Безкоштовно |
| 5 | Підписна форма на сайті | — | Безкоштовно |
| 6 | Шаблон дайджесту + cron | — | Безкоштовно |
