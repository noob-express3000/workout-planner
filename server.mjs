import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SYSTEM_PROMPT, validateInput, validateDraft } from './server/debrief.mjs';

const root = new URL('./', import.meta.url);
const assets = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/debrief.js': ['debrief.js', 'text/javascript'], '/pcm-worklet.js': ['pcm-worklet.js', 'text/javascript'], '/styles.css': ['styles.css', 'text/css'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'] };
const sameSecret = (a, b) => {
  const x = Buffer.from(a || ''), y = Buffer.from(b || '');
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
};

export function createApp({ env = process.env, upstreamFetch = fetch } = {}) {
  let windowStart = Date.now(), requests = 0, running = 0;
  return createServer(async (req, res) => {
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'microphone=(self)');
    let path;
    try { path = new URL(req.url, 'http://localhost').pathname; } catch { return send(400, { error: 'Invalid URL.' }); }
    if (!path.startsWith('/api/')) {
      if (!['GET', 'HEAD'].includes(req.method) || !assets[path]) return send(404, { error: 'Not found.' });
      try {
        const [name, mime] = assets[path]; const data = await readFile(new URL(name, root));
        res.writeHead(200, { 'Content-Type': `${mime}; charset=utf-8`, 'Cache-Control': 'no-cache' });
        return res.end(req.method === 'HEAD' ? undefined : data);
      } catch { return send(500, { error: 'Could not load application.' }); }
    }
    const origin = req.headers.origin;
    const allowed = env.ALLOWED_ORIGIN || '';
    const sameOrigin = origin === `http://${req.headers.host}` || origin === `https://${req.headers.host}`;
    if (origin && origin !== allowed && !sameOrigin) return send(403, { error: 'This site is not allowed to use the voice service.' });
    if (origin && origin === allowed) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Ledger-Token');
      res.writeHead(204); return res.end();
    }
    if (path === '/api/health' && req.method === 'GET') return send(200, { configured: Boolean(env.ASSEMBLYAI_API_KEY && env.APP_ACCESS_TOKEN), provider: 'AssemblyAI' });
    if (!['/api/voice/token', '/api/debrief'].includes(path) || req.method !== 'POST') return send(404, { error: 'Not found.' });
    if (!env.ASSEMBLYAI_API_KEY || !env.APP_ACCESS_TOKEN) return send(503, { error: 'Voice service needs ASSEMBLYAI_API_KEY and APP_ACCESS_TOKEN configured on the server.' });
    if (!sameSecret(req.headers['x-ledger-token'], env.APP_ACCESS_TOKEN)) return send(401, { error: 'Enter the voice service access password in Connection.' });
    if (Date.now() - windowStart > 60000) { requests = 0; windowStart = Date.now(); }
    if (++requests > 30 || running >= 4) return send(429, { error: 'The voice service is busy. Try again shortly.' });
    if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Expected JSON.' });
    running++;
    try {
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 65536) { send(413, { error: 'Transcript is too large.' }); req.resume(); return; } chunks.push(chunk); }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { return send(400, { error: 'Invalid JSON.' }); }
      const headers = { authorization: env.ASSEMBLYAI_API_KEY, 'content-type': 'application/json' };
      if (path === '/api/voice/token') {
        const result = await upstreamFetch('https://streaming.assemblyai.com/v3/token?expires_in_seconds=60&max_session_duration_seconds=600', { headers, signal: AbortSignal.timeout(15000) });
        if (!result.ok) return send(502, { error: `AssemblyAI could not start narration (${result.status}). Check API access and credits.` });
        const token = await result.json();
        if (typeof token.token !== 'string') throw new Error('Invalid provider token');
        return send(200, { token: token.token });
      }
      let input;
      try { input = validateInput(body); } catch (error) { return send(400, { error: error.message }); }
      const result = await upstreamFetch('https://llm-gateway.assemblyai.com/v1/chat/completions', {
        method: 'POST', headers, signal: AbortSignal.timeout(45000), body: JSON.stringify({ model: env.ASSEMBLYAI_LLM_MODEL || 'qwen3.5-4b-32k-fast', max_tokens: 2400,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: JSON.stringify(input) }] }) });
      if (!result.ok) return send(502, { error: `AssemblyAI could not review the study session (${result.status}). Check LLM Gateway access and credits.` });
      const data = await result.json(); let draft;
      try {
        const content = data.choices?.[0]?.message?.content;
        const parsed = JSON.parse(String(content || '').replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, ''));
        draft = validateDraft(parsed, input.transcript);
      } catch (error) { return send(502, { error: error.message.startsWith('The ') ? error.message : 'The agent returned unreadable output. Your transcript is safe; try again.' }); }
      if (input.questions.length >= 3) draft.question = '';
      send(200, { draft, provider: 'AssemblyAI LLM Gateway' });
    } catch { send(502, { error: 'Could not reach AssemblyAI. Your transcript is kept locally; try again.' }); }
    finally { running--; }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createApp();
  server.requestTimeout = 60000;
  server.listen(Number(process.env.PORT || 8080), process.env.HOST || '0.0.0.0', () => console.log('Study Ledger server ready.'));
}
