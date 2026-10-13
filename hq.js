/**
 * Office HQ — hierarchical task routing through CEO (Ada).
 * Simulated agent replies for now; ready to swap for real LLM later.
 */
(() => {
  const CEO_ID = "ada";

  const AGENTS = [
    {
      id: "ada",
      name: "Ada",
      role: "CEO",
      title: "Главный агент",
      color: "#5b8cff",
      area: "executive",
      areaLabel: "Кабинет CEO",
      reportsTo: null,
      skills: ["strategy", "delegation", "review"],
      keywords: [],
    },
    {
      id: "grace",
      name: "Grace",
      role: "Frontend",
      title: "Фронтенд",
      color: "#3dd68c",
      area: "engineering",
      areaLabel: "Инжиниринг",
      reportsTo: "ada",
      skills: ["ui", "css", "react"],
      keywords: ["ui", "frontend", "фронт", "лендинг", "кнопк", "экран", "верстк", "интерфейс", "страниц"],
    },
    {
      id: "linus",
      name: "Linus",
      role: "Backend",
      title: "Бэкенд",
      color: "#f0b429",
      area: "engineering",
      areaLabel: "Инжиниринг",
      reportsTo: "ada",
      skills: ["api", "db", "deploy"],
      keywords: ["api", "backend", "бэк", "сервер", "баз", "deploy", "деплой", "endpoint", "auth"],
    },
    {
      id: "hopper",
      name: "Hopper",
      role: "QA",
      title: "Тестирование",
      color: "#ef6b6b",
      area: "engineering",
      areaLabel: "Инжиниринг",
      reportsTo: "ada",
      skills: ["qa", "e2e", "bugs"],
      keywords: ["qa", "тест", "баг", "bug", "провер", "e2e", "регресс", "качеств"],
    },
    {
      id: "turing",
      name: "Turing",
      role: "Research",
      title: "Исследования",
      color: "#c084fc",
      area: "creative",
      areaLabel: "Креатив / Research",
      reportsTo: "ada",
      skills: ["research", "analysis", "docs"],
      keywords: ["research", "анализ", "исслед", "memory", "данные", "сравни", "изуч", "договор", "документ", "word", "файл", "контракт", "соглашен"],
    },
    {
      id: "noether",
      name: "Noether",
      role: "Design",
      title: "Дизайн",
      color: "#38bdf8",
      area: "creative",
      areaLabel: "Креатив / Research",
      reportsTo: "ada",
      skills: ["design", "brand", "icons"],
      keywords: ["дизайн", "design", "иконк", "макет", "бренд", "цвет", "визуал", "pixel"],
    },
  ];

  const AREA_ANCHORS = {
    executive: { col: 4, row: 13 },
    engineering: { col: 5, row: 17 },
    creative: { col: 14, row: 14 },
  };

  function isDocRequest(text) {
    return !!(window.OfficeDeliverables && OfficeDeliverables.detectKind(text));
  }

  function pickAssignees(text) {
    const t = text.toLowerCase();
    // Document / contract → research + CEO delivery (Turing prepares, Ada ships file)
    if (isDocRequest(text)) {
      return [AGENTS.find((a) => a.id === "turing")].filter(Boolean);
    }
    const scored = AGENTS.filter((a) => a.id !== CEO_ID).map((a) => {
      const hits = a.keywords.filter((k) => t.includes(k)).length;
      return { a, hits };
    });
    scored.sort((x, y) => y.hits - x.hits);
    const matched = scored.filter((s) => s.hits > 0).map((s) => s.a);
    if (matched.length) return matched.slice(0, 3);
    // default cross-functional pair
    return [AGENTS.find((a) => a.id === "grace"), AGENTS.find((a) => a.id === "linus")];
  }

  function subtaskFor(agent, brief) {
    if (isDocRequest(brief) && agent.id === "turing") {
      return `Подготовить документ по запросу: «${brief}» — шаблон + проверка структуры`;
    }
    const map = {
      grace: `UI/фронт по задаче: «${brief}»`,
      linus: `API/бэкенд по задаче: «${brief}»`,
      hopper: `Тест-план и проверка: «${brief}»`,
      turing: `Исследование и выводы: «${brief}»`,
      noether: `Визуал/дизайн: «${brief}»`,
    };
    return map[agent.id] || `Часть работы: «${brief}»`;
  }

  function dmReply(agent, text) {
    const t = text.toLowerCase();
    if (agent.id === CEO_ID) {
      if (/договор|файл|документ|скинь|пришли|word/.test(t)) {
        return "Сейчас подготовлю файл и пришлю вложением прямо в этот чат.";
      }
      if (/задач|сделай|нужно|надо|brief|план/.test(t)) {
        return "Ок, беру как задачу компании — сейчас разложу по команде и пришлю результат файлом, если нужно.";
      }
      return "Слушаю. Если это задача для офиса — кинь в канал «Задача → CEO», я делегирую.";
    }
    if (/договор|файл|документ|скинь|пришли|word/.test(t)) {
      return `Могу помочь по зоне «${agent.areaLabel}». Файл для владельца обычно отдаёт Ada (CEO) — сейчас передам ей.`;
    }
    if (/задач|сделай|нужно|надо/.test(t)) {
      return `Принял в личку. По иерархии согласую с Ada (CEO), потом возьму в работу по зоне «${agent.areaLabel}».`;
    }
    if (/статус|как дела|что делаешь/.test(t)) {
      return `Сейчас в зоне «${agent.areaLabel}». Роль: ${agent.title}. Пиши, если нужна помощь.`;
    }
    if (/привет|здрав|hello|hi/.test(t)) {
      return `Привет! Я ${agent.name}, ${agent.title}. Можем в личке или через Ada.`;
    }
    return `Понял. Как ${agent.title}, могу помочь с: ${agent.skills.join(", ")}. Крупные задачи лучше через CEO.`;
  }

  class OfficeHQ {
    constructor(office) {
      this.office = office;
      this.taskSeq = 0;
      this.activeTasks = [];
      this._timers = [];
    }

    static get meta() {
      return AGENTS;
    }

    static get ceoId() {
      return CEO_ID;
    }

    static areaAnchor(area) {
      return AREA_ANCHORS[area] || AREA_ANCHORS.engineering;
    }

    clearTimers() {
      this._timers.forEach(clearTimeout);
      this._timers = [];
    }

    later(ms, fn) {
      const id = setTimeout(fn, ms);
      this._timers.push(id);
      return id;
    }

    /** Company task: always enters through CEO */
    submitCompanyTask(brief) {
      this.office.emitChat({
        channel: "ceo",
        who: "You",
        body: brief,
        kind: "chat",
      });

      if (window.OfficeLLM?.isReady()) {
        this.runCompanyTaskLLM(brief);
        return;
      }

      this.runCompanyTaskSim(brief);
    }

    runCompanyTaskSim(brief) {
      const assignees = pickAssignees(brief);
      const taskId = ++this.taskSeq;
      this.activeTasks.push({ id: taskId, brief, assignees: assignees.map((a) => a.id), done: new Set() });

      this.office.setAgentWork(CEO_ID, {
        task: `Делегирую: ${brief}`,
        thought: "раскладываю по зонам…",
        state: "type",
        bubble: "Принял",
      });

      this.later(600, () => {
        const fileHint = isDocRequest(brief)
          ? " Это запрос на документ — в конце пришлю файл прямо в этот чат."
          : "";
        this.office.emitChat({
          channel: "ceo",
          who: "Ada",
          body: `Приняла задачу #${taskId}. Разбиваю по зонам и спускаю команде.${fileHint}`,
          kind: "chat",
        });
        this.office.emitChat({
          channel: "office",
          who: "Ada",
          body: `Новая задача #${taskId}: «${brief}». Делегирую.`,
          kind: "output",
        });
      });

      this.later(1400, () => {
        const names = assignees.map((a) => a.name).join(", ");
        this.office.emitChat({
          channel: "office",
          who: "Ada",
          body: `Назначаю: ${names}.`,
          kind: "chat",
        });
        this.office.setAgentBubble(CEO_ID, "Делегирую", 2);
      });

      assignees.forEach((agent, i) => {
        const sub = subtaskFor(agent, brief);
        const base = 2000 + i * 700;

        this.later(base, () => {
          this.office.emitChat({
            channel: "office",
            who: "Ada",
            body: `@${agent.name} — ${sub}`,
            kind: "chat",
          });
          // CEO → agent DM (hierarchy)
          this.office.emitChat({
            channel: `dm:${agent.id}`,
            who: "Ada",
            body: `[от CEO] ${sub}`,
            kind: "chat",
          });
          this.office.setAgentWork(agent.id, {
            task: sub,
            thought: "выполняю поручение CEO…",
            state: "type",
            bubble: "Беру",
          });
        });

        this.later(base + 900, () => {
          this.office.emitChat({
            channel: "office",
            who: agent.name,
            body: `@Ada принял. Работаю в зоне «${agent.areaLabel}».`,
            kind: "chat",
          });
          this.office.emitChat({
            channel: `dm:${agent.id}`,
            who: agent.name,
            body: `Ada, ок — беру. Обновлю, когда будет черновик.`,
            kind: "chat",
          });
        });

        this.later(base + 2800 + i * 400, () => {
          const result = this.fakeDeliverable(agent, brief);
          this.office.emitChat({
            channel: "office",
            who: agent.name,
            body: `@Ada готово: ${result}`,
            kind: "output",
          });
          this.office.emitChat({
            channel: `dm:${agent.id}`,
            who: agent.name,
            body: `Ada — сдал: ${result}`,
            kind: "output",
          });
          this.office.setAgentWork(agent.id, {
            task: `Сдал CEO: ${result}`,
            thought: "жду ревью CEO",
            state: "read",
            bubble: "Готово",
          });

          const task = this.activeTasks.find((t) => t.id === taskId);
          if (task) {
            task.done.add(agent.id);
            if (task.done.size >= task.assignees.length) {
              this.later(800, () => this.ceoSummarize(task));
            }
          }
        });
      });
    }

    /** Real LLM path: Ada plans → agents work → Ada summarizes + files */
    async runCompanyTaskLLM(brief) {
      const taskId = ++this.taskSeq;
      this.office.setAgentWork(CEO_ID, {
        task: `Думаю над: ${brief}`,
        thought: "LLM · стратегия…",
        state: "type",
        bubble: "Думаю…",
      });
      this.office.emitChat({
        channel: "ceo",
        who: "Ada",
        body: `Приняла задачу #${taskId}. Думаю как CEO и распределяю по ролям…`,
        kind: "chat",
      });

      try {
        const ceoRes = await OfficeLLM.askAgent(
          "ada",
          `Владелец офиса поставил задачу:\n"""${brief}"""\nСоставь план и назначения.`,
        );
        const plan = ceoRes.json || {
          reply_to_user: ceoRes.text?.slice(0, 500) || "Приняла задачу.",
          office_announce: "",
          assignments: pickAssignees(brief).map((a) => ({ id: a.id, brief: subtaskFor(a, brief) })),
          need_file: isDocRequest(brief),
          file_kind: isDocRequest(brief) ? "sale_contract" : null,
        };

        const assignments = (plan.assignments || [])
          .filter((x) => x && x.id && x.id !== CEO_ID && AGENTS.some((a) => a.id === x.id))
          .slice(0, 3);
        if (!assignments.length) {
          assignments.push(
            ...pickAssignees(brief).map((a) => ({ id: a.id, brief: subtaskFor(a, brief) })),
          );
        }

        this.activeTasks.push({
          id: taskId,
          brief,
          assignees: assignments.map((a) => a.id),
          done: new Set(),
          llm: true,
        });

        this.office.emitChat({
          channel: "ceo",
          who: "Ada",
          body: plan.reply_to_user || "Распределила по команде.",
          kind: "chat",
        });
        if (plan.office_announce) {
          this.office.emitChat({
            channel: "office",
            who: "Ada",
            body: plan.office_announce,
            kind: "output",
          });
        }
        this.office.emitChat({
          channel: "office",
          who: "Ada",
          body: `Назначаю: ${assignments.map((a) => AGENTS.find((x) => x.id === a.id)?.name).join(", ")}.`,
          kind: "chat",
        });

        const results = [];
        for (const job of assignments) {
          const agent = AGENTS.find((a) => a.id === job.id);
          if (!agent) continue;
          this.office.emitChat({
            channel: "office",
            who: "Ada",
            body: `@${agent.name} — ${job.brief}`,
            kind: "chat",
          });
          this.office.emitChat({
            channel: `dm:${agent.id}`,
            who: "Ada",
            body: `[от CEO] ${job.brief}`,
            kind: "chat",
          });
          this.office.setAgentWork(agent.id, {
            task: job.brief,
            thought: "LLM · работаю…",
            state: "type",
            bubble: "Беру",
          });

          try {
            const res = await OfficeLLM.askAgent(
              agent.id,
              `Поручение от CEO Ada:\n"""${job.brief}"""\nКонтекст задачи владельца:\n"""${brief}"""\nСделай свою часть и отчитайся Ada.`,
            );
            const parsed = res.json || {
              reply: res.text?.slice(0, 800) || "Готово.",
              bubble: "Готово",
              done: true,
            };
            const reply = parsed.reply || res.text || "Готово.";
            results.push({ agent, reply, need_file: parsed.need_file, file_kind: parsed.file_kind });

            this.office.emitChat({
              channel: "office",
              who: agent.name,
              body: `@Ada ${reply}`,
              kind: "output",
            });
            this.office.emitChat({
              channel: `dm:${agent.id}`,
              who: agent.name,
              body: reply,
              kind: "output",
            });
            this.office.setAgentWork(agent.id, {
              task: "Сдал CEO",
              thought: "жду ревью",
              state: "read",
              bubble: (parsed.bubble || "Готово").slice(0, 24),
            });
          } catch (err) {
            const msg = `Ошибка LLM: ${err.message}`;
            results.push({ agent, reply: msg });
            this.office.emitChat({
              channel: "office",
              who: agent.name,
              body: `@Ada ${msg}`,
              kind: "output",
            });
          }
        }

        // Final CEO synthesis
        const digest = results
          .map((r) => `- ${r.agent.name}: ${r.reply}`)
          .join("\n");
        let finalText = `Собрала результаты команды:\n${digest}`;
        try {
          const fin = await OfficeLLM.askAgent(
            "ada",
            `Владелец ждал результат по задаче:\n"""${brief}"""\nОтчёты команды:\n${digest}\nСформулируй итоговый ответ владельцу (можно обычным текстом, не JSON). Коротко и полезно.`,
          );
          // prefer plain text for final
          finalText = fin.json?.reply_to_user || fin.text || finalText;
        } catch {
          /* keep digest */
        }

        const needFile =
          plan.need_file ||
          isDocRequest(brief) ||
          results.some((r) => r.need_file);
        let attachments = [];
        if (needFile && window.OfficeDeliverables) {
          const packs = OfficeDeliverables.buildSummaryPack(
            brief,
            results.map((r) => r.agent.name).join(", "),
          );
          attachments = packs.map((p) => ({
            name: p.file.filename,
            url: p.file.url,
            label: p.label,
            note: p.note,
            size: p.file.size,
          }));
        }

        this.office.emitChat({
          channel: "ceo",
          who: "Ada",
          body: finalText + (attachments.length ? "\n\nФайлы ниже ↓" : ""),
          kind: "chat",
          attachments,
        });
        this.office.setAgentWork(CEO_ID, {
          task: `Закрыла #${taskId}`,
          thought: "жду следующий бриф",
          state: "idle",
          bubble: attachments.length ? "Файл ✓" : "Готово ✓",
        });
      } catch (err) {
        this.office.emitChat({
          channel: "ceo",
          who: "Ada",
          body: `Не смогла достучаться до LLM: ${err.message}. Проверь Settings (ключ/модель). Пока откатываюсь на симуляцию.`,
          kind: "chat",
        });
        this.runCompanyTaskSim(brief);
      }
    }

    ceoSummarize(task) {
      const names = task.assignees
        .map((id) => AGENTS.find((a) => a.id === id)?.name)
        .filter(Boolean)
        .join(", ");
      this.office.emitChat({
        channel: "office",
        who: "Ada",
        body: `Задача #${task.id} собрана от ${names}. Готовлю итог и файлы владельцу.`,
        kind: "output",
      });

      const packs =
        window.OfficeDeliverables
          ? OfficeDeliverables.buildSummaryPack(task.brief, names)
          : [];
      const attachments = packs.map((p) => ({
        name: p.file.filename,
        url: p.file.url,
        label: p.label,
        note: p.note,
        size: p.file.size,
      }));

      const docNote = isDocRequest(task.brief)
        ? " Ниже — готовый файл (можно скачать)."
        : attachments.length
          ? " Приложила файлы результата."
          : "";

      this.office.emitChat({
        channel: "ceo",
        who: "Ada",
        body: `Итог по задаче #${task.id}: команда (${names}) закрыла свои части.${docNote} Если нужно — уточни в личке.`,
        kind: "chat",
        attachments,
      });

      // Also drop primary file into office log
      if (attachments[0]) {
        this.office.emitChat({
          channel: "office",
          who: "Ada",
          body: `Владельцу отправлен файл: ${attachments[0].name}`,
          kind: "output",
          attachments: [attachments[0]],
        });
      }

      this.office.setAgentWork(CEO_ID, {
        task: `Закрыла #${task.id} + файлы`,
        thought: "жду следующий бриф",
        state: "idle",
        bubble: "Файл ✓",
      });
    }

    fakeDeliverable(agent, brief) {
      const short = brief.length > 42 ? brief.slice(0, 42) + "…" : brief;
      if (isDocRequest(brief) && agent.id === "turing") {
        return `черновик документа готов, передаю Ada на выгрузку файла («${short}»)`;
      }
      const map = {
        grace: `макет/UI для «${short}»`,
        linus: `черновик API под «${short}»`,
        hopper: `чек-лист тестов на «${short}»`,
        turing: `короткий ресёрч по «${short}»`,
        noether: `визуальные гайды для «${short}»`,
      };
      return map[agent.id] || `результат по «${short}»`;
    }

    /** Private chat with any agent */
    sendDM(agentId, text) {
      const agent = AGENTS.find((a) => a.id === agentId);
      if (!agent) return;
      const channel = `dm:${agentId}`;

      this.office.emitChat({
        channel,
        who: "You",
        body: text,
        kind: "chat",
      });

      this.office.setAgentBubble(agentId, "…", 1.2);
      this.office.setAgentWork(agentId, {
        task: agent.id === CEO_ID ? "Отвечаю владельцу" : `Личка с владельцем`,
        thought: window.OfficeLLM?.isReady() ? "LLM · отвечаю…" : "формулирую ответ…",
        state: "type",
      });

      if (window.OfficeLLM?.isReady()) {
        this.sendDMLLM(agent, channel, text);
        return;
      }

      this.later(700 + Math.random() * 500, () => {
        const wantsFile = isDocRequest(text) || /файл|скинь|пришли|документ|word|договор/.test(text.toLowerCase());
        const reply = dmReply(agent, text);

        // CEO can attach file directly in DM
        if (agent.id === CEO_ID && wantsFile && window.OfficeDeliverables) {
          const packs = OfficeDeliverables.buildSummaryPack(text, "Ada");
          const attachments = packs.map((p) => ({
            name: p.file.filename,
            url: p.file.url,
            label: p.label,
            note: p.note,
            size: p.file.size,
          }));
          this.office.emitChat({
            channel,
            who: "Ada",
            body: `${reply} Вот файлы:`,
            kind: "chat",
            attachments,
          });
          this.office.setAgentBubble(agentId, "Файл ✓", 2);
          return;
        }

        this.office.emitChat({
          channel,
          who: agent.name,
          body: reply,
          kind: "chat",
        });
        this.office.setAgentBubble(agentId, "Ответил", 1.5);

        // Non-CEO + file ask → escalate to company task so CEO ships file
        if (agent.id !== CEO_ID && wantsFile) {
          this.later(900, () => this.submitCompanyTask(text));
          return;
        }

        // If user asked CEO to do work inside DM (non-file), auto-route as company task
        if (agent.id === CEO_ID && /задач|сделай|нужно|надо|brief/.test(text.toLowerCase()) && !wantsFile) {
          this.later(900, () => this.submitCompanyTask(text));
        }
      });
    }

    async sendDMLLM(agent, channel, text) {
      const wantsFile = isDocRequest(text) || /файл|скинь|пришли|документ|word|договор/.test(text.toLowerCase());
      try {
        const prompt =
          agent.id === CEO_ID
            ? `Владелец пишет тебе в личку (ты CEO):\n"""${text}"""\nОтветь полезно. Если нужна делегация команде — скажи, что берёшь в работу. Можно обычным текстом.`
            : `Владелец пишет тебе в личку. Ты ${agent.title}, зона «${agent.areaLabel}», отчитываешься Ada.\nСообщение:\n"""${text}"""\nОтветь по роли. JSON: {"reply":"...","bubble":"..."}`;

        const res = await OfficeLLM.askAgent(agent.id, prompt);
        const reply =
          res.json?.reply_to_user ||
          res.json?.reply ||
          res.text ||
          "Не удалось сформировать ответ.";

        let attachments = [];
        if (agent.id === CEO_ID && wantsFile && window.OfficeDeliverables) {
          const packs = OfficeDeliverables.buildSummaryPack(text, "Ada");
          attachments = packs.map((p) => ({
            name: p.file.filename,
            url: p.file.url,
            label: p.label,
            note: p.note,
            size: p.file.size,
          }));
        }

        this.office.emitChat({
          channel,
          who: agent.name,
          body: reply + (attachments.length ? "\n\nФайлы ниже ↓" : ""),
          kind: "chat",
          attachments,
        });
        this.office.setAgentBubble(agent.id, attachments.length ? "Файл ✓" : (res.json?.bubble || "Ок").slice(0, 24), 2);

        // Escalate company work through CEO hierarchy when appropriate
        if (agent.id === CEO_ID && /сделай|задач|нужно|надо|brief|команд/i.test(text) && !wantsFile) {
          this.later(600, () => this.submitCompanyTask(text));
        } else if (agent.id !== CEO_ID && wantsFile) {
          this.later(600, () => this.submitCompanyTask(text));
        }
      } catch (err) {
        this.office.emitChat({
          channel,
          who: agent.name,
          body: `LLM ошибка: ${err.message}. Проверь Settings.`,
          kind: "chat",
        });
      }
    }

    /** Soft office chatter still goes through hierarchy visually */
    idleChatter(line) {
      const [from, to, text] = line;
      const fromA = AGENTS.find((a) => a.name === from);
      if (!fromA) return;
      // Prefer showing Ada in the middle when not already
      if (from !== "Ada" && to !== "Ada" && to !== "Team") {
        this.office.emitChat({
          channel: "office",
          who: from,
          body: `@Ada FYI → ${to}: ${text}`,
          kind: "chat",
        });
      } else {
        this.office.emitChat({
          channel: "office",
          who: from,
          body: to === "Team" ? text : `@${to} ${text}`,
          kind: "chat",
        });
      }
    }
  }

  window.OfficeHQ = OfficeHQ;
  window.OFFICE_AGENTS_META = AGENTS;
})();
