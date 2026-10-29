# Setting up the AI scanner and nutrition coach

FuelFlow runs on GitHub Pages, and GitHub Pages can only serve public files. An AI API key placed in the app would be visible to anyone. So photo scanning and the nutrition coach both go through a small **Cloudflare Worker** that holds the key privately. The free plan is enough for personal use.

## 1. Get an AI key

Create an API key at <https://console.anthropic.com>. Usage is billed by Anthropic, so set a monthly spend limit there.

## 2. Create the Worker

1. Sign in at <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Create Worker**.
2. Name it something like `fuelflow-scan` and deploy the starter code.
3. Click **Edit code**, replace everything with the contents of [`scan-worker.js`](./scan-worker.js), then click **Deploy**.

## 3. Add the settings

Go to the Worker's **Settings → Variables and Secrets** and add:

| Name | Type | Value |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Secret | your key from step 1 |
| `ALLOWED_ORIGIN` | Text | `https://nightfury0101.github.io` (your Pages domain, no trailing slash) |
| `MODEL` | Text (optional) | defaults to `claude-sonnet-5-5` |

Requests from any other website are refused, so other people can't use your key through the Worker.

## 4. Limit abuse (recommended)

In Cloudflare, open **Security → WAF → Rate limiting rules** and add a rule for your Worker's hostname. For example, allow 10 requests per minute per IP address.

## 5. Connect FuelFlow

1. Open FuelFlow → **Profile → AI scanner & coach**.
2. Paste the Worker URL, for example `https://fuelflow-scan.yourname.workers.dev`.
3. Tap **Test**, then **Save**.

## Privacy

- Photos are downscaled in the browser to a maximum of 1024 px before they are sent.
- The Worker forwards each photo to the AI provider and keeps nothing.
- Logs record status codes only, never images or keys.
- Results are always shown to you for review and are never saved automatically.
- The coach only receives a summary of your food log if you turn on *Let the coach see my log*. Chat history stays in your browser.

## Testing locally without a key

`node tests/mock-scan-server.mjs` starts a fake scanner on `http://localhost:8787` that always returns the same sample meal. It is only meant for testing the screens.
