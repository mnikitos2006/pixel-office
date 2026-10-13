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
      keywords: [
        "research", "анализ", "исслед", "данные", "сравни", "изуч", "договор", "документ",
        "word", "файл", "контракт", "соглашен", "презентац", "рынок", "недвижим", "слайд", "pdf", "обзор",
      ],
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
      keywords: ["дизайн", "design", "иконк", "макет", "бренд", "цвет", "визуал", "pixel", "презентац", "слайд"],
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

  function wantsFile(text) {
    return !!(window.OfficeDeliverables && OfficeDeliverables.wantsFile(text));
  }

  function fileKindFor(text) {
    return (window.OfficeDeliverables && OfficeDeliverables.detectKind(text)) || null;
  }

  function formatOverride(text) {
    return window.OfficeDeliverables?.detectFormatOverride?.(text) || null;
  }

  function isFollowUpFileAsk(text) {
    const t = String(text).toLowerCase();
    return /где\s+(она|он|сам|файл|презентац|таблиц)|скинь|пришли|ссылк|скача|в\s+pdf|электронн|файл(е|ом)?|а\s+где|формате|html|\.xls|exce?l/.test(
      t,
    );
  }

  /** True if message looks like a new brief, not only "send the file again" */
  function detectFreshBrief(text) {
    const t = String(text).toLowerCase();
    if (t.length > 100) return true;
    return /сделай|подготов|создай|нужн[ао]|сделать|презентац.*рынк|рынк.*недвижим|новый|другую|заново|метрик.*производ|производ.*метрик/.test(
      t,
    );
  }

  function hintForKind(kind) {
    return window.OfficeDeliverables?.attachmentHint?.(kind) || "Скачай вложение ниже.";
  }

  function pickAssignees(text) {
    const t = text.toLowerCase();
    const kind = window.OfficeDeliverables?.detectKind(text);
    if (kind === "presentation" || kind === "report") {
      return [
        AGENTS.find((a) => a.id === "turing"),
        AGENTS.find((a) => a.id === "noether"),
      ].filter(Boolean);
    }
    if (kind === "csv" || kind === "excel") {
      return [AGENTS.find((a) => a.id === "turing")].filter(Boolean);
    }
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
    return [AGENTS.find((a) => a.id === "grace"), AGENTS.find((a) => a.id === "linus")];
  }

  function subtaskFor(agent, brief) {
    const kind = window.OfficeDeliverables?.detectKind(brief);
    if (kind === "presentation" && agent.id === "turing") {
      return `Собери содержание презентации (5–8 слайдов: title + bullets) по запросу: «${brief}»`;
    }
    if (kind === "presentation" && agent.id === "noether") {
      return `Предложи структуру/заголовки слайдов и визуальную иерархию для: «${brief}»`;
    }
    if ((kind === "csv" || kind === "excel") && agent.id === "turing") {
      return `Собери таблицу метрик по запросу «${brief}»: JSON поле rows = массив строк (первая строка — заголовки колонок).`;
    }
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

  function collectSlides(results) {
    const all = [];
    for (const r of results || []) {
      const slides = r.slides || r.parsed?.slides;
      if (Array.isArray(slides)) all.push(...slides);
    }
    return all;
  }

  function collectRows(results) {
    for (const r of results || []) {
      const rows = r.rows || r.parsed?.rows;
      if (Array.isArray(rows) && rows.length >= 2) return rows;
    }
    return null;
  }

  function stripFakeLinks(text) {
    return String(text || "")
      .replace(/https?:\/\/\S+/gi, "[файл во вложении ниже — без внешних ссылок]")
      .replace(/\b[\w.-]+\.(ru|com|io|org)\/\S*/gi, "[см. вложение]");
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
      this.lastBrief = "";
      this.lastSlides = null;
      this.lastRows = null;
      this.lastFileKind = null;
    }

    attachFiles(channel, who, body, brief, content = {}) {
      const kind =
        content.file_kind ||
        this.lastFileKind ||
        fileKindFor(brief) ||
        "presentation";
      const packs = window.OfficeDeliverables
        ? OfficeDeliverables.buildSummaryPack(
            brief,
            content.assigneeNames || "команда",
            {
              slides: content.slides || this.lastSlides,
              rows: content.rows || this.lastRows,
              file_kind: kind,
              sections: content.sections,
            },
          )
        : [];
      const attachments = packs.map((p) => ({
        name: p.file.filename,
        url: p.file.url,
        label: p.label,
        note: p.note,
        size: p.file.size,
      }));
      if (packs[0]?.slides) this.lastSlides = packs[0].slides;
      if (packs[0]?.rows) this.lastRows = packs[0].rows;
      if (packs[0]?.kind) this.lastFileKind = packs[0].kind;
      const hint = hintForKind(packs[0]?.kind || kind);
      this.office.emitChat({
        channel,
        who,
        body: stripFakeLinks(body) + (attachments.length ? `\n\nФайлы ниже ↓\n${hint}` : ""),
        kind: "chat",
        attachments,
      });
      return attachments;
    }

    /** Re-send / convert last deliverable when user asks for the file again */
    resendLastDeliverable(channel, note, overrideKind = null) {
      if (!this.lastBrief || !window.OfficeDeliverables) return false;
      const kind = overrideKind || this.lastFileKind || fileKindFor(this.lastBrief) || "csv";
      this.lastFileKind = kind;
      this.attachFiles(
        channel,
        "Ada",
        note || `Повторно прикладываю файл (${kind}). ${hintForKind(kind)}`,
        this.lastBrief,
        {
          slides: this.lastSlides,
          rows: this.lastRows,
          file_kind: kind,
          assigneeNames: "Ada",
        },
      );
      this.office.setAgentBubble(CEO_ID, "Файл ✓", 2);
      return true;
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

      // Follow-up like "where is the file?" / "send as excel" → rebuild last deliverable
      if (isFollowUpFileAsk(brief) && this.lastBrief && !detectFreshBrief(brief)) {
        const ov = formatOverride(brief);
        this.office.setAgentWork(CEO_ID, {
          task: "Отдаю файл владельцу",
          thought: ov ? `формат → ${ov}` : "повторная выдача…",
          state: "type",
          bubble: "Файл…",
        });
        this.later(400, () => {
          const kind = ov || this.lastFileKind || fileKindFor(this.lastBrief) || "csv";
          this.resendLastDeliverable(
            "ceo",
            ov
              ? `Пересобрала в формате ${kind}. ${hintForKind(kind)}`
              : `Вот файл по задаче «${this.lastBrief.slice(0, 80)}». ${hintForKind(kind)}`,
            kind,
          );
        });
        return;
      }

      this.lastBrief = brief;
      this.lastFileKind = fileKindFor(brief);

      if (window.OfficeLLM?.isReady()) {
        this.runCompanyTaskLLM(brief);
        return;
      }

      this.runCompanyTaskSim(brief);
    }

    runCompanyTaskSim(brief) {
      const assignees = pickAssignees(brief);
      const taskId = ++this.taskSeq;
      this.lastBrief = brief;
      this.lastFileKind = fileKindFor(brief);
      this.activeTasks.push({ id: taskId, brief, assignees: assignees.map((a) => a.id), done: new Set() });

      this.office.setAgentWork(CEO_ID, {
        task: `Делегирую: ${brief}`,
        thought: "раскладываю по зонам…",
        state: "type",
        bubble: "Принял",
      });

      this.later(600, () => {
        const fileHint = wantsFile(brief)
          ? " В конце пришлю готовый файл во вложении (без внешних ссылок)."
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
      this.lastBrief = brief;
      this.lastFileKind = fileKindFor(brief);
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
        const forceFile = wantsFile(brief);
        const forcedKind = fileKindFor(brief);
        const ceoRes = await OfficeLLM.askAgent(
          "ada",
          `Владелец офиса поставил задачу:\n"""${brief}"""\nСоставь план и назначения.${
            forceFile
              ? `\nЭто запрос на ФАЙЛ (тип: ${forcedKind}). need_file=true, file_kind="${forcedKind}". Назначь Turing. Не выдумывай URL.`
              : ""
          }`,
        );
        const plan = ceoRes.json || {
          reply_to_user: ceoRes.text?.slice(0, 500) || "Приняла задачу. Файл будет во вложении.",
          office_announce: "",
          assignments: pickAssignees(brief).map((a) => ({ id: a.id, brief: subtaskFor(a, brief) })),
          need_file: forceFile,
          file_kind: forcedKind,
        };
        plan.need_file = forceFile || !!plan.need_file;
        plan.file_kind = plan.file_kind || forcedKind;
        plan.reply_to_user = stripFakeLinks(plan.reply_to_user || "");

        let assignments = (plan.assignments || [])
          .filter((x) => x && x.id && x.id !== CEO_ID && AGENTS.some((a) => a.id === x.id))
          .slice(0, 3);
        if (!assignments.length || (forceFile && !assignments.some((a) => a.id === "turing"))) {
          const fallback = pickAssignees(brief).map((a) => ({ id: a.id, brief: subtaskFor(a, brief) }));
          const merged = [...assignments];
          for (const f of fallback) {
            if (!merged.some((m) => m.id === f.id)) merged.push(f);
          }
          assignments = merged.slice(0, 3);
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
          body: plan.reply_to_user || "Распределила по команде. Файл приложу в конце.",
          kind: "chat",
        });
        if (plan.office_announce) {
          this.office.emitChat({
            channel: "office",
            who: "Ada",
            body: stripFakeLinks(plan.office_announce),
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
            const kindNow = fileKindFor(brief);
            let extraHint = "";
            if (agent.id === "turing" || agent.id === "noether") {
              if (kindNow === "csv" || kindNow === "excel") {
                extraHint =
                  `\nВерни JSON: {"reply":"...","bubble":"...","done":true,"need_file":true,"file_kind":"${kindNow}",` +
                  `"rows":[["Колонка1","Колонка2"],["значение","значение"], ...]} — минимум 10 строк данных. Без URL.`;
              } else {
                extraHint =
                  `\nВерни JSON со slides: [{"title":"...","bullets":["..."]}]. Минимум 5 слайдов. Без URL.`;
              }
            }
            const res = await OfficeLLM.askAgent(
              agent.id,
              `Поручение от CEO Ada:\n"""${job.brief}"""\nКонтекст задачи владельца:\n"""${brief}"""\nСделай свою часть и отчитайся Ada.${extraHint}`,
            );
            const parsed = res.json || {
              reply: res.text?.slice(0, 800) || "Готово.",
              bubble: "Готово",
              done: true,
            };
            const reply = stripFakeLinks(parsed.reply || res.text || "Готово.");
            results.push({
              agent,
              reply,
              need_file: parsed.need_file,
              file_kind: parsed.file_kind,
              slides: parsed.slides,
              rows: parsed.rows,
              parsed,
            });

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

        const digest = results.map((r) => `- ${r.agent.name}: ${r.reply}`).join("\n");
        const outKind = plan.file_kind || forcedKind || fileKindFor(brief) || "presentation";
        let finalText = `Готово. Файл (${outKind}) во вложении ниже. ${hintForKind(outKind)}`;
        try {
          const fin = await OfficeLLM.askAgent(
            "ada",
            `Владелец ждал результат по задаче:\n"""${brief}"""\nОтчёты команды:\n${digest}\n` +
              `Тип файла: ${outKind}. Итоговый ответ ОБЫЧНЫМ текстом (не JSON). ` +
              `Запрещено: URL, личные кабинеты, упоминать неверный формат (не говори про .html если тип ${outKind}). ` +
              `Скажи что нужный файл во вложении. Коротко.`,
          );
          finalText = stripFakeLinks(fin.json?.reply_to_user || fin.text || finalText);
        } catch {
          /* keep default */
        }

        const slides = collectSlides(results);
        const rows = collectRows(results);
        this.lastSlides = slides.length ? slides : null;
        this.lastRows = rows;
        this.lastFileKind = outKind;

        const needFile =
          forceFile ||
          !!plan.need_file ||
          results.some((r) => r.need_file) ||
          wantsFile(brief);
        if (needFile && window.OfficeDeliverables) {
          this.attachFiles("ceo", "Ada", finalText, brief, {
            slides: this.lastSlides,
            rows: this.lastRows,
            file_kind: this.lastFileKind,
            assigneeNames: results.map((r) => r.agent.name).join(", "),
          });
        } else {
          this.office.emitChat({
            channel: "ceo",
            who: "Ada",
            body: finalText,
            kind: "chat",
          });
        }
        this.office.setAgentWork(CEO_ID, {
          task: `Закрыла #${taskId}`,
          thought: "жду следующий бриф",
          state: "idle",
          bubble: "Файл ✓",
        });
      } catch (err) {
        this.office.emitChat({
          channel: "ceo",
          who: "Ada",
          body: `Не смогла достучаться до LLM: ${err.message}. Проверь Settings. Пока откатываюсь на симуляцию.`,
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

      this.lastBrief = task.brief;
      this.lastFileKind = fileKindFor(task.brief);
      const attachments = this.attachFiles(
        "ceo",
        "Ada",
        `Итог по задаче #${task.id}: команда (${names}) закрыла свои части. Скачай файл во вложении (без внешних ссылок).`,
        task.brief,
        { assigneeNames: names, file_kind: this.lastFileKind, slides: this.lastSlides },
      );

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
        const askFile = wantsFile(text);
        const reply = dmReply(agent, text);

        if (agent.id === CEO_ID && isFollowUpFileAsk(text) && this.lastBrief && !detectFreshBrief(text)) {
          this.resendLastDeliverable(channel, null, formatOverride(text) || this.lastFileKind);
          return;
        }

        if (agent.id === CEO_ID && askFile && window.OfficeDeliverables) {
          const brief = detectFreshBrief(text) || !this.lastBrief ? text : this.lastBrief;
          this.lastBrief = brief;
          const kind = formatOverride(text) || fileKindFor(brief) || this.lastFileKind || "csv";
          this.attachFiles(channel, "Ada", `${reply} Вот файлы:`, brief, {
            assigneeNames: "Ada",
            file_kind: kind,
            slides: this.lastSlides,
            rows: this.lastRows,
          });
          this.office.setAgentBubble(agentId, "Файл ✓", 2);
          return;
        }

        this.office.emitChat({
          channel,
          who: agent.name,
          body: stripFakeLinks(reply),
          kind: "chat",
        });
        this.office.setAgentBubble(agentId, "Ответил", 1.5);

        if (agent.id !== CEO_ID && askFile) {
          this.later(900, () => this.submitCompanyTask(text));
          return;
        }

        if (agent.id === CEO_ID && /задач|сделай|нужно|надо|brief|презентац/.test(text.toLowerCase()) && !askFile) {
          this.later(900, () => this.submitCompanyTask(text));
        }
      });
    }

    async sendDMLLM(agent, channel, text) {
      const askFile = wantsFile(text);
      try {
        if (agent.id === CEO_ID && isFollowUpFileAsk(text) && this.lastBrief && !detectFreshBrief(text)) {
          this.resendLastDeliverable(channel, null, formatOverride(text) || this.lastFileKind);
          return;
        }

        // New substantive CEO task in DM → full company pipeline (with real file)
        if (
          agent.id === CEO_ID &&
          (detectFreshBrief(text) || /сделай|подготов|создай|презентац|рынк|договор|метрик|таблиц/i.test(text))
        ) {
          this.office.emitChat({
            channel,
            who: "Ada",
            body: "Беру как задачу компании — делегирую команде и пришлю файл во вложении (без внешних ссылок).",
            kind: "chat",
          });
          this.later(400, () => this.submitCompanyTask(text));
          return;
        }

        const prompt =
          agent.id === CEO_ID
            ? `Владелец пишет тебе в личку (ты CEO):\n"""${text}"""\nОтветь полезно обычным текстом. Запрещены любые URL и «личные кабинеты». Если нужен файл — скажи что он будет во вложении.`
            : `Владелец пишет тебе в личку. Ты ${agent.title}, зона «${agent.areaLabel}», отчитываешься Ada.\nСообщение:\n"""${text}"""\nОтветь по роли. Без URL. JSON: {"reply":"...","bubble":"..."}`;

        const res = await OfficeLLM.askAgent(agent.id, prompt);
        const reply = stripFakeLinks(
          res.json?.reply_to_user || res.json?.reply || res.text || "Не удалось сформировать ответ.",
        );

        if (agent.id === CEO_ID && askFile && window.OfficeDeliverables) {
          const brief = this.lastBrief && isFollowUpFileAsk(text) ? this.lastBrief : text;
          this.lastBrief = brief;
          const kind = formatOverride(text) || fileKindFor(brief) || this.lastFileKind || "csv";
          this.attachFiles(channel, "Ada", reply, brief, {
            assigneeNames: "Ada",
            file_kind: kind,
            slides: this.lastSlides,
            rows: this.lastRows,
          });
          this.office.setAgentBubble(agent.id, "Файл ✓", 2);
        } else {
          this.office.emitChat({
            channel,
            who: agent.name,
            body: reply,
            kind: "chat",
          });
          this.office.setAgentBubble(agent.id, (res.json?.bubble || "Ок").slice(0, 24), 2);
        }

        if (agent.id !== CEO_ID && askFile) {
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
