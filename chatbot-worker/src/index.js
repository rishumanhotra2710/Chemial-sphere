/**
 * ChemicalSphere chatbot Worker.
 *
 * Holds the OpenAI API key server-side (as a Cloudflare secret) and proxies
 * chat requests from the static front-end. On every request it fetches the
 * platform's live data.js payload (short in-memory cache) and includes it as
 * context, so the model answers from the same numbers the dashboard shows.
 */

const RATE_LIMIT_PER_HOUR = 30;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_QUESTION_LEN = 2000;
const MAX_HISTORY_TURNS = 8;

let cachedData = null;
let cachedAt = 0;

function getAllowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(origin, allowedOrigins) {
  const allow = allowedOrigins.includes(origin) ? origin : "null";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

async function getPlatformData(env) {
  const now = Date.now();
  if (cachedData && now - cachedAt < CACHE_TTL_MS) return cachedData;

  const url = env.DATA_URL;
  const resp = await fetch(url, { cf: { cacheTtl: 300, cacheEverything: true } });
  if (!resp.ok) throw new Error(`Failed to fetch platform data (HTTP ${resp.status})`);
  const text = await resp.text();

  const match = text.match(/window\.CS_DATA\s*=\s*([\s\S]*?);\s*$/);
  if (!match) throw new Error("Could not parse window.CS_DATA out of data.js");

  const parsed = JSON.parse(match[1]);
  cachedData = parsed;
  cachedAt = now;
  return parsed;
}

function buildSystemPrompt(platformData) {
  return `You are the ChemicalSphere data assistant, built into a decision-intelligence platform for a chemical manufacturing enterprise. Business users (plant managers, supply chain leads, the CFO, compliance officers) ask you questions in plain English about the platform's data, or ask you to put together a short report.

You are given the platform's full current dataset below as JSON. It covers plants, suppliers, raw materials, formulas, products, customers, aggregated batch/production figures, purchase orders, shipments, inventory, CAPA/compliance records, KPI definitions, agent-detected findings ("agents"), outcome tracking (baseline vs platform-active), demand and shelf-life forecasts, margin what-if base figures, supplier concentration, and a data lineage/thresholds catalog.

Rules:
- Answer ONLY from the data provided below. If the data doesn't contain what's needed to answer, say so plainly rather than guessing or inventing numbers.
- When asked for a "report," structure your answer with a short headline, then a markdown table or bullet list of the relevant figures, then 1-2 sentences of interpretation.
- If a metric name isn't self-explanatory, briefly explain it using the kpi_defs in the data.
- Cite specific figures (plant names, supplier names, $ amounts, percentages) rather than vague language.
- Keep answers concise and written for a business audience, not a data engineer.
- Use markdown: **bold** for key figures, bullet lists, and pipe tables (| col | col |) where a table is the clearest format.

Platform dataset (JSON):
${JSON.stringify(platformData)}`;
}

async function checkRateLimit(request, env, ctx) {
  if (!env.CHATBOT_KV) return true; // no KV bound — skip limiting rather than fail closed on a config gap
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const hour = Math.floor(Date.now() / 3600000);
  const key = `rl:${ip}:${hour}`;
  const current = parseInt((await env.CHATBOT_KV.get(key)) || "0", 10);
  if (current >= RATE_LIMIT_PER_HOUR) return false;
  ctx.waitUntil(env.CHATBOT_KV.put(key, String(current + 1), { expirationTtl: 3600 }));
  return true;
}

export default {
  async fetch(request, env, ctx) {
    const allowedOrigins = getAllowedOrigins(env);
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin, allowedOrigins);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, headers);
    }
    if (!allowedOrigins.includes(origin)) {
      return json({ error: "Origin not allowed" }, 403, headers);
    }

    const okToProceed = await checkRateLimit(request, env, ctx);
    if (!okToProceed) {
      return json({ error: "Rate limit exceeded. Please try again in a bit." }, 429, headers);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400, headers);
    }

    const question = (body.question || "").toString().trim().slice(0, MAX_QUESTION_LEN);
    if (!question) {
      return json({ error: "Missing question" }, 400, headers);
    }
    const history = Array.isArray(body.history)
      ? body.history
          .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-MAX_HISTORY_TURNS)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
      : [];

    if (!env.OPENAI_API_KEY) {
      return json(
        { error: "Server not configured: the OPENAI_API_KEY secret is missing. See chatbot-worker/README.md." },
        500,
        headers
      );
    }

    let platformData;
    try {
      platformData = await getPlatformData(env);
    } catch (e) {
      return json({ error: "Could not load platform data: " + e.message }, 502, headers);
    }

    const model = env.OPENAI_MODEL || "gpt-4o-mini";
    const systemPrompt = buildSystemPrompt(platformData);
    const messages = [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: question }];

    let upstream;
    try {
      upstream = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          messages,
        }),
      });
    } catch {
      return json({ error: "Failed to reach the AI provider." }, 502, headers);
    }

    let data;
    try {
      data = await upstream.json();
    } catch {
      return json({ error: "The AI provider returned an unreadable response." }, 502, headers);
    }

    if (!upstream.ok) {
      return json({ error: data?.error?.message || `Upstream API error (HTTP ${upstream.status})` }, upstream.status, headers);
    }

    const answer = (data.choices?.[0]?.message?.content || "").trim() || "I couldn't generate a response for that.";

    return json({ answer }, 200, headers);
  },
};
