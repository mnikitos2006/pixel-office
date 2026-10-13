/**
 * LLM client for Pixel Office agents.
 * Supports: OpenAI, OpenRouter, Anthropic (Messages API).
 * Key is stored only in localStorage (never committed).
 */
(() => {
  const STORAGE_KEY = "pixel_office_llm_v1";

  const DEFAULTS = {
    enabled: false,
    provider: "openrouter", // openrouter | openai | anthropic
    apiKey: "",
    model: "openai/gpt-4o-mini",
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

  function isReady() {
    const c = loadConfig();
    return !!(c.enabled && c.apiKey && c.model);
  }

  function endpoint(cfg) {
    if (cfg.baseUrl) return cfg.baseUrl.replace(/\/$/, "");
    if (cfg.provider === "anthropic") return "https://api.anthropic.com/v1/messages";
    if (cfg.provider === "openai") return "https://api.openai.com/v1/chat/completions";
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

  async function chat({ system, user, temperature = 0.4 }) {
    const cfg = loadConfig();
    if (!cfg.apiKey) throw new Error("Нет API-ключа. Открой Settings и сохрани ключ.");

    if (cfg.provider === "anthropic") {
      const res = await fetch(endpoint(cfg), {
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

    // OpenAI-compatible (OpenAI / OpenRouter / custom)
    const headers = {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.apiKey}`,
    };
    if (cfg.provider === "openrouter") {
      headers["HTTP-Referer"] = location.origin;
      headers["X-Title"] = "Pixel Office";
    }

    const res = await fetch(endpoint(cfg), {
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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || `LLM HTTP ${res.status}`);
    }
    const text = data?.choices?.[0]?.message?.content || "";
    return { text, raw: data, json: extractJson(text) };
  }

  async function askAgent(agentId, userPrompt) {
    const role = window.OfficeRoles?.getRole(agentId);
    if (!role) throw new Error("Unknown agent: " + agentId);
    return chat({ system: role.system, user: userPrompt });
  }

  window.OfficeLLM = {
    DEFAULTS,
    loadConfig,
    saveConfig,
    isReady,
    chat,
    askAgent,
    extractJson,
  };
})();
