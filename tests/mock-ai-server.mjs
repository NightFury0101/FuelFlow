// Local stand-in for server/coach-worker.js, used only for testing the coach screen in a browser.
// It returns a fixed reply and never calls an AI provider.  Run: node tests/mock-ai-server.mjs
import http from 'node:http';

const port = Number(process.env.PORT || 8787);
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };

http
  .createServer((req, res) => {
    if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
    if (req.method === 'GET' && req.url.startsWith('/health')) {
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, configured: true, mock: true }));
    }
    if (req.method !== 'POST' || !req.url.startsWith('/chat')) {
      res.writeHead(404, { ...cors, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Not found' }));
    }
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}');
      const last = (parsed.messages || []).at(-1)?.content || '';
      const shared = !String(parsed.context).includes('NOT shared');
      setTimeout(() => {
        res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            reply: `### Dinner ideas\nYou asked: **${last.slice(0, 60)}**\n\n${shared ? 'Based on your log, you have room for a protein-focused dinner.' : 'I can’t see your log, so here are general ideas.'}\n\n- Grilled tuna (150 g) with rice and salad — about 450 kcal\n- Chickpea curry with roshi — about 500 kcal\n\n1. Fill half the plate with vegetables\n2. Add a palm of protein\n\n*Suggestions only, not medical advice.*`,
          }),
        );
      }, 500);
    });
  })
  .listen(port, () => console.log(`mock coach on http://localhost:${port}`));
