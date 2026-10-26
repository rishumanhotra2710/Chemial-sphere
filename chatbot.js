/* ChemicalSphere chatbot widget.

   Two answering modes:
   - Built-in mode (default): answers common questions directly from the
     dataset already loaded in the browser. No backend, no API key, no cost.
   - AI mode: set CHATBOT_API_URL to a deployed Cloudflare Worker (see
     chatbot-worker/README.md) and free-text questions go to an LLM instead,
     with the Worker holding the API key server-side. */

// Paste your deployed Cloudflare Worker URL here to upgrade from built-in
// answers to full free-text AI answers. Leaving it blank is fine — the
// built-in engine below handles the common questions.
const CHATBOT_API_URL = "";

function cbEscapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function cbInline(s) {
  return cbEscapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}
function cbRenderMarkdown(text) {
  const lines = String(text).split(/\r?\n/);
  let html = "";
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const isTableRow = /^\s*\|(.+)\|\s*$/.test(line);
    const nextIsSeparator = i + 1 < lines.length && /^\s*\|?[\s:\-|]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes("-");
    if (isTableRow && nextIsSeparator) {
      const headerCells = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      let j = i + 2;
      const rows = [];
      while (j < lines.length && /^\s*\|(.+)\|\s*$/.test(lines[j])) {
        rows.push(lines[j].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
        j++;
      }
      html += "<table><tr>" + headerCells.map((c) => `<th>${cbInline(c)}</th>`).join("") + "</tr>" +
        rows.map((r) => "<tr>" + r.map((c) => `<td>${cbInline(c)}</td>`).join("") + "</tr>").join("") + "</table>";
      i = j;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      html += "<ul>" + items.map((it) => `<li>${cbInline(it)}</li>`).join("") + "</ul>";
      continue;
    }
    if (line.trim() === "") { i++; continue; }
    html += `<p>${cbInline(line)}</p>`;
    i++;
  }
  return html || "<p></p>";
}

/* ======================================================================
   Built-in answering engine.

   Answers from window.CS_DATA — the same payload every dashboard page
   renders from — so figures quoted here always match what's on screen.
   Intent matching is keyword scoring: deliberately simple and inspectable
   rather than clever, since a wrong-but-confident answer about margin or
   supplier risk is worse than an honest "I didn't understand that".
   ====================================================================== */

function cbTopPlants(n) { return D.plants.slice(0, n); }           // sorted worst OEE first
function cbTopSuppliers(n) { return D.suppliers.slice(0, n); }     // sorted highest risk first
function cbWorstFormulas(n) { return D.formulas.slice(0, n); }     // sorted lowest margin first

function cbAnswerHelp() {
  return `**I answer from this platform's live data.** Things you can ask about:

- **Plants** — OEE, yield, rejection, which site is underperforming
- **Suppliers** — risk scores, OTIF, lead-time drift
- **Formulas & margin** — profitability, raw-material cost variance
- **Inventory** — value, shelf-life risk, working capital
- **Revenue** — growth, and whether it came from volume or price
- **Forecast** — next quarter's throughput and revenue
- **Compliance** — CAPA recurrence, audit score, recall readiness
- **Customers** — top accounts and revenue concentration
- **Recommendations** — what the platform flagged, and what to do about it
- **Outcomes** — what's improved since the platform went live

You can also ask "what is OEE?" (or any other KPI) for its definition.`;
}

function cbAnswerPlants() {
  const worst = D.plants[0];
  const breaching = D.plants.filter((p) => p.oee < D.thresholds.oee_floor);
  const rows = D.plants.map((p) => `| ${p.plant_name} | ${pct(p.oee)} | ${pct(p.yld)} | ${pct(p.margin_pct)} |`).join("\n");
  return `**Plant performance** — ${D.plants.length} plants, latest rolling 6 months.

**${worst.plant_name} (${worst.plant_id})** is the weakest site at **${pct(worst.oee)} OEE**, against a floor of ${pct0(D.thresholds.oee_floor)}, with yield at ${pct(worst.yld)} and rejection at ${pct(worst.rej)}.

| Plant | OEE | Yield | Margin |
|---|---|---|---|
${rows}

${breaching.length === 0
    ? "No plant is below the OEE floor."
    : `${breaching.length} plant${breaching.length > 1 ? "s" : ""} below the floor: ${breaching.map((p) => p.plant_name).join(", ")}.`}`;
}

