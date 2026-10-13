/**
 * Real file deliverables for the office chat.
 * Builds downloadable blobs: presentation (HTML), Word (.doc), TXT, CSV, MD.
 */
(() => {
  function downloadUrl(blob, filename) {
    const url = URL.createObjectURL(blob);
    setTimeout(() => URL.revokeObjectURL(url), 30 * 60 * 1000);
    return { url, filename, size: blob.size, mime: blob.type };
  }

  function wordDoc(htmlBody, title) {
    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<!--[if gte mso 9]><xml>
 <w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
 </w:WordDocument>
</xml><![endif]-->
<style>
  body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.35; }
  h1 { text-align: center; font-size: 14pt; }
  h2 { font-size: 12pt; margin-top: 16pt; }
  p { margin: 0 0 8pt; text-align: justify; }
  .center { text-align: center; }
  .meta { margin-bottom: 18pt; }
  .sign { margin-top: 28pt; }
  table.sign td { vertical-align: top; width: 50%; padding-top: 12pt; }
</style>
</head>
<body>${htmlBody}</body>
</html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
    return downloadUrl(blob, sanitizeFilename(title) + ".doc");
  }

  function textFile(content, filename, mime = "text/plain;charset=utf-8") {
    const blob = new Blob([content], { type: mime });
    return downloadUrl(blob, filename);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function sanitizeFilename(name) {
    return String(name)
      .replace(/[^\wа-яА-ЯёЁ0-9\- ]+/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 60) || "document";
  }

  function detectFormatOverride(text) {
    const t = String(text).toLowerCase();
    // include common typo "exel"
    if (/excel|exel|xlsx|\.xls|эксел|эксель/.test(t)) return "excel";
    if (/\bcsv\b/.test(t)) return "csv";
    if (/презентац|presentation|\.pptx?|слайд|\.html|\bhtml\b/.test(t)) return "presentation";
    if (/\bpdf\b/.test(t)) return "presentation";
    if (/word|\.docx?/.test(t)) return "sale_contract";
    return null;
  }

  function detectKind(brief) {
    const t = String(brief).toLowerCase();
    const override = detectFormatOverride(brief);
    // Explicit table / metrics first (even if someone also says "файл")
    if (/метрик|kpi|показател|таблиц/.test(t) || override === "excel" || override === "csv") {
      if (override === "excel" || /excel|exel|xlsx|\.xls|эксел/.test(t)) return "excel";
      return "csv";
    }
    if (override === "presentation" || /презентац|presentation|\.pptx?|слайд|питч|pitch\s?deck/.test(t)) {
      return "presentation";
    }
    if (/рынк|недвижим|аналит|исследован|обзор\s+рынк|market\s+research/.test(t)) {
      return "presentation";
    }
    if (/договор|купл.?продаж|купл[ия].*продаж|продаж.*купл|deed of sale|purchase.?sale|соглашен(ие|ия) купли/.test(t)) {
      return "sale_contract";
    }
    if (/договор|контракт|соглашен/.test(t) && /word|\.docx?|файл|документ|скинь|пришли/.test(t)) {
      return "sale_contract";
    }
    if (/word|\.docx?/.test(t) && /договор|документ|файл/.test(t)) return "sale_contract";
    if (/отч[её]т|report|\.md|markdown/.test(t)) return "report";
    return null;
  }

  function wantsFile(brief) {
    const t = String(brief).toLowerCase();
    if (detectKind(brief)) return true;
    return /файл|скинь|пришли|документ|ссылк|где\s+(она|он|файл|презентац|таблиц)|скача|pdf|pptx?|электронн|html/.test(t);
  }

  function attachmentHint(kind) {
    if (kind === "presentation") return "Скачай .html и открой в браузере (Печать → PDF при необходимости).";
    if (kind === "excel") return "Скачай .xls и открой в Excel / Google Sheets / Numbers.";
    if (kind === "csv") return "Скачай .csv (UTF-8) — открывается в Excel.";
    if (kind === "sale_contract") return "Скачай .doc — открывается в Word / Google Docs.";
    if (kind === "report") return "Скачай .md отчёт.";
    return "Скачай вложение ниже.";
  }

  function defaultMetricsRows(brief) {
    const t = String(brief).toLowerCase();
    const isProd = /производ|завод|цех|manufactur|factory|выпуск/.test(t);
    const title = isProd
      ? "Ключевые метрики производственного бизнеса (ориентиры)"
      : "Ключевые метрики бизнеса (ориентиры)";
    const rows = [
      ["Блок", "Метрика", "Ед.", "Ориентир / норма", "Как считать", "Зачем"],
      ["Выручка", "Выручка (Revenue)", "₽", "план месяца", "Сумма отгрузок / актов", "Рост бизнеса"],
      ["Выручка", "Валовая маржа", "%", "25–45% (зависит от отрасли)", "(Выручка − себестоимость) / Выручка", "Экономика продукта"],
      ["Выручка", "EBITDA margin", "%", "10–20%", "EBITDA / Выручка", "Операционная прибыль"],
      ["Производство", "Выпуск (Output)", "шт / т", "план смены", "Кол-во годной продукции", "Мощность"],
      ["Производство", "OEE", "%", "≥ 65–85%", "Availability × Performance × Quality", "Эффективность оборудования"],
      ["Производство", "Доля брака", "%", "< 1–3%", "Брак / выпуск", "Качество"],
      ["Производство", "Cycle time", "мин", "по техкарте", "Время на единицу", "Скорость потока"],
      ["Запасы", "Оборачиваемость запасов", "раз/год", "≥ 6–12", "Себестоимость / ср. запас", "Замороженные деньги"],
      ["Запасы", "Дни запаса (DOI)", "дни", "снижать без стоп-страница", "Запас / дневной расход", "Ликвидность"],
      ["Клиенты", "OTIF (вовремя и полностью)", "%", "≥ 95%", "Заказы вовремя и в полном объёме / все заказы", "Сервис"],
      ["Клиенты", "Lead time заказа", "дни", "сокращать", "От заказа до отгрузки", "Скорость ответа рынку"],
      ["Люди", "Выработка на сотрудника", "₽/чел", "рост YoY", "Выручка / FTE", "Производительность"],
      ["Люди", "Текучесть", "%", "< 10–15%/год", "Ушедшие / среднесписочная", "Стабильность команды"],
      ["Деньги", "Cash Conversion Cycle", "дни", "чем меньше, тем лучше", "DIO + DSO − DPO", "Кассовые разрывы"],
      ["Деньги", "Дебиторка (DSO)", "дни", "снижать", "ср. дебиторка / дневная выручка", "Сбор денег"],
      ["Безопасность", "LTIFR / травматизм", "коэфф.", "→ 0", "Травмы × коэффициент / часы", "Охрана труда"],
      ["Мета", "Источник запроса", "—", brief.slice(0, 120), "Бриф владельца", "Контекст"],
      ["Мета", "Сформировано", "—", new Date().toLocaleString("ru-RU"), "Pixel Office", title],
    ];
    return rows;
  }

  function normalizeRows(rows, brief) {
    if (!Array.isArray(rows) || rows.length < 2) return defaultMetricsRows(brief);
    return rows.slice(0, 80).map((r) => {
      if (Array.isArray(r)) return r.map((c) => String(c ?? ""));
      if (r && typeof r === "object") {
        return Object.values(r).map((c) => String(c ?? ""));
      }
      return [String(r)];
    });
  }

  function rowsToCsv(rows) {
    return rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
  }

  function buildExcel(brief, rowsInput) {
    const rows = normalizeRows(rowsInput, brief);
    const sheetRows = rows
      .map((r, i) => {
        const cells = r
          .map((c) => `<Cell><Data ss:Type="String">${escapeHtml(c)}</Data></Cell>`)
          .join("");
        return i === 0 ? `<Row ss:StyleID="hdr">${cells}</Row>` : `<Row>${cells}</Row>`;
      })
      .join("\n");
    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="hdr"><Font ss:Bold="1"/><Interior ss:Color="#D9E2F3" ss:Pattern="Solid"/></Style>
 </Styles>
 <Worksheet ss:Name="Metrics">
  <Table>
${sheetRows}
  </Table>
 </Worksheet>
</Workbook>`;
    const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
    return {
      kind: "excel",
      label: "Таблица Excel (.xls)",
      file: downloadUrl(blob, sanitizeFilename("metrics_table") + ".xls"),
      note: "Таблица метрик для Excel / Google Sheets / Numbers.",
      rows,
    };
  }

  function defaultPresentationSlides(brief) {
    const topic = String(brief).replace(/\s+/g, " ").trim().slice(0, 120) || "Тема проекта";
    return [
      {
        title: "Pixel Office — презентация",
        bullets: [
          topic,
          "Подготовлено командой офиса (CEO Ada)",
          new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }),
        ],
      },
      {
        title: "Контекст и цель",
        bullets: [
          "Запрос владельца: " + topic,
          "Собрать понятный обзор для принятия решений",
          "Структура: рынок → драйверы → риски → выводы",
        ],
      },
      {
        title: "Рынок и сегменты",
        bullets: [
          "Жилая / коммерческая / земельные участки — уточнять под задачу",
          "Спрос зависит от ставки, доходов и локации",
          "Предложение: новостройки vs вторичка, вакантность",
          "Цены и арендные ставки — сверять с актуальными источниками региона",
        ],
      },
      {
        title: "Драйверы и тренды",
        bullets: [
          "Ипотека и стоимость денег",
          "Миграция / демография / деловая активность",
          "Инфраструктура и транспортная доступность",
          "Онлайн-каналы продаж и прозрачность сделок",
        ],
      },
      {
        title: "Риски",
        bullets: [
          "Переоценка объектов без локальной проверки",
          "Юридические обременения и непрозрачный title",
          "Волатильность ставок и платежеспособности",
          "Недостаток свежих данных по микролокации",
        ],
      },
      {
        title: "Выводы и next steps",
        bullets: [
          "Зафиксировать целевой сегмент и географию",
          "Собрать 5–10 comps (сопоставимые объекты)",
          "Проверить юрчистоту и unit-экономику",
          "Обновить слайды фактами из открытых источников региона",
        ],
      },
    ];
  }

  function normalizeSlides(slides, brief) {
    if (!Array.isArray(slides) || !slides.length) return defaultPresentationSlides(brief);
    return slides.slice(0, 12).map((s, i) => {
      const title = String(s.title || s.heading || `Слайд ${i + 1}`).slice(0, 120);
      let bullets = s.bullets || s.points || s.items || [];
      if (typeof bullets === "string") bullets = bullets.split(/\n|•|;/).map((x) => x.trim()).filter(Boolean);
      if (!Array.isArray(bullets) || !bullets.length) {
        const body = String(s.body || s.text || s.content || "").trim();
        bullets = body ? body.split(/\n+/).map((x) => x.replace(/^[-•*]\s*/, "").trim()).filter(Boolean) : ["—"];
      }
      return {
        title,
        bullets: bullets.map((b) => String(b).slice(0, 280)).slice(0, 8),
      };
    });
  }

  function buildPresentation(brief, slidesInput) {
    const slides = normalizeSlides(slidesInput, brief);
    const title = slides[0]?.title || "Презентация Pixel Office";
    const slidesHtml = slides
      .map(
        (s, i) => `
<section class="slide" id="s${i}">
  <div class="num">${i + 1} / ${slides.length}</div>
  <h1>${escapeHtml(s.title)}</h1>
  <ul>
    ${s.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("\n    ")}
  </ul>
</section>`,
      )
      .join("\n");

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root { --bg:#0f1419; --card:#1a2332; --text:#e8eef7; --muted:#8b9bb4; --accent:#5b8cff; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: "Segoe UI", system-ui, sans-serif; background:var(--bg); color:var(--text); }
  header { position:sticky; top:0; z-index:2; display:flex; gap:12px; align-items:center; justify-content:space-between;
    padding:12px 18px; background:#0b1018ee; border-bottom:1px solid #243044; backdrop-filter: blur(8px); }
  header strong { font-size:14px; }
  header span { color:var(--muted); font-size:12px; }
  button { background:var(--accent); color:#fff; border:0; border-radius:8px; padding:8px 12px; cursor:pointer; font-weight:600; }
  button.ghost { background:transparent; border:1px solid #334155; color:var(--text); }
  .wrap { max-width:960px; margin:0 auto; padding:24px 16px 64px; display:flex; flex-direction:column; gap:18px; }
  .slide { background:linear-gradient(160deg, #1a2332, #121a26); border:1px solid #2a3a55; border-radius:16px;
    padding:36px 40px; min-height:420px; box-shadow:0 12px 40px #0006; }
  .slide .num { color:var(--muted); font-size:12px; margin-bottom:18px; letter-spacing:.04em; }
  .slide h1 { margin:0 0 22px; font-size:32px; line-height:1.2; }
  .slide ul { margin:0; padding-left:22px; font-size:18px; line-height:1.55; }
  .slide li { margin:0 0 10px; }
  .brief { color:var(--muted); font-size:12px; padding:0 4px; }
  @media print {
    header { display:none; }
    .slide { break-after: page; box-shadow:none; border:1px solid #ccc; background:#fff; color:#111; min-height:auto; }
    body { background:#fff; color:#111; }
  }
</style>
</head>
<body>
<header>
  <div>
    <strong>${escapeHtml(title)}</strong><br>
    <span>Pixel Office · открой файл и при необходимости File → Print → PDF</span>
  </div>
  <div style="display:flex;gap:8px">
    <button class="ghost" onclick="window.print()">Печать / PDF</button>
  </div>
</header>
<div class="wrap">
  <p class="brief">Бриф: ${escapeHtml(String(brief).slice(0, 400))}</p>
  ${slidesHtml}
</div>
</body>
</html>`;

    const filename = sanitizeFilename(title) + ".html";
    return {
      kind: "presentation",
      label: "Презентация (.html → PDF)",
      file: textFile(html, filename, "text/html;charset=utf-8"),
      note: "Готовая презентация со слайдами. Открой в браузере; для PDF — «Печать / PDF».",
      slides,
    };
  }

  function buildReport(brief, sectionsInput) {
    const sections = Array.isArray(sectionsInput) && sectionsInput.length
      ? sectionsInput
      : [
          { heading: "Запрос", body: brief },
          { heading: "Краткий вывод", body: "Черновик отчёта подготовлен командой Pixel Office. Уточните регион и сегмент для углубления." },
          { heading: "Рекомендации", body: "1) Зафиксировать ЦА\n2) Собрать comps\n3) Проверить юридические риски" },
        ];
    const md = [
      `# Отчёт Pixel Office`,
      ``,
      `_Сгенерировано: ${new Date().toLocaleString("ru-RU")}_`,
      ``,
      ...sections.flatMap((s) => [`## ${s.heading || s.title || "Раздел"}`, ``, String(s.body || s.text || ""), ``]),
    ].join("\n");
    return {
      kind: "report",
      label: "Отчёт (.md)",
      file: textFile(md, sanitizeFilename("pixel_office_report") + ".md", "text/markdown;charset=utf-8"),
      note: "Текстовый отчёт по задаче.",
    };
  }

  function buildSaleContract(brief) {
    const today = new Date();
    const dateStr = today.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const city = "г. Москва";
    const title = "Договор купли-продажи";
    const body = `
<h1>ДОГОВОР КУПЛИ-ПРОДАЖИ</h1>
<p class="center meta">№ 01/${today.getFullYear()}<br>${city}, ${dateStr}</p>

<p><b>Продавец:</b> ______________________________ (ФИО / наименование), именуемый(ая) в дальнейшем «Продавец», с одной стороны, и</p>
<p><b>Покупатель:</b> ______________________________ (ФИО / наименование), именуемый(ая) в дальнейшем «Покупатель», с другой стороны, совместно именуемые «Стороны», заключили настоящий Договор о нижеследующем:</p>

<h2>1. Предмет договора</h2>
<p>1.1. Продавец обязуется передать в собственность Покупателя, а Покупатель обязуется принять и оплатить следующее имущество (товар): <b>________________________________</b> (наименование, характеристики, количество).</p>
<p>1.2. Товар принадлежит Продавцу на праве собственности, не заложен, не арестован, не является предметом спора.</p>

<h2>2. Цена и порядок расчётов</h2>
<p>2.1. Цена товара составляет: <b>_______________ (_______________) рублей</b>, НДС не облагается / включая НДС ___ %.</p>
<p>2.2. Оплата производится в следующем порядке: ☐ 100% предоплата ☐ в момент передачи ☐ рассрочка: _______________________.</p>
<p>2.3. Обязательство Покупателя по оплате считается исполненным с момента поступления денежных средств на счёт / в кассу Продавца.</p>

<h2>3. Передача товара</h2>
<p>3.1. Передача товара осуществляется по адресу: ________________________________ в срок до «___» _____________ 20__ г.</p>
<p>3.2. Передача оформляется актом приёма-передачи, подписываемым Сторонами.</p>
<p>3.3. Право собственности и риск случайной гибели переходят к Покупателю с момента подписания акта приёма-передачи.</p>

<h2>4. Права и обязанности сторон</h2>
<p>4.1. Продавец обязан передать товар свободным от прав третьих лиц, в состоянии, соответствующем договору.</p>
<p>4.2. Покупатель обязан принять товар и оплатить его в согласованный срок.</p>

<h2>5. Ответственность</h2>
<p>5.1. За просрочку оплаты Покупатель уплачивает неустойку в размере 0,1% от суммы задолженности за каждый день просрочки.</p>
<p>5.2. За просрочку передачи товара Продавец уплачивает неустойку в размере 0,1% от цены товара за каждый день просрочки.</p>

<h2>6. Заключительные положения</h2>
<p>6.1. Договор вступает в силу с даты подписания и действует до полного исполнения обязательств.</p>
<p>6.2. Споры разрешаются путём переговоров, а при недостижении согласия — в суде по месту нахождения ответчика.</p>
<p>6.3. Договор составлен в двух экземплярах, имеющих одинаковую юридическую силу, по одному для каждой Стороны.</p>
<p>6.4. Запрос владельца офиса (бриф): <i>${escapeHtml(brief)}</i></p>

<h2>7. Реквизиты и подписи сторон</h2>
<table class="sign" width="100%">
  <tr>
    <td>
      <b>Продавец</b><br><br>
      ________________ / ______________ /<br>
      М.П.
    </td>
    <td>
      <b>Покупатель</b><br><br>
      ________________ / ______________ /<br>
      М.П.
    </td>
  </tr>
</table>
<p style="margin-top:18pt;font-size:10pt;color:#444">Документ сформирован Pixel Office (демо-шаблон). Перед использованием проверьте реквизиты и применимость к вашей ситуации.</p>
`;
    return {
      kind: "sale_contract",
      label: "Договор купли-продажи (.doc)",
      file: wordDoc(body, title),
      note: "Типовой шаблон договора купли-продажи в формате Word (.doc). Открывается в Word / Google Docs / Pages.",
    };
  }

  function buildCsv(brief, rowsInput) {
    const rows = normalizeRows(rowsInput, brief);
    const csv = rowsToCsv(rows);
    return {
      kind: "csv",
      label: "Таблица (.csv)",
      file: textFile("\ufeff" + csv, sanitizeFilename("metrics_table") + ".csv", "text/csv;charset=utf-8"),
      note: "CSV с метриками — открывается в Excel.",
      rows,
    };
  }

  function buildForBrief(brief, content = {}) {
    const kind = content.file_kind || detectKind(brief) || "presentation";
    if (kind === "sale_contract") return buildSaleContract(brief);
    if (kind === "excel") return buildExcel(brief, content.rows);
    if (kind === "csv") return buildCsv(brief, content.rows);
    if (kind === "report" || kind === "md" || kind === "brief_pack") {
      return buildReport(brief, content.sections);
    }
    return buildPresentation(brief, content.slides);
  }

  /**
   * Pack attachments for CEO summary.
   * content: { slides?, sections?, rows?, file_kind? }
   */
  function buildSummaryPack(brief, assigneeNames, content = {}) {
    const primary = buildForBrief(brief, content);
    const files = [primary];

    if (primary.kind === "presentation") {
      const notes = buildReport(brief, [
        { heading: "Запрос", body: brief },
        {
          heading: "Слайды (текст)",
          body: (primary.slides || [])
            .map((s, i) => `${i + 1}. ${s.title}\n` + s.bullets.map((b) => `   - ${b}`).join("\n"))
            .join("\n\n"),
        },
        { heading: "Команда", body: assigneeNames || "—" },
      ]);
      files.push(notes);
    }

    // For tables also give CSV alongside Excel for convenience
    if (primary.kind === "excel") {
      files.push(buildCsv(brief, primary.rows || content.rows));
    }

    const status = `Задача закрыта в Pixel Office
Бриф: ${brief}
Команда: ${assigneeNames || "—"}
Главный файл: ${primary.file.filename}
Тип: ${primary.kind}
Время: ${new Date().toLocaleString("ru-RU")}
`;
    files.push({
      kind: "status",
      label: "Статус (.txt)",
      file: textFile(status, "task_status.txt"),
      note: "Краткий статус выполнения.",
    });
    return files;
  }

  window.OfficeDeliverables = {
    detectKind,
    detectFormatOverride,
    wantsFile,
    attachmentHint,
    buildForBrief,
    buildSummaryPack,
    buildSaleContract,
    buildPresentation,
    buildReport,
    buildCsv,
    buildExcel,
    defaultPresentationSlides,
    defaultMetricsRows,
  };
})();
