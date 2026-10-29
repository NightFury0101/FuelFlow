// Local stand-in for the scanner server, used only for testing the scan flow in a browser.
// It returns a fixed response and never calls an AI provider.  Run: node tests/mock-scan-server.mjs
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
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}');
      if (req.url.startsWith('/chat')) {
        const last = (parsed.messages || []).at(-1)?.content || '';
        const shared = !String(parsed.context).includes('NOT shared');
        res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
        return setTimeout(() => res.end(JSON.stringify({
          reply: `### Dinner ideas\nYou asked: **${last.slice(0, 60)}**\n\n${shared ? 'Based on your log, you have room for a protein-focused dinner.' : 'I can\u2019t see your log, so here are general ideas.'}\n\n- Grilled tuna (150 g) with rice and salad — about 450 kcal\n- Chickpea curry with roshi — about 500 kcal\n\n1. Fill half the plate with vegetables\n2. Add a palm of protein\n\n*Suggestions only, not medical advice.*`,
        })), 500);
      }
      const { image, details } = parsed;
      if (!String(image || '').startsWith('data:image/')) {
        res.writeHead(400, { ...cors, 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'missing image' }));
      }
      setTimeout(() => {
        res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            items: [
              { name: 'Grilled salmon', serving: '1 fillet', grams: 140, kcal: 290, protein: 31, carbs: 0, fat: 17, confidence: 'high' },
              { name: 'White rice', serving: 'about 1 cup', grams: 160, kcal: 208, protein: 4.3, carbs: 45, fat: 0.5, confidence: 'medium' },
              { name: 'Mixed salad with dressing', serving: '1 side', grams: 90, kcal: 80, protein: 1.5, carbs: 6, fat: 6, confidence: 'low' },
            ],
            questions: details ? [] : ['Was the salmon cooked in oil or butter?', 'Is there dressing on the salad?'],
          }),
        );
      }, 600);
    });
  })
  .listen(port, () => console.log(`mock scanner on http://localhost:${port}`));