function cbAnswerSuppliers() {
  const worst = D.suppliers[0];
  const breaching = D.suppliers.filter((s) => s.risk_score > D.thresholds.risk_ceiling);
  const rows = cbTopSuppliers(6)
    .map((s) => `| ${s.supplier_name} | ${s.risk_score.toFixed(0)} | ${pct0(s.otif)} | ${s.ltv > 0 ? "+" : ""}${s.ltv.toFixed(1)}d |`)
    .join("\n");
  return `**Supplier risk** — ${D.suppliers.length} suppliers, latest rolling 6 months.

**${worst.supplier_name} (${worst.supplier_id})** carries the highest risk score at **${worst.risk_score.toFixed(0)}/100** — OTIF ${pct0(worst.otif)}, lead-time variance ${worst.ltv > 0 ? "+" : ""}${worst.ltv.toFixed(1)} days, ${worst.geo_risk.toLowerCase()} geopolitical exposure in ${worst.region}.

| Supplier | Risk | OTIF | Lead Var |
|---|---|---|---|
${rows}

Risk ceiling is ${D.thresholds.risk_ceiling}; ${breaching.length} supplier${breaching.length === 1 ? "" : "s"} above it. Estate-wide supplier OTIF is ${pct(D.current.supplier_otif)}.`;
}

function cbAnswerMargin() {
  const worst = D.formulas[0];
  const rows = cbWorstFormulas(5)
    .map((f) => `| ${f.formula_name} | ${pct(f.margin_pct)} | ${f.rm_var > 0 ? "+" : ""}${pct(f.rm_var)} |`)
    .join("\n");
  return `**Margin & formula profitability** — enterprise gross margin is **${pct(D.current.gross_margin_pct)}** (prime cost ${pct(D.current.prime_cost_pct)}).

The leak is **${worst.formula_name} (${worst.formula_id})** at **${pct(worst.margin_pct)} margin**, with raw-material cost variance of ${worst.rm_var > 0 ? "+" : ""}${pct(worst.rm_var)} against its baseline — a ${worst.product_family} product running below the ${pct0(D.thresholds.margin_floor)} margin floor.

| Formula | Margin | RM Variance |
|---|---|---|
${rows}

Highest-leverage fix: substitute or re-qualify the two highest-cost ingredients in ${worst.formula_name}, and reprice its contract tier.`;
}

function cbAnswerInventory() {
  const sorted = [...D.inventory].sort((a, b) => b.value_at_risk - a.value_at_risk);
  const worst = sorted[0];
  const totalAtRisk = sorted.reduce((a, b) => a + b.value_at_risk, 0);
  const rows = sorted
    .map((i) => `| ${i.plant_name} | ${usd(i.value)} | ${pct0(i.risk)} | ${usd(i.value_at_risk)} |`)
    .join("\n");
  return `**Inventory & shelf-life risk** — ${usd(D.current.inventory_value)} held, turning ${D.current.inventory_turns.toFixed(1)}x, at ${D.current.working_capital_days.toFixed(0)} working-capital days.

**${usd(totalAtRisk)}** sits in stock that's ageing past the safe-resale window. **${worst.plant_name}** is the worst node — ${pct0(worst.risk)} shelf-life risk on ${usd(worst.value)} held (avg age ${worst.age.toFixed(0)} days).

| Plant | Value | Risk | At Risk |
|---|---|---|---|
${rows}

Risk ceiling is ${pct0(D.thresholds.shelf_risk_ceiling)}. Options: reposition to the nearest demand region, convert to a lower-grade blend, or throttle replenishment for two cycles.`;
}

function cbAnswerRevenue() {
  const d = D.revenue_decomposition;
  const volumeLed = Math.abs(d.volume_effect_dollars) > Math.abs(d.price_effect_dollars);
  return `**Revenue** — **${usd(D.current.revenue)}** in the latest quarter, up **${pct(d.revenue_growth_pct)}** on the prior quarter of equal length.

Decomposed against that prior period:

- **Volume effect:** ${pct(d.volume_effect_pct)} (${usd(d.volume_effect_dollars)})
- **Price/mix effect:** ${pct(d.price_effect_pct)} (${usd(d.price_effect_dollars)})

${volumeLed
    ? "Volume is carrying the movement rather than price, which is the healthier of the two — it means demand grew, not just realisation."
    : "Price/mix is carrying the movement rather than volume — worth checking whether that holds if a competitor reprices."}

Across ${num(D.current.batches)} batches, average batch value is ${usd(D.current.avg_batch_value)}.`;
}

