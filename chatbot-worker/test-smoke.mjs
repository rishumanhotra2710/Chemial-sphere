// Local smoke test for src/index.js — mocks fetch (both the data.js fetch and
// the OpenAI API call) so we can exercise the Worker's logic without any
// real network access, a deployed Worker, or an API key.
import worker from "./src/index.js";

const fakeDataJs = `/* fake */\nwindow.CS_DATA = ${JSON.stringify({
  meta: { plants: 6, formulas: 12 },
  kpi_defs: { "OEE": "mean(batch OEE)" },
  agents: [{ agent: "Test Agent", severity: "High", domain: "Manufacturing", entity: "Plant X", signal: "s", finding: "f", action: "a", impact: "$1" }],
})};\n`;

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (typeof url === "string" && url.includes("data.js")) {
    return new Response(fakeDataJs, { status: 200 });
  }
  if (typeof url === "string" && url.includes("api.openai.com")) {
    const reqBody = JSON.parse(opts.body);
    const systemMsg = reqBody.messages.find((m) => m.role === "system");
    console.log("  -> OpenAI request system prompt length:", systemMsg ? systemMsg.content.length : 0);
    console.log("  -> OpenAI request messages:", JSON.stringify(reqBody.messages.filter((m) => m.role !== "system")));
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Mock answer referencing Plant X." } }] }), { status: 200 });
  }
  throw new Error("Unexpected fetch to " + url);
};

const env = {
  OPENAI_API_KEY: "test-key",
  OPENAI_MODEL: "gpt-4o-mini",
  DATA_URL: "https://example.com/data.js",
  ALLOWED_ORIGINS: "https://rishumanhotra2710.github.io,http://localhost:8000",
  CHATBOT_KV: undefined,
};
const ctx = { waitUntil: () => {} };

async function run(name, request) {
  console.log(`\n--- ${name} ---`);
  const res = await worker.fetch(request, env, ctx);
  const text = await res.text();
  console.log("status:", res.status, "body:", text);
  console.log("CORS allow-origin:", res.headers.get("Access-Control-Allow-Origin"));
  return { status: res.status, body: text };
}

async function main() {
  // 1. OPTIONS preflight
  await run("OPTIONS preflight", new Request("https://worker.example/chat", {
    method: "OPTIONS",
    headers: { Origin: "https://rishumanhotra2710.github.io" },
  }));

  // 2. Valid POST from allowed origin
  const r2 = await run("Valid POST", new Request("https://worker.example/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://rishumanhotra2710.github.io" },
    body: JSON.stringify({ question: "Which plant has the worst OEE?" }),
  }));
  if (r2.status !== 200 || !r2.body.includes("Plant X")) throw new Error("Valid POST test failed");

  // 3. Disallowed origin
  const r3 = await run("Disallowed origin", new Request("https://worker.example/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
    body: JSON.stringify({ question: "hi" }),
  }));
  if (r3.status !== 403) throw new Error("Disallowed origin test failed");

  // 4. Missing question
  const r4 = await run("Missing question", new Request("https://worker.example/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://rishumanhotra2710.github.io" },
    body: JSON.stringify({}),
  }));
  if (r4.status !== 400) throw new Error("Missing question test failed");

  // 5. Missing API key
  const envNoKey = { ...env, OPENAI_API_KEY: undefined };
  const r5 = await worker.fetch(new Request("https://worker.example/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://rishumanhotra2710.github.io" },
    body: JSON.stringify({ question: "hi" }),
  }), envNoKey, ctx);
  console.log("\n--- Missing API key ---\nstatus:", r5.status, "body:", await r5.text());
  if (r5.status !== 500) throw new Error("Missing API key test failed");

  console.log("\nAll smoke tests passed.");
}

main().catch((e) => { console.error("SMOKE TEST FAILED:", e); process.exit(1); }).finally(() => { globalThis.fetch = originalFetch; });
