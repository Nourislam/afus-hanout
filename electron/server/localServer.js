/**
 * The shop's own server, on its WiFi only (الخادم المحلي).
 *
 * The phone and the price-checker tablet hold no database: they ask the till
 * computer. The owner turns the server on (Settings › Phone and price
 * checker); it answers only addresses of a private network (the shop's WiFi
 * or this computer) and connects to nothing itself.
 *
 * A device pairs once: the computer shows a 6-digit code as a QR code
 * (afushanout://pair?host=…&port=…&code=…), valid 10 minutes and once. The
 * device gets a token; only its SHA-256 is kept (paired_devices). Roles:
 *   kiosk  the price checker: prices only;
 *   phone  prices, counting the shelves into the open stock count, the day.
 *
 * `handle(api, request)` answers one request (testable without a socket);
 * `start({ api, port })` serves it over HTTP.
 */
const http = require('http');
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');
const catalog = require('../services/catalogService');

const DEFAULT_PORT = 4560;
const CODE_MINUTES = 10;
const MAX_BODY = 8 * 1024 * 1024; // a phone photo
const ROLES = ['phone', 'kiosk'];

let pairing = null; // { code, expiresAt }

const hash = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

/** A new 6-digit pairing code, valid 10 minutes from `now`, once. */
function newPairingCode(now = Date.now()) {
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    pairing = { code, expiresAt: now + CODE_MINUTES * 60000 };
    return { code, expiresAt: pairing.expiresAt };
}

function resetPairing() { pairing = null; }

/** What the QR code carries. */
function pairingLink({ host, port, code }) {
    return `afushanout://pair?host=${host}&port=${port}&code=${code}`;
}

/** This computer's addresses on the shop's network (IPv4, not the loopback). */
function lanAddresses() {
    return Object.values(os.networkInterfaces()).flat()
        .filter(a => a && a.family === 'IPv4' && !a.internal && isPrivate(a.address))
        .map(a => a.address);
}

/** An address of a private network: the shop's WiFi or this computer. */
function isPrivate(address) {
    const a = String(address || '').replace(/^::ffff:/, '');
    if (a === '::1' || a.startsWith('127.')) return true;
    if (/^10\./.test(a) || /^192\.168\./.test(a)) return true;
    const m = /^172\.(\d+)\./.exec(a);
    if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
    return /^f[cd][0-9a-f]{2}:/i.test(a) || /^fe80:/i.test(a);
}

function devices(api) {
    return api.all('SELECT id, name, role, created_at, last_seen FROM paired_devices ORDER BY created_at');
}

function removeDevice(api, id) {
    api.run('DELETE FROM paired_devices WHERE id = ?', [id]);
}

function deviceOf(api, headers = {}) {
    const m = /^Bearer\s+([a-f0-9]{48})$/i.exec(String(headers.authorization || ''));
    if (!m) return null;
    const device = api.get('SELECT * FROM paired_devices WHERE token_hash = ?', [hash(m[1].toLowerCase())]);
    if (device) api.run("UPDATE paired_devices SET last_seen = datetime('now') WHERE id = ?", [device.id]);
    return device || null;
}

/** An article by barcode, PLU or scale label, as the screens price it. */
function priceOf(api, code, scaleFormat) {
    const found = catalog.lookupCode(api, code) || catalog.lookupPlu(api, code)
        || (scaleFormat ? catalog.lookupScaleLabel(api, code, scaleFormat) : null);
    if (!found) return null;
    const p = found.product;
    const unit = p.unit === 'kg' ? 'kg' : p.unit === 'service' ? 'service' : 'piece';
    return {
        id: p.id, name: p.name, price: Number(p.price) || 0, unit,
        capped: Number(p.capped_price) > 0 ? Number(p.capped_price) : null,
        carton: found.carton ? { qty: p.carton_qty, price: p.carton_price } : null,
        image: p.image_path || null,
        ...(found.scale ? { scale: found.scale } : {}),
    };
}

const KIOSK_HTML = () => fs.readFileSync(path.join(__dirname, 'kiosk.html'), 'utf8');
const json = (status, body) => ({ status, json: body });

/**
 * One request: { method, path, body, headers, remote } → { status, json | html }.
 * ctx (optional): { scaleFormat, today(api), savePhoto(productId, buffer) }.
 */