function cbAnswerForecast() {
  const f = D.demand_forecast;
  const rows = f.future_periods
    .map((p, i) => `| ${p} | ${num(f.throughput[i].forecast)} t | ${usd(f.revenue[i].forecast)} |`)
    .join("\n");
  const lastHist = f.history[f.history.length - 1];
  return `**Forecast** — next three months, extrapolated from the trailing 12.

| Period | Throughput | Revenue |
|---|---|---|
${rows}

Latest actual month (${lastHist.period}) ran ${num(lastHist.throughput)} t and ${usd(lastHist.revenue)}, so the trend points modestly upward. Throughput for ${f.future_periods[0]} has a confidence band of ${num(f.throughput[0].low)}–${num(f.throughput[0].high)} t.`;
}

function cbAnswerCompliance() {
  const recurring = D.capa_recent.filter((c) => c.recurring).length;
  const causes = {};
  D.capa_recent.forEach((c) => { causes[c.root_cause] = (causes[c.root_cause] || 0) + 1; });
  const topCauses = Object.entries(causes).sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([cause, n]) => `- ${cause} — ${n} record${n === 1 ? "" : "s"}`).join("\n");
  return `**Compliance & quality** — audit compliance score **${D.current.audit_score.toFixed(0)}/100**, recall readiness **${D.current.recall_readiness.toFixed(0)}/100**.

- Batch rejection rate: **${pct(D.current.rejection_rate)}**
- CAPA effectiveness: **${pct(D.current.capa_effectiveness)}**
- Of the ${D.capa_recent.length} most recent CAPA records, **${recurring} are recurring** — recurrence is the signal that a corrective action didn't hold.

Dominant root causes in recent records:
${topCauses}

${D.meta.capa} CAPA records are on file in total. The Compliance Agent fires when a product family's recurrence rate exceeds ${pct0(D.thresholds.capa_recur_ceiling)}.`;
}

function cbAnswerCustomers() {
  const sorted = [...D.customers].sort((a, b) => b.revenue - a.revenue);
  const rows = sorted.slice(0, 5)
    .map((c) => `| ${c.customer_name} | ${usd(c.revenue)} | ${c.region} |`).join("\n");
  const total = sorted.reduce((a, b) => a + b.revenue, 0);
  return `**Customers** — ${sorted.length} accounts, ${usd(total)} over the latest rolling 6 months.

Top five by revenue:

| Customer | Revenue | Region |
|---|---|---|
${rows}

The top five account for **${pct0(D.customer_concentration)}** of revenue. ${D.customer_concentration > 0.5
    ? "That's meaningful concentration — losing one of these accounts would leave a visible hole."
    : "That's a reasonably spread book; no single account dominates."}`;
}

function cbAnswerRecommendations() {
  const crit = D.agents.filter((a) => a.severity === "Critical").length;
  const list = D.agents.map((a) => `- **${a.entity}** (${a.severity}) — ${a.finding} _${a.action}_`).join("\n");
  return `**${D.agents.length} open recommendations**, ${crit} of them critical, fired against ${num(D.meta.batches)} batches.

${list}`;
}

function cbAnswerOutcomes() {
  const rows = D.outcomes.map((o) => {
    const f = (v) => o.unit === "$" ? usd(v) : o.unit === "%" ? pct(v) : o.unit === "days" ? v.toFixed(0) + " d" : o.unit === "x" ? v.toFixed(1) + "x" : v.toFixed(0);
    return `| ${o.label} | ${f(o.baseline)} | ${f(o.live)} | ${o.delta_pct > 0 ? "+" : ""}${(o.delta_pct * 100).toFixed(1)}% |`;
  }).join("\n");
  return `**Outcomes since the platform went live** — baseline (months 1–${D.meta.baseline_months}) vs active (months ${D.meta.baseline_months + 1}–${D.meta.months}).

| Measure | Before | Now | Improvement |
|---|---|---|---|
${rows}

Improvement is directional: for measures where lower is better (rejection rate, working-capital days, carrying value), a positive figure means the number came down.`;
}

