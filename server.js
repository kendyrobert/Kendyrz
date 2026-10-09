// Servidor sin dependencias (Node 18+). Valida Turnstile y el tiempo de cada etapa.
// El estado viaja en un token firmado (HMAC): recargar la página lo retoma, pero no permite saltarse etapas.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
try { fs.readFileSync('.env', 'utf8').split('\n').forEach(l => { const m = l.match(/^([A-Z_]+)=([^#]*)/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim(); }); } catch {}
const { TURNSTILE_SECRET = '', SESSION_SECRET = 'dev-secret', APP_DOWNLOAD_URL = '', PORT = 3000 } = process.env;
const STAGE_MS = (parseInt(process.env.STAGE_SECONDS) || 15) * 1000, STAGES = 10;
const sign = s => crypto.createHmac('sha256', SESSION_SECRET).update(s).digest('hex');
const mint = stage => { const b = `${stage}.${Date.now()}`; return `${b}.${sign(b)}`; };
const read = tok => {
  const [stage, t, sig] = String(tok || '').split('.');
  if (!sig || sig.length !== 64 || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(`${stage}.${t}`)))) return null;
  return { stage: +stage, t: +t };
};
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const body = req => new Promise(r => { let d = ''; req.on('data', c => { d += c; if (d.length > 4096) req.destroy(); }); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch { r({}); } }); });
const wait = s => Math.max(0, STAGE_MS - (Date.now() - s.t));

async function verifyTurnstile(token, ip) {
  if (!TURNSTILE_SECRET) return true; // modo desarrollo
  if (typeof token !== 'string' || !token) return false;
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body: new URLSearchParams({ secret: TURNSTILE_SECRET, response: token, remoteip: ip || '' })
  });
  return (await r.json()).success === true;
}

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' };
http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  if (req.method === 'POST' && url.startsWith('/api/')) {
    const b = await body(req);
    if (url === '/api/start') {
      if (!(await verifyTurnstile(b.cf, req.socket.remoteAddress).catch(() => false))) return json(res, 403, { error: 'No se pudo validar la verificación humana. Inténtalo de nuevo.' });
      return json(res, 200, { token: mint(1), stage: 1, remainingMs: STAGE_MS });
    }
    const s = read(b.token);
    if (!s || s.stage < 1 || s.stage > STAGES + 1) return json(res, 400, { error: 'Sesión no válida. Vuelve a empezar.' });
    if (url === '/api/status') return json(res, 200, { stage: s.stage, remainingMs: s.stage > STAGES ? 0 : wait(s) });
    if (url === '/api/next') {
      if (s.stage > STAGES) return json(res, 400, { error: 'Ya completaste todas las etapas.' });
      const left = wait(s);
      if (left > 0) return json(res, 425, { error: 'Aún no ha terminado el contador.', remainingMs: left });
      return json(res, 200, { token: mint(s.stage + 1), stage: s.stage + 1, remainingMs: s.stage + 1 > STAGES ? 0 : STAGE_MS });
    }
    if (url === '/api/final') {
      if (s.stage <= STAGES) return json(res, 403, { error: 'Completa las diez etapas primero.' });
      return json(res, 200, { downloadUrl: APP_DOWNLOAD_URL });
    }
    return json(res, 404, { error: 'No encontrado' });
  }
  const file = path.join(__dirname, 'public', url === '/' ? 'index.html' : url);
  if (!file.startsWith(path.join(__dirname, 'public'))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (e, d) => {
    if (e) { res.writeHead(404); return res.end('No encontrado'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
    res.end(d);
  });
}).listen(PORT, () => console.log(`Ruta Segura en http://localhost:${PORT}`));
