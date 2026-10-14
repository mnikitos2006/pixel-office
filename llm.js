/**
 * LLM client for Pixel Office agents.
 * Supports: Gemini (free cloud), Groq (free cloud), Ollama, OpenAI, OpenRouter, Anthropic.
 * Cloud keys are stored only in localStorage (never committed).
 */
(() => {
  const STORAGE_KEY = "pixel_office_llm_v1";

  const DEFAULTS = {
    enabled: false,
    provider: "gemini", // gemini | groq | ollama | openrouter | openai | anthropic
    apiKey: "",
    // Flash-Lite — обычно доступнее на free tier и меньше «high demand»
    model: "gemini-2.5-flash-lite",
    baseUrl: "", // optional override
  };

  const PROVIDER_MODELS = {
    gemini: "gemini-2.5-flash-lite",
    groq: "llama-3.3-70b-versatile",
    ollama: "llama3.2",
    openrouter: "openai/gpt-4o-mini",
    openai: "gpt-4o-mini",
    anthropic: "claude-sonnet-4-5",
  };

  /** Prefer lite/free-friendly models first when auto-picking */
  const GEMINI_PREFERRED = [
    "gemini-2.5-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-2.5-flash",
    "gemini-3.0-flash",
    "gemini-flash-latest",
    "gemini-3.8-flash",
    "gemini-3.6-flash",
  ];

  /** Retired / overloaded full Flash → prefer lite for free keys */
  const GEMINI_MODEL_ALIASES = {
    "gemini-3.0-flash": "gemini-2.5-flash-lite",
    "gemini-2.5-flash": "gemini-2.5-flash-lite",
    "gemini-2.0-flash": "gemini-2.5-flash-lite",
    "gemini-2.0-flash-001": "gemini-2.5-flash-lite",
    "gemini-1.5-flash": "gemini-2.5-flash-lite",
    "gemini-1.5-flash-001": "gemini-2.5-flash-lite",
    "gemini-1.5-flash-latest": "gemini-2.5-flash-lite",
  };

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function isHighDemandError(msg) {
    return /high demand|resource.?exhausted|quota|rate.?limit|try again later|429/i.test(
      String(msg || ""),
    );
  }

  function extractSuggestedGeminiModel(errMsg) {
    const m = String(errMsg || "").match(/use models\/([a-z0-9._-]+)/i);
    return m ? m[1] : null;
  }

  function normalizeModel(provider, model) {
    let m = String(model || "").trim();
    if (provider === "gemini") {
      m = m.replace(/^models\//, "");
      if (GEMINI_MODEL_ALIASES[m]) m = GEMINI_MODEL_ALIASES[m];
    }
    return m || PROVIDER_MODELS[provider] || DEFAULTS.model;
  }

  function geminiBase(cfg) {
    return (cfg.baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
  }

  async function listGeminiModels(cfgOverride) {
    const cfg = { ...loadConfig(), ...(cfgOverride || {}) };
    if (!cfg.apiKey) throw new Error("Нет Gemini API key");
    const url = `${geminiBase(cfg)}/models?key=${encodeURIComponent(cfg.apiKey)}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message || `Gemini ListModels HTTP ${res.status}`);
    }
    const models = (data.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => String(m.name || "").replace(/^models\//, ""))
      .filter(Boolean);
    return models;
  }

  function pickBestGeminiModel(models) {
    const set = new Set(models);
    for (const pref of GEMINI_PREFERRED) {
      if (set.has(pref)) return pref;
    }
    const lite = models.find((m) => /flash-?lite/i.test(m) && !/embed|tts|image|live/i.test(m));
    if (lite) return lite;
    const flash = models.find((m) => /flash/i.test(m) && !/embed|tts|image|live/i.test(m));
    return flash || models[0] || PROVIDER_MODELS.gemini;
  }

  async function resolveGeminiModel(cfg) {
    const wanted = normalizeModel("gemini", cfg.model);
    try {
      const models = await listGeminiModels(cfg);
      if (models.includes(wanted)) return wanted;
      const best = pickBestGeminiModel(models);
      if (best && best !== wanted) {
        saveConfig({ model: best });
      }
      return best;
    } catch {
      return wanted;
    }
  }

  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      const cfg = { ...DEFAULTS, ...JSON.parse(raw) };
      cfg.model = normalizeModel(cfg.provider, cfg.model);
      return cfg;
    } catch {
      return { ...DEFAULTS };
    }
  }

  function saveConfig(cfg) {
    const next = { ...loadConfig(), ...cfg };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      enabled: !!next.enabled,
      provider: next.provider,
      apiKey: next.apiKey || "",
      model: next.model || DEFAULTS.model,
      baseUrl: next.baseUrl || "",
    }));
    return loadConfig();
  }

  function needsApiKey(provider) {
    return provider !== "ollama";
  }

  function isReady() {
    const c = loadConfig();
    if (!c.enabled || !c.model) return false;
    if (needsApiKey(c.provider) && !c.apiKey) return false;
    return true;
  }

  function chatCompletionsUrl(cfg) {
    if (cfg.baseUrl) {
      const base = cfg.baseUrl.replace(/\/$/, "");
      if (base.endsWith("/chat/completions")) return base;
      if (base.endsWith("/v1")) return base + "/chat/completions";
      return base;
    }
    if (cfg.provider === "anthropic") return "https://api.anthropic.com/v1/messages";
    if (cfg.provider === "openai") return "https://api.openai.com/v1/chat/completions";
    if (cfg.provider === "groq") return "https://api.groq.com/openai/v1/chat/completions";
    if (cfg.provider === "ollama") return "http://127.0.0.1:11434/v1/chat/completions";
    if (cfg.provider === "gemini") return null; // special path
    return "https://openrouter.ai/api/v1/chat/completions";
  }

  function extractJson(text) {
    if (!text) return null;
    const trimmed = text.trim();
    try {
      return JSON.parse(trimmed);
    } catch {
      /* continue */
    }
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) {
      try {
        return JSON.parse(fence[1].trim());
      } catch {
        /* continue */
      }
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }

  function corsHint(provider, errMsg) {
    const lower = String(errMsg || "").toLowerCase();
    if (provider === "ollama") {
      if (
        lower.includes("failed to fetch") ||
        lower.includes("networkerror") ||
        lower.includes("cors") ||
        lower.includes("load failed")
      ) {
        return (
          errMsg +
          ' — Запусти Ollama с CORS: OLLAMA_ORIGINS="http://127.0.0.1:8765,http://localhost:8765" ollama serve'
        );
      }
    }
    if (provider === "gemini" && (lower.includes("failed to fetch") || lower.includes("cors"))) {
      return errMsg + " — Проверь ключ Gemini и что модель доступна в AI Studio.";
    }
    return errMsg;
  }

  async function geminiGenerate(cfg, model, { system, user, temperature }) {
    const url = `${geminiBase(cfg)}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: 8192,
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  async function chatGemini(cfg, { system, user, temperature = 0.4 }) {
    let model = normalizeModel("gemini", cfg.model || PROVIDER_MODELS.gemini);
    let res;
    let data;
    try {
      ({ res, data } = await geminiGenerate(cfg, model, { system, user, temperature }));
    } catch (err) {
      throw new Error(corsHint("gemini", err.message || String(err)));
    }

    // Auto-heal: model missing / retired → suggested id or ListModels → retry once
    let errMsg = data?.error?.message || "";
    if (!res.ok && /not found|no longer available|not supported/i.test(errMsg)) {
      let next = extractSuggestedGeminiModel(errMsg);
      if (!next) {
        try {
          next = pickBestGeminiModel(await listGeminiModels(cfg));
        } catch {
          next = PROVIDER_MODELS.gemini;
        }
      }
      if (next && next !== model) {
        model = next;
        saveConfig({ model });
        try {
          ({ res, data } = await geminiGenerate(cfg, model, { system, user, temperature }));
        } catch (err) {
          throw new Error(corsHint("gemini", err.message || String(err)));
        }
      }
      errMsg = data?.error?.message || "";
    }

    // High demand / rate limit → backoff retries, then try lite alternate
    if (!res.ok && isHighDemandError(errMsg || `HTTP ${res.status}`)) {
      for (const wait of [1200, 2500, 4000]) {
        await sleep(wait);
        try {
          ({ res, data } = await geminiGenerate(cfg, model, { system, user, temperature }));
        } catch (err) {
          throw new Error(corsHint("gemini", err.message || String(err)));
        }
        errMsg = data?.error?.message || "";
        if (res.ok) break;
        if (!isHighDemandError(errMsg || `HTTP ${res.status}`)) break;
      }
    }

    if (!res.ok && isHighDemandError(data?.error?.message || `HTTP ${res.status}`)) {
      try {
        const models = await listGeminiModels(cfg);
        const lite = models.find((m) => /flash-?lite/i.test(m)) || pickBestGeminiModel(models);
        if (lite && lite !== model) {
          model = lite;
          saveConfig({ model });
          await sleep(800);
          ({ res, data } = await geminiGenerate(cfg, model, { system, user, temperature }));
        }
      } catch {
        /* keep original */
      }
    }

    if (!res.ok) {
      const msg = data?.error?.message || data?.message || `Gemini HTTP ${res.status}`;
      const suggested = extractSuggestedGeminiModel(msg);
      if (isHighDemandError(msg)) {
        throw new Error(
          msg +
            " — Бесплатный Gemini сейчас перегружен. Подожди 20–60 сек и нажми Тест снова, " +
            "поставь gemini-2.5-flash-lite, или переключись на Groq (тоже бесплатно).",
        );
      }
      throw new Error(
        msg +
          (suggested
            ? ` — Поставь модель ${suggested} (или «Подобрать модель»).`
            : /not found|no longer available|not supported/i.test(msg)
              ? " — Нажми «Подобрать модель» или поставь gemini-2.5-flash-lite."
              : ""),
      );
    }
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || "").join("\n");
    if (!text) {
      const block = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason;
      throw new Error(block ? `Gemini пустой ответ (${block})` : "Gemini вернула пустой ответ");
    }
    return { text, raw: data, json: extractJson(text), model };
  }

  async function chat({ system, user, temperature = 0.4 }) {
    const cfg = loadConfig();
    if (needsApiKey(cfg.provider) && !cfg.apiKey) {
      throw new Error("Нет API-ключа. Открой Settings и сохрани ключ.");
    }
    if (!cfg.model) throw new Error("Не указана модель.");

    if (cfg.provider === "gemini") {
      return chatGemini(cfg, { system, user, temperature });
    }

    if (cfg.provider === "anthropic") {
      const res = await fetch(chatCompletionsUrl(cfg), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": cfg.apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: cfg.model || "claude-sonnet-4-5",
          max_tokens: 4096,
          temperature,
          system,
          messages: [{ role: "user", content: user }],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.message || `Anthropic HTTP ${res.status}`);
      }
      const text = (data.content || []).map((p) => p.text || "").join("\n");
      return { text, raw: data, json: extractJson(text) };
    }

    // OpenAI-compatible (Groq / Ollama / OpenAI / OpenRouter / custom)
    const headers = { "content-type": "application/json" };
    if (cfg.apiKey) {
      headers.authorization = `Bearer ${cfg.apiKey}`;
    } else if (cfg.provider === "ollama") {
      headers.authorization = "Bearer ollama";
    }

    if (cfg.provider === "openrouter") {
      headers["HTTP-Referer"] = location.origin;
      headers["X-Title"] = "Pixel Office";
    }

    const body = {
      model: cfg.model,
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    };
    if (cfg.provider === "groq" || cfg.provider === "openai" || cfg.provider === "openrouter") {
      body.max_tokens = 4096;
    }

    let res;
    try {
      res = await fetch(chatCompletionsUrl(cfg), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new Error(corsHint(cfg.provider, err.message || String(err)));
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || data?.message || `LLM HTTP ${res.status}`;
      throw new Error(corsHint(cfg.provider, msg));
    }
    const text = data?.choices?.[0]?.message?.content || "";
    return { text, raw: data, json: extractJson(text) };
  }

  async function askAgent(agentId, userPrompt) {
    const role = window.OfficeRoles?.getRole(agentId);
    if (!role) throw new Error("Unknown agent: " + agentId);
    return chat({ system: role.system, user: userPrompt });
  }

  async function listOllamaModels() {
    const cfg = loadConfig();
    const base = (cfg.baseUrl || "http://127.0.0.1:11434").replace(/\/$/, "")
      .replace(/\/v1\/chat\/completions$/, "")
      .replace(/\/v1$/, "");
    const res = await fetch(base + "/api/tags");
    if (!res.ok) throw new Error("Ollama HTTP " + res.status);
    const data = await res.json();
    return (data.models || []).map((m) => m.name);
  }

  window.OfficeLLM = {
    DEFAULTS,
    PROVIDER_MODELS,
    loadConfig,
    saveConfig,
    isReady,
    needsApiKey,
    chat,
    askAgent,
    extractJson,
    listOllamaModels,
    listGeminiModels,
    pickBestGeminiModel,
    resolveGeminiModel,
    chatCompletionsUrl,
  };
})();