function cbAnswerConcentration() {
  const top = D.supplier_concentration[0];
  const concentrated = D.supplier_concentration.filter((r) => r.concentrated);
  const rows = D.supplier_concentration.slice(0, 5)
    .map((r) => `| ${r.material_name} | ${num(r.hhi)} | ${pct0(r.top_supplier_share)} |`).join("\n");
  return `**Supply dependency** — concentration across ${D.supplier_concentration.length} raw materials, trailing 12 months of PO spend.

Most concentrated: **${top.material_name}**, where ${top.top_supplier_name} holds **${pct0(top.top_supplier_share)}** of spend (${usd(top.total_spend * top.top_supplier_share)} of ${usd(top.total_spend)}) across ${top.supplier_count} qualified suppliers.

| Material | HHI | Top Supplier Share |
|---|---|---|
${rows}

${concentrated.length === 0
    ? "Nothing currently breaches the concentration threshold."
    : `${concentrated.length} material${concentrated.length === 1 ? "" : "s"} breach the concentration threshold — a single-supplier disruption there would force allocation, not just re-sourcing.`}`;
}

function cbAnswerKpiDef(question) {
  const q = question.toLowerCase();
  const keys = Object.keys(D.kpi_defs);
  // Longest key first so "Gross Margin %" wins over a bare "margin" substring.
  const match = keys.slice().sort((a, b) => b.length - a.length)
    .find((k) => q.includes(k.toLowerCase().replace(/\s*%$/, "")));
  if (!match) return null;
  return `**${match}** is defined on this platform as:

${D.kpi_defs[match]}

That definition is applied consistently everywhere the metric appears — see the Model Intelligence page for the full KPI dictionary.`;
}

const CB_INTENTS = [
  { fn: cbAnswerHelp, keywords: ["help", "what can you do", "what can i ask", "capabilities", "how do you work", "what do you know"] },
  { fn: cbAnswerRecommendations, keywords: ["recommend", "finding", "flagged", "what should i do", "action", "issue", "problem", "alert", "priority", "attention"] },
  { fn: cbAnswerPlants, keywords: ["plant", "oee", "production", "throughput", "site", "manufacturing", "yield", "equipment", "downtime"] },
  { fn: cbAnswerSuppliers, keywords: ["supplier", "otif", "vendor", "procurement", "lead time", "delivery", "supply chain"] },
  { fn: cbAnswerMargin, keywords: ["margin", "profit", "formula", "recipe", "cost", "leak", "profitability", "pricing"] },
  { fn: cbAnswerInventory, keywords: ["inventory", "stock", "shelf life", "shelf-life", "waste", "working capital", "ageing", "aging", "obsolete"] },
  { fn: cbAnswerRevenue, keywords: ["revenue", "sales", "growth", "topline", "top line", "volume", "price"] },
  { fn: cbAnswerForecast, keywords: ["forecast", "predict", "next quarter", "next month", "outlook", "projection", "future", "expect"] },
  { fn: cbAnswerCompliance, keywords: ["compliance", "capa", "quality", "audit", "recall", "rejection", "regulatory", "deviation"] },
  { fn: cbAnswerCustomers, keywords: ["customer", "account", "client", "buyer"] },
  { fn: cbAnswerOutcomes, keywords: ["outcome", "improvement", "result", "baseline", "since", "impact", "benefit", "roi"] },
  { fn: cbAnswerConcentration, keywords: ["dependency", "depend", "single source", "single-source", "single supplier", "hhi", "concentrated", "concentration", "sole supplier", "sole source", "diversif", "material risk"] },
];

