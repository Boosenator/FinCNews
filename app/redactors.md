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