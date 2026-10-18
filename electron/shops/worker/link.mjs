/**
 * The owner's shops link, a Cloudflare Worker on the owner's own account
 * (made by Afus Boutique in the main shop; the owner never sees it).
 *
 *   GET    /health                 is the link up? (public)
 *   POST   /owner/codes            {"shopName"}: a one-time pairing code     } main
 *   PUT    /owner/catalog          the main shop's catalogue (JSON text)     } shop
 *   GET    /owner/shops            the shops linked                          } only
 *   DELETE /owner/shops/<id>       a shop unlinked                           }
 *   POST   /join                   {"code","shopName"} -> the new shop's key (public, limited)
 *   GET    /catalog                the catalogue (a linked shop, with its key)
 *
 * Security
 *   HTTPS only (workers.dev). The main shop: Authorization: Bearer <OWNER_KEY>.
 *   A linked shop: Authorization: Bearer <its key> + X-Afus-Shop: <its id>.
 *   Only hashes of keys and codes are kept; compared in constant time.
 *   A pairing code: 8 digits, one use, 15 minutes. Wrong codes: at most
 *   JOIN_FAIL_MAX in a quarter of an hour for the whole link, then joining
 *   waits (an 8-digit code cannot be guessed in a few tries).
 *
 * Bindings: DB (D1, schema.sql), OWNER_KEY (secret), GROUP_NAME (the owner's
 * name for the shops).
 */
const CODE_MINUTES = 15;
const MAX_LIVE_CODES = 5;
const JOIN_FAIL_MAX = 10;
const SLOT_MS = 15 * 60 * 1000;
const PART = 400000; // characters of catalogue per D1 row
const MAX_CATALOG = 40 * 1000 * 1000;
const NAME_MAX = 80;

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (text) => hex(await crypto.subtle.digest('SHA-256', enc.encode(String(text))));
const randomHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));

