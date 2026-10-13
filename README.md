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

### Вариант A — Ollama (бесплатно, локально)

1. Установи [Ollama](https://ollama.com/download).
2. Скачай модель:
   ```bash
   ollama pull llama3.2
   ```
3. Запусти с CORS для браузера (порт офиса `8765`):
   ```bash
   OLLAMA_ORIGINS="http://127.0.0.1:8765,http://localhost:8765" ollama serve
   ```
   Если Ollama уже как приложение macOS — закрой его и запусти команду выше в терминале.
4. В Pixel Office: **AI Settings** → провайдер **Ollama** → модель `llama3.2` → включи LLM → **Сохранить** → **Тест Ada**.

Ключ не нужен. Всё крутится на твоём Mac.

### Вариант B — облако (платно)

OpenRouter / OpenAI / Anthropic: ключ в **AI Settings**.

Каждый агент работает под своим system prompt (CEO / Frontend / Backend / QA / Research / Design).

## Ассеты

Спрайты и layout адаптированы из [pixel-agents-hq/pixel-agents](https://github.com/pixel-agents-hq/pixel-agents) (MIT).  
Персонажи основаны на [Metro City](https://jik-a-4.itch.io/metrocity-free-topdown-character-pack) (JIK-A-4).
