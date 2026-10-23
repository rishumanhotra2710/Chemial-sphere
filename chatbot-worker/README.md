# ChemicalSphere Chatbot — Backend

A small Cloudflare Worker that lets business users ask free-text questions about
the platform's data and get AI-generated answers/reports. It holds the Anthropic
API key server-side (Cloudflare Workers secrets are never exposed to the
browser) and proxies chat requests from the static front-end.

**Why this exists:** the platform itself is static files on GitHub Pages — there
is no server to hold a secret API key. This Worker is that server; it's the only
new piece of infrastructure this feature needs.

## What you need before you start

1. A free [Cloudflare account](https://dash.cloudflare.com/sign-up).
2. An [Anthropic API key](https://console.anthropic.com/) (sign up, add a
   payment method, create a key under **API Keys**). This is billed
   pay-as-you-go by Anthropic directly — see **Cost** below.
3. Node.js installed locally (to run the `wrangler` CLI).

## Deploy it (one-time setup)

Run these from the `chatbot-worker/` folder:

```bash
cd chatbot-worker
npm install

# 1. Log in to your Cloudflare account (opens a browser window)
npx wrangler login

# 2. Create the KV namespace used for per-IP rate limiting
npx wrangler kv namespace create CHATBOT_KV
```

That last command prints something like:
```
{ binding = "CHATBOT_KV", id = "abcd1234..." }
```
Copy the `id` value into `wrangler.toml`, replacing `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`.

```bash
# 3. Store your Anthropic API key as a secret (it will prompt you to paste it —
#    it is NOT saved in any file in this repo, and is never sent to the browser)
npx wrangler secret put ANTHROPIC_API_KEY

# 4. Deploy
npx wrangler deploy
```

The deploy command prints your Worker's URL, something like:
```
https://chemicalsphere-chatbot.<your-subdomain>.workers.dev
```

**Copy that URL** — you need it for the last step.

## Point the front-end at your Worker

Open `index.html` in the repo root, find this line near the top of the
`<script>` block:

```js
const CHATBOT_API_URL = ""; // <-- paste your deployed Worker URL here
```

Paste your Worker URL in, e.g.:

```js
const CHATBOT_API_URL = "https://chemicalsphere-chatbot.your-subdomain.workers.dev";
```

Commit and push — GitHub Pages will redeploy automatically, and the chat
button on the live site will start working.

## Testing locally before you deploy

```bash
npm run dev
```
This runs the Worker locally (prints a `localhost` URL) so you can test with
`curl` or Postman before wiring up the front-end. There's also
`node test-smoke.mjs` — a dependency-free smoke test that mocks all network
calls and checks the Worker's request handling (CORS, validation, rate
limiting, error cases) without needing a real deployment or API key.

## Keeping it in sync with a custom domain

Once `chemicalsphere.com` is live, update `wrangler.toml`:
- Add the new domain to `ALLOWED_ORIGINS` (comma-separated)
- Update `DATA_URL` to point at the new domain's `data.js`

Then re-run `npx wrangler deploy`.

## Cost

- **Cloudflare Workers:** free tier covers 100,000 requests/day — far more
  than a business chatbot like this will see.
- **Anthropic API:** billed per token. With the default model
  (`claude-haiku-4-5-20251001`) and the platform's current dataset size
  (~70KB as context per question), a single question costs a small fraction
  of a cent. A business team asking a few hundred questions a month will
  likely spend well under $5/month. Check current pricing at
  [anthropic.com/pricing](https://www.anthropic.com/pricing) — you can also
  switch `ANTHROPIC_MODEL` in `wrangler.toml` to a larger model (e.g.
  `claude-sonnet-5`) for more complex reasoning, at a higher per-token cost.

## Security notes

- The Worker only accepts requests from the origins listed in
  `ALLOWED_ORIGINS` — update this list if you add/change domains.
- Per-IP rate limiting (30 requests/hour by default, via the KV namespace)
  protects against a leaked Worker URL being used to run up your API bill.
  Browser-enforced CORS can be bypassed by non-browser tools that set the
  `Origin` header manually — the rate limit is the real backstop, not CORS
  alone. Tighten `RATE_LIMIT_PER_HOUR` in `src/index.js` if needed.
- The chatbot answers only from the platform's own (synthetic demo) data —
  it has no access to anything else.