function same(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

const HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Strict-Transport-Security': 'max-age=31536000', 'X-Content-Type-Options': 'nosniff' };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: HEADERS });
const bearer = (request) => (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
const nameOf = (v) => String(v || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, NAME_MAX);

async function bodyJson(request, max = 4096) {
    const text = await request.text();
    if (text.length > max) return null;
    try { const v = JSON.parse(text); return v && typeof v === 'object' ? v : null; } catch { return null; }
}

async function isOwner(request, env) {
    const key = bearer(request);
    return !!key && !!env.OWNER_KEY && same(await sha256(key), await sha256(env.OWNER_KEY));
}

async function linkedShop(request, env) {
    const id = request.headers.get('X-Afus-Shop') || '';
    const key = bearer(request);
    if (!/^[a-f0-9]{32}$/.test(id) || !key) return null;
    const row = await env.DB.prepare('SELECT id, name, token_hash FROM shops WHERE id = ? AND removed = 0').bind(id).first();
    if (!row || !same(row.token_hash, await sha256(key))) return null;
    return row;
}

async function readCatalog(env) {
    const meta = await env.DB.prepare("SELECT value FROM meta WHERE key = 'catalog'").first();
    if (!meta) return null;
    const info = JSON.parse(meta.value);
    const rows = (await env.DB.prepare('SELECT data FROM catalog_parts WHERE part < ? ORDER BY part').bind(info.parts).all()).results || [];
    if (rows.length !== info.parts) return null;
    return { ...info, text: rows.map(r => r.data).join('') };
}

async function join(request, env, now) {
    const slot = Math.floor(now / SLOT_MS);
    const fails = await env.DB.prepare('SELECT count FROM join_failures WHERE slot = ?').bind(slot).first();
    if (fails && fails.count >= JOIN_FAIL_MAX) return json(429, { error: 'too_many_tries' });
    const body = await bodyJson(request);
    const code = String(body?.code || '').replace(/\D/g, '');
    const shopName = nameOf(body?.shopName);
    const hash = /^\d{8}$/.test(code) ? await sha256(code) : '';
    const row = hash && await env.DB.prepare('SELECT code_hash, shop_name, expires_at FROM pair_codes WHERE code_hash = ?').bind(hash).first();
    if (!row || row.expires_at < now) {
        await env.DB.prepare('INSERT INTO join_failures (slot, count) VALUES (?, 1) ON CONFLICT(slot) DO UPDATE SET count = count + 1').bind(slot).run();
        return json(403, { error: 'bad_code' });
    }
    const id = randomHex(16);
    const token = randomHex(32);
    const at = new Date(now).toISOString();
    await env.DB.batch([
        env.DB.prepare('DELETE FROM pair_codes WHERE code_hash = ?').bind(hash),
        env.DB.prepare('INSERT INTO shops (id, name, token_hash, joined_at, last_seen) VALUES (?, ?, ?, ?, ?)').bind(id, shopName || row.shop_name, await sha256(token), at, at),
    ]);
    return json(200, { shopId: id, token, shopName: shopName || row.shop_name, groupName: env.GROUP_NAME || '' });
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname.replace(/\/+$/, '') || '/';
        const method = request.method;
        const now = Date.now();
        try {
            if (path === '/health' && method === 'GET') return json(200, { ok: true, app: 'afus-shops', version: 1 });
            if (path === '/join' && method === 'POST') return await join(request, env, now);

            if (path === '/catalog' && method === 'GET') {
                const shop = await linkedShop(request, env);
                if (!shop && !(await isOwner(request, env))) return json(401, { error: 'unauthorized' });
                if (shop) await env.DB.prepare('UPDATE shops SET last_seen = ? WHERE id = ?').bind(new Date(now).toISOString(), shop.id).run();
                const cat = await readCatalog(env);
                if (!cat) return json(404, { error: 'no_catalog' });
                return new Response(cat.text, { status: 200, headers: { ...HEADERS, 'X-Afus-Catalog-At': cat.at, 'X-Afus-Catalog-Hash': cat.hash } });
            }

            if (!path.startsWith('/owner/')) return json(404, { error: 'not_found' });
            if (!(await isOwner(request, env))) return json(401, { error: 'unauthorized' });

            if (path === '/owner/codes' && method === 'POST') {
                const body = await bodyJson(request);
                const shopName = nameOf(body?.shopName);
                if (!shopName) return json(400, { error: 'name_required' });
                await env.DB.prepare('DELETE FROM pair_codes WHERE expires_at < ?').bind(now).run();
                const live = await env.DB.prepare('SELECT COUNT(*) AS n FROM pair_codes').first();
                if ((live?.n || 0) >= MAX_LIVE_CODES) return json(429, { error: 'too_many_codes' });
                const digits = crypto.getRandomValues(new Uint32Array(1))[0] % 100000000;
                const code = String(digits).padStart(8, '0');
                const expiresAt = now + CODE_MINUTES * 60 * 1000;
                await env.DB.prepare('INSERT OR REPLACE INTO pair_codes (code_hash, shop_name, expires_at, created_at) VALUES (?, ?, ?, ?)')
                    .bind(await sha256(code), shopName, expiresAt, new Date(now).toISOString()).run();
                return json(200, { code, expiresAt: new Date(expiresAt).toISOString() });
            }
            if (path === '/owner/catalog' && method === 'PUT') {
                const text = await request.text();
                if (!text || text.length > MAX_CATALOG) return json(413, { error: 'too_large' });
                try { const v = JSON.parse(text); if (!v || v.version !== 1 || !Array.isArray(v.products)) throw new Error('shape'); } catch { return json(400, { error: 'bad_catalog' }); }
                const parts = [];
                for (let i = 0; i < text.length; i += PART) parts.push(text.slice(i, i + PART));
                const info = { parts: parts.length, at: new Date(now).toISOString(), hash: await sha256(text) };
                await env.DB.batch([
                    env.DB.prepare('DELETE FROM catalog_parts'),
                    ...parts.map((data, part) => env.DB.prepare('INSERT INTO catalog_parts (part, data) VALUES (?, ?)').bind(part, data)),
                    env.DB.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('catalog', ?)").bind(JSON.stringify(info)),
                ]);
                return json(200, { at: info.at, hash: info.hash });
            }
            if (path === '/owner/shops' && method === 'GET') {
                const rows = (await env.DB.prepare('SELECT id, name, joined_at, last_seen FROM shops WHERE removed = 0 ORDER BY joined_at').all()).results || [];
                return json(200, { shops: rows.map(r => ({ id: r.id, name: r.name, joinedAt: r.joined_at, lastSeen: r.last_seen })) });
            }
            const m = /^\/owner\/shops\/([a-f0-9]{32})$/.exec(path);
            if (m && method === 'DELETE') {
                await env.DB.prepare('UPDATE shops SET removed = 1 WHERE id = ?').bind(m[1]).run();
                return json(200, { removed: true });
            }
            return json(404, { error: 'not_found' });
        } catch {
            return json(500, { error: 'server' });
        }
    },
};
