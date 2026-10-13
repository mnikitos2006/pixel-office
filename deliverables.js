/**
 * Real file deliverables for the office chat (no LLM required).
 * Builds downloadable blobs: Word (.doc), TXT, CSV, MD.
 */
(() => {
  function downloadUrl(blob, filename) {
    const url = URL.createObjectURL(blob);
    // Revoke later to keep link working for a while
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

  function detectKind(brief) {
    const t = String(brief).toLowerCase();
    if (/договор|купл.?продаж|купл[ия].*продаж|продаж.*купл|deed of sale|purchase.?sale|соглашен(ие|ия) купли/.test(t)) {
      return "sale_contract";
    }
    if (/договор|контракт|соглашен/.test(t) && /word|\.docx?|файл|документ|скинь|пришли/.test(t)) {
      return "sale_contract";
    }
    if (/word|\.docx?/.test(t) && /договор|документ|файл/.test(t)) return "sale_contract";
    if (/csv|excel|xlsx|таблиц/.test(t)) return "csv";
    if (/md|markdown|readme/.test(t)) return "md";
    if (/файл|документ|скинь|пришли|скача|pdf|txt/.test(t)) return "brief_pack";
    return null;
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

  function buildCsv(brief) {
    const rows = [
      ["Поле", "Значение"],
      ["Бриф", brief],
      ["Дата", new Date().toISOString()],
      ["Статус", "черновик"],
      ["Ответственный", "Ada (CEO)"],
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    return {
      kind: "csv",
      label: "Таблица (.csv)",
      file: textFile("\ufeff" + csv, "pixel_office_export.csv", "text/csv;charset=utf-8"),
      note: "CSV-таблица по вашему запросу.",
    };
  }

  function buildBriefPack(brief) {
    const md = `# Результат задачи Pixel Office

## Запрос
${brief}

## Что сделано
- Задача принята CEO (Ada)
- Подготовлен текстовый пакет результата

## Дальше
Можно попросить договор в Word, таблицу CSV или уточнить детали в личке с агентом.

_Сгенерировано: ${new Date().toLocaleString("ru-RU")}_
`;
    return {
      kind: "brief_pack",
      label: "Отчёт (.md)",
      file: textFile(md, "pixel_office_result.md", "text/markdown;charset=utf-8"),
      note: "Текстовый отчёт по задаче.",
    };
  }

  function buildForBrief(brief) {
    const kind = detectKind(brief);
    if (kind === "sale_contract") return buildSaleContract(brief);
    if (kind === "csv") return buildCsv(brief);
    if (kind === "md" || kind === "brief_pack") return buildBriefPack(brief);
    return null;
  }

  /** Always produce at least one useful attachment for CEO summary */
  function buildSummaryPack(brief, assigneeNames) {
    const primary = buildForBrief(brief);
    const files = [];
    if (primary) files.push(primary);
    else {
      files.push(buildBriefPack(brief));
    }
    // Always add a short status txt
    const status = `Задача закрыта в Pixel Office
Бриф: ${brief}
Команда: ${assigneeNames}
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
    buildForBrief,
    buildSummaryPack,
    buildSaleContract,
  };
})();