async function handle(api, { method, path: target, body, headers = {}, remote }, ctx = {}) {
    if (!isPrivate(remote)) return json(403, { error: 'NOT_LOCAL' });
    const url = new URL(target, 'http://localhost');
    const route = `${method} ${url.pathname}`;

    if (route === 'GET /' || route === 'GET /kiosk') return { status: 200, html: KIOSK_HTML() };

    if (route === 'POST /api/pair') {
        const ok = pairing && body && String(body.code) === pairing.code && Date.now() <= pairing.expiresAt;
        if (!ok) return json(403, { error: 'PAIR_CODE' });
        pairing = null; // once
        const token = crypto.randomBytes(24).toString('hex');
        const role = ROLES.includes(body.role) ? body.role : 'kiosk';
        const name = String(body.name || '').trim().slice(0, 60) || role;
        api.run("INSERT INTO paired_devices (id, name, role, token_hash, created_at, last_seen) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
            [api.uuid(), name, role, hash(token)]);
        const shop = api.get("SELECT value FROM settings WHERE key = 'store_config'");
        let shopName = '';
        try { shopName = JSON.parse(shop?.value || '{}').businessName || ''; } catch { /* no name yet */ }
        return json(200, { token, role, shop: shopName });
    }

    const device = deviceOf(api, headers);
    if (!device) return json(401, { error: 'NOT_PAIRED' });

    if (route === 'GET /api/price') {
        const found = priceOf(api, url.searchParams.get('code') || '', ctx.scaleFormat);
        return found ? json(200, found) : json(404, { error: 'NOT_FOUND' });
    }

    if (device.role !== 'phone') return json(403, { error: 'ROLE' });

    if (route === 'POST /api/count') {
        const counts = require('../services/stockCountService');
        const open = counts.currentCount(api);
        if (!open) return json(409, { error: 'COUNT_NONE' });
        try {
            return json(200, counts.scan(api, open.id, String(body?.code || ''), Number(body?.quantity) || 1));
        } catch (error) {
            return json(422, { error: String(error.message || error).split('|')[0] });
        }
    }

    if (route === 'GET /api/today') {
        const ask = require('../services/askService');
        const { total } = ask.answer(api, 'profitToday');
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const tickets = api.get("SELECT COUNT(*) AS n FROM sales WHERE COALESCE(status, 'completed') NOT IN ('voided', 'cancelled') AND datetime(created_at) >= datetime(?)",
            [start.toISOString().replace('T', ' ').slice(0, 19)]).n;
        return json(200, { sales: total.sales, profit: total.profit, tickets });
    }

    if (route === 'POST /api/photo') {
        const found = priceOf(api, String(body?.code || ''));
        if (!found) return json(404, { error: 'NOT_FOUND' });
        const image = Buffer.from(String(body?.image || ''), 'base64');
        if (!image.length || !ctx.savePhoto) return json(422, { error: 'PHOTO' });
        const saved = await ctx.savePhoto(found.id, image);
        api.run('UPDATE products SET image_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [saved, found.id]);
        return json(200, { id: found.id, image: saved });
    }

    return json(404, { error: 'NO_ROUTE' });
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', (c) => {
            size += c.length;
            if (size > MAX_BODY) { reject(new Error('TOO_BIG')); req.destroy(); return; }
            chunks.push(c);
        });
        req.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            try { resolve(text ? JSON.parse(text) : null); } catch { resolve(null); }
        });
        req.on('error', reject);
    });
}

/** Serve the shop's devices. Resolves with { port, addresses, stop() }. */
function start({ api, port = DEFAULT_PORT, ctx = {} }) {
    const server = http.createServer(async (req, res) => {
        try {
            const body = req.method === 'POST' ? await readBody(req) : null;
            const out = await handle(api, { method: req.method, path: req.url, body, headers: req.headers, remote: req.socket.remoteAddress }, ctx);
            if (out.html !== undefined) {
                res.writeHead(out.status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
                res.end(out.html);
            } else {
                res.writeHead(out.status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
                res.end(JSON.stringify(out.json));
            }
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'SERVER' }));
            console.error('Local server:', error);
        }
    });
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, () => {
            resolve({
                port: server.address().port,
                addresses: lanAddresses(),
                stop: () => new Promise(done => server.close(() => done())),
            });
        });
    });
}

module.exports = { handle, start, newPairingCode, resetPairing, pairingLink, lanAddresses, isPrivate, devices, removeDevice, DEFAULT_PORT };
