/* ChemicalSphere chatbot widget — talks to the Cloudflare Worker in chatbot-worker/.
   The Worker holds the Anthropic API key server-side; this file only ever
   sends plain-text questions and receives plain-text answers. */

// Paste your deployed Cloudflare Worker URL here once you've followed
// chatbot-worker/README.md. Leave blank to show a friendly "not set up yet"
// message instead of failing silently.
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

    if (!CHATBOT_API_URL) {
      addMsg("user", cbEscapeHtml(q));
      input.value = "";
      addMsg("bot", cbRenderMarkdown(
        "This chatbot isn't connected to a backend yet. See **chatbot-worker/README.md** for the one-time setup (deploy the Worker, add your Anthropic API key, then paste the Worker URL into `CHATBOT_API_URL` at the top of `chatbot.js`)."
      ), true);
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