function cbLocalAnswer(question) {
  const q = " " + question.toLowerCase().trim() + " ";

  // A definition question is asking about the metric, not the entity behind it.
  if (/\b(what is|what's|whats|define|definition of|explain|meaning of|how is .* calculated)\b/.test(q)) {
    const def = cbAnswerKpiDef(question);
    if (def) return def;
  }

  let best = null;
  let bestScore = 0;
  for (const intent of CB_INTENTS) {
    let score = 0;
    for (const kw of intent.keywords) {
      if (q.includes(kw)) score += kw.includes(" ") ? 2 : 1; // phrases are stronger evidence
    }
    if (score > bestScore) { bestScore = score; best = intent; }
  }
  if (best) return best.fn();

  return `I couldn't match that to anything in the dataset I can read directly.

I can answer questions about **plants**, **suppliers**, **formulas and margin**, **inventory**, **revenue**, **forecasts**, **compliance**, **customers**, **supply dependency**, or the platform's own **recommendations** — try one of those, or tap a suggestion below.

_Open-ended free-text answers need the AI backend connected; see chatbot-worker/README.md._`;
}

(function () {
  const fab = document.getElementById("cb-fab");
  const panel = document.getElementById("cb-panel");
  const closeBtn = document.getElementById("cb-close");
  const body = document.getElementById("cb-body");
  const suggestWrap = document.getElementById("cb-suggest");
  const input = document.getElementById("cb-input");
  const sendBtn = document.getElementById("cb-send");

  const SUGGESTIONS = [
    "Which plant has the worst OEE right now?",
    "Summarize supplier risk this quarter",
    "What's driving the margin leak?",
    "Give me a report on inventory risk",
  ];

  let history = [];
  let isOpen = false;
  let sending = false;

  function addMsg(role, html, isError) {
    const div = document.createElement("div");
    div.className = "cb-msg " + (role === "user" ? "user" : isError ? "err" : "bot");
    div.innerHTML = html;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    return div;
  }
  function addTyping() {
    const div = document.createElement("div");
    div.className = "cb-msg bot cb-typing";
    div.id = "cb-typing-indicator";
    div.innerHTML = "<span></span><span></span><span></span>";
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }
  function removeTyping() {
    const el = document.getElementById("cb-typing-indicator");
    if (el) el.remove();
  }
  function renderSuggestions() {
    suggestWrap.innerHTML = SUGGESTIONS.map((s) => `<button class="cb-chip">${cbEscapeHtml(s)}</button>`).join("");
    suggestWrap.querySelectorAll(".cb-chip").forEach((btn, idx) => {
      btn.onclick = () => { input.value = SUGGESTIONS[idx]; send(); };
    });
  }
  function greet() {
    if (body.children.length) return;
    addMsg("bot", cbRenderMarkdown(
      "Hi — I'm the ChemicalSphere data assistant. Ask me anything about plants, suppliers, formulas, margin, inventory or compliance, or ask me to put together a short report. I only answer from the platform's own data."
    ));
  }

  async function send() {
    const q = input.value.trim();
    if (!q || sending) return;

    // No Worker configured: answer from the data already in the browser.
    if (!CHATBOT_API_URL) {
      addMsg("user", cbEscapeHtml(q));
      input.value = "";
      history.push({ role: "user", content: q });
      const answer = cbLocalAnswer(q);
      addMsg("bot", cbRenderMarkdown(answer));
      history.push({ role: "assistant", content: answer });
      input.focus();
      return;
    }

    sending = true;
    sendBtn.disabled = true;
    addMsg("user", cbEscapeHtml(q));
    history.push({ role: "user", content: q });
    input.value = "";
    addTyping();

    try {
      const resp = await fetch(CHATBOT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history: history.slice(-8) }),
      });
      const data = await resp.json().catch(() => ({}));
      removeTyping();
      if (!resp.ok) {
        addMsg("bot", cbRenderMarkdown(data.error || `Request failed (HTTP ${resp.status}).`), true);
      } else {
        const answer = data.answer || "I couldn't generate a response.";
        addMsg("bot", cbRenderMarkdown(answer));
        history.push({ role: "assistant", content: answer });
      }
    } catch (e) {
      removeTyping();
      addMsg("bot", cbRenderMarkdown("Couldn't reach the chatbot backend. Check your connection and that the Worker is deployed."), true);
    } finally {
      sending = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  fab.onclick = () => {
    isOpen = !isOpen;
    panel.classList.toggle("open", isOpen);
    if (isOpen) { greet(); renderSuggestions(); input.focus(); }
  };
  closeBtn.onclick = () => { isOpen = false; panel.classList.remove("open"); };
  sendBtn.onclick = send;
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
})();
