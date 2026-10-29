// Server di TEST che imita i soli endpoint Supabase usati dall'app (Auth anonima/password, PostgREST rpc e select).
// Ogni richiesta gira su Postgres con ruolo `authenticated`/`anon` e `request.jwt.claims` dal token,
// quindi RLS, GRANT e funzioni sono quelli veri delle migrazioni. NON usare in produzione.
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54321);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
// utenti creator di test: email → { id, password }
const CREATORS = JSON.parse(process.env.FAKE_CREATORS ?? '{}');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(sub, anonymous) {
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', aud: 'authenticated', is_anonymous: anonymous, iat: now, exp: now + 3600 })}.test`;
}
function session(sub, email, anonymous) {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: jwt(sub, anonymous), token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: `r-${sub}`,
    user: { id: sub, aud: 'authenticated', role: 'authenticated', email: email ?? '', is_anonymous: anonymous, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  };
}
function claimsFrom(req) {
  const h = req.headers.authorization ?? '';
  const tok = h.replace(/^Bearer /, '');
  const parts = tok.split('.');
  if (parts.length !== 3 || parts[2] !== 'test') return null; // anon key: nessuna identità
  try { return JSON.parse(Buffer.from(parts[1], 'base64url').toString()); } catch { return null; }
}

async function asRole(claims, fn) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(`select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)`, [JSON.stringify(claims ?? {}), claims?.sub ?? '']);
    await c.query(claims ? 'set local role authenticated' : 'set local role anon');
    const r = await fn(c);
    await c.query('commit');
    return r;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

const ident = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw Object.assign(new Error('bad identifier'), { code: '42602' });
  return s;
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204);
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  try {
    // ---------------------------------------------------------------- auth
    if (url.pathname === '/auth/v1/signup') return send(res, 200, session(randomUUID(), null, true));
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
      const u = CREATORS[body.email];
      if (!u || u.password !== body.password) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return send(res, 200, session(u.id, body.email, false));
    }
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
      const sub = String(body.refresh_token ?? '').replace(/^r-/, '');
      const email = Object.entries(CREATORS).find(([, v]) => v.id === sub)?.[0];
      return send(res, 200, session(sub, email ?? null, !email));
    }
    if (url.pathname === '/auth/v1/logout') return send(res, 204);
    if (url.pathname === '/auth/v1/user') {
      const c = claimsFrom(req);
      return c ? send(res, 200, session(c.sub, null, c.is_anonymous).user) : send(res, 401, { msg: 'no user' });
    }

    const claims = claimsFrom(req);
    // ---------------------------------------------------------------- rpc
    const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
    if (rpc && req.method === 'POST') {
      const fn = ident(rpc[1]);
      const keys = Object.keys(body).map(ident);
      const values = keys.map((k) => (body[k] !== null && typeof body[k] === 'object' && !Array.isArray(body[k]) ? JSON.stringify(body[k]) : body[k]));
      const sql = `select to_jsonb(public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')})) as r`;
      const r = await asRole(claims, (c) => c.query(sql, values));
      return send(res, 200, r.rows[0].r);
    }
    // ---------------------------------------------------------------- select con order/offset/limit
    const tbl = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/);
    if (tbl && req.method === 'GET') {
      const t = ident(tbl[1]);
      const [ocol, odir] = (url.searchParams.get('order') ?? 'id.asc').split('.');
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 1000);
      const sql = `select coalesce(jsonb_agg(x), '[]'::jsonb) as r from (select * from public.${t} order by ${ident(ocol)} ${odir === 'desc' ? 'desc' : 'asc'} offset ${offset} limit ${limit}) x`;
      const r = await asRole(claims, (c) => c.query(sql));
      return send(res, 200, r.rows[0].r);
    }
    return send(res, 404, { message: 'not found in fake server' });
  } catch (e) {
    const status = e.code === '42501' ? 403 : 400;
    return send(res, status, { code: e.code, message: e.message, details: e.detail ?? null, hint: null });
  }
});

server.listen(PORT, () => console.log(`fake supabase su http://localhost:${PORT}`));
