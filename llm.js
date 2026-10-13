/**
 * LLM client for Pixel Office agents.
 * Supports: Ollama (local, free), OpenAI, OpenRouter, Anthropic.
 * Cloud keys are stored only in localStorage (never committed).
 */
(() => {
  const STORAGE_KEY = "pixel_office_llm_v1";

  const DEFAULTS = {
    enabled: false,
    provider: "ollama", // ollama | openrouter | openai | anthropic
    apiKey: "",
    model: "llama3.2",
    baseUrl: "", // optional override
  };

  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      return { ...DEFAULTS, ...JSON.parse(raw) };
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
    if (cfg.provider === "ollama") return "http://127.0.0.1:11434/v1/chat/completions";
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
    if (provider !== "ollama") return errMsg;
    const lower = String(errMsg || "").toLowerCase();
    if (
      lower.includes("failed to fetch") ||
      lower.includes("networkerror") ||
      lower.includes("cors") ||
      lower.includes("load failed")
    ) {
      return (
        errMsg +
        " — Запусти Ollama с CORS: OLLAMA_ORIGINS=\"http://127.0.0.1:8765,http://localhost:8765\" ollama serve"
      );
    }
    return errMsg;
  }

  async function chat({ system, user, temperature = 0.4 }) {
    const cfg = loadConfig();
    if (needsApiKey(cfg.provider) && !cfg.apiKey) {
      throw new Error("Нет API-ключа. Открой Settings и сохрани ключ.");
    }
    if (!cfg.model) throw new Error("Не указана модель.");

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
          max_tokens: 1200,
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

    // OpenAI-compatible (Ollama / OpenAI / OpenRouter / custom)
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

    let res;
    try {
      res = await fetch(chatCompletionsUrl(cfg), {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: cfg.model,
          temperature,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
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
    loadConfig,
    saveConfig,
    isReady,
    needsApiKey,
    chat,
    askAgent,
    extractJson,
    listOllamaModels,
    chatCompletionsUrl,
  };
})();
