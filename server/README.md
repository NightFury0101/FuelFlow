# Optional: run the AI coach through your own server

The simplest way to connect the FuelFlow coach is to paste a Claude API key in **Profile → AI nutrition coach**; it's stored only on that phone.

If other people will use your FuelFlow, use this small **Cloudflare Worker** instead: it holds the key privately on the server, so nobody needs a key on their phone. The free Cloudflare plan is enough.

## 1. Get an AI key

Create an API key at <https://console.anthropic.com>. Usage is billed by Anthropic, so set a monthly spend limit there.

## 2. Create the Worker

1. Sign in at <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Create Worker**.
2. Name it something like `fuelflow-coach` and deploy the starter code.
3. Click **Edit code**, replace everything with the contents of [`coach-worker.js`](./coach-worker.js), then click **Deploy**.

## 3. Add the settings

Go to the Worker's **Settings → Variables and Secrets** and add:

| Name | Type | Value |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Secret | your key from step 1 (or use `GEMINI_API_KEY` instead) |
| `GEMINI_API_KEY` | Secret (optional) | a Google AI Studio key, if you'd rather use Gemini |
| `ALLOWED_ORIGIN` | Text | `https://nightfury0101.github.io,capacitor://localhost` (your Pages domain and the iPhone app, comma-separated, no trailing slash) |
| `MODEL` / `GEMINI_MODEL` | Text (optional) | defaults to `claude-sonnet-5-5` / `gemini-3.6-flash` |

**Selling it as Premium?** Also add `REVENUECAT_SECRET_KEY` (and optionally `DAILY_LIMIT`). The
Worker then only answers people with an active FuelFlow Premium subscription — see
[PREMIUM.md](../PREMIUM.md).

Requests from any other website are refused, so other people can't use your key through the Worker.

## 4. Limit abuse (recommended)

In Cloudflare, open **Security → WAF → Rate limiting rules** and add a rule for your Worker's hostname. For example, allow 10 requests per minute per IP address.

## 5. Connect FuelFlow

1. Open FuelFlow → **Profile → AI nutrition coach → Own server**.
2. Paste the Worker URL, for example `https://fuelflow-coach.yourname.workers.dev`.
3. Tap **Test**, then **Save**.

## Privacy

- The coach only receives a summary of your food log if you turn on *Let the coach see my log*. Chat history stays in your browser.
- The Worker forwards each question to the AI provider and keeps nothing.
- Logs record status codes only, never messages or keys.

## Testing locally without a key

`node tests/mock-ai-server.mjs` starts a fake coach on `http://localhost:8787` that always returns the same sample reply. It is only meant for testing the screens.
