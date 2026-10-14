# Pixel Office

Пиксельный офис с ИИ-агентами (демо).

## Версии

| Файл | Описание |
|------|----------|
| `index.html` + `office.js` + `assets/` | **Текущая** — визуал как у [pixel-agents](https://github.com/pixel-agents-hq/pixel-agents) (MIT) |
| `legacy-v1-procedural.html` | **Legacy v1** — первая процедурная версия офиса |

## Запуск

```bash
cd pixel-office
python3 -m http.server 8765
```

Открой: http://127.0.0.1:8765/

- Текущая: http://127.0.0.1:8765/
- Legacy: http://127.0.0.1:8765/legacy-v1-procedural.html

## Живой ИИ (роли агентов)

### Вариант A — Google Gemini (рекомендуем, бесплатно, без нагрузки на Mac)

1. Ключ: [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. В Pixel Office: **AI Settings** → **Google Gemini** → ключ → модель `gemini-2.5-flash-lite` (free-friendly) → **Тест Ada**.
3. Если «high demand» — подожди минуту или переключись на **Groq**: [console.groq.com/keys](https://console.groq.com/keys), модель `llama-3.3-70b-versatile`.

### Вариант B — Ollama (локально)

Тянет RAM/CPU ноутбука. Модель: `qwen2.5:7b` и т.п. Нужен CORS для браузера.

### Вариант C — платное облако

OpenRouter / OpenAI / Anthropic.

Каждый агент работает под своим system prompt (CEO / Frontend / Backend / QA / Research / Design).
Запросы «за и против» / бизнес-идеи уходят в полноценный аналитический отчёт (.html → PDF).

## Ассеты

Спрайты и layout адаптированы из [pixel-agents-hq/pixel-agents](https://github.com/pixel-agents-hq/pixel-agents) (MIT).  
Персонажи основаны на [Metro City](https://jik-a-4.itch.io/metrocity-free-topdown-character-pack) (JIK-A-4).
