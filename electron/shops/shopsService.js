/**
 * Shops link (phase 1): one owner, several shops. The main shop makes the
 * link on the owner's own Cloudflare account (a small Worker + D1 database,
 * worker/link.mjs); every other shop joins it with a one-time code shown in
 * the main shop, then copies the main shop's catalogue (catalogPackage.js).
 * Each shop keeps selling without internet: the link is only used to copy.
 *
 *   view()                       what the window shows (never a key)
 *   connectMain({ token })       the main shop makes the link (its Cloudflare:
 *                                the website's, or a key pasted here)
 *   newCode({ shopName })        the latest catalogue sent, then a code for a new shop
 *   pushCatalog()                the latest catalogue sent (main shop)
 *   listShops() / removeShop(id) the shops linked (main shop)
 *   join({ code, shopName })     this shop joins (code "<link>-1234-5678"), then
 *                                the catalogue is copied
 *   pullCatalog()                new articles of the main shop copied (joined shop)
 *   leave()                      the link forgotten on this computer
 *
 * Saved in settings (shops_link): role none / main / branch, names, the last
 * copy. Kept by secureStore only: the owner key, the Cloudflare key, a joined
 * shop's own key.
 *
 * deps: { api, getSetting, saveSetting, store, cloudflare: { client, websiteAccess() },
 *         fetch, workerSource, schemaSql, codedError, blockedMode, shopName, now, employee }
 */
const crypto = require('crypto');
const { exportCatalog, importCatalog, checkPackage } = require('./catalogPackage');
const { TOKEN_FORMAT } = require('../website/cloudflare');

const SETTING = 'shops_link';
const MAIN_ITEM = 'shops-main';
const BRANCH_ITEM = 'shops-branch';
const WORKER = 'afus-shops';
const DATABASE = 'afus-shops';
const CODE = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)-(\d{4})-?(\d{4})$/i;
const TIMEOUT_MS = 20000;
const HEALTH_TRIES = 6;

const EMPTY = { role: 'none', groupName: '', shopName: '', mainName: '', linkedAt: null, shops: [], lastCopy: null, lastPush: null };

function createShopsService({
    api, getSetting, saveSetting, store, cloudflare = {}, fetch: fetchImpl, workerSource, schemaSql,
    codedError, blockedMode = () => null, shopName = () => '', now = () => new Date(), employee = () => null,
    sleep = (ms) => new Promise(r => setTimeout(r, ms)), healthWaitMs = 2000,
}) {
    const doFetch = fetchImpl || ((url, init) => require('electron').net.fetch(url, init));
    const fail = (reason) => { throw Object.assign(codedError('SHOPS_LINK_FAILED', { reason }), { reason }); };

    const read = () => ({ ...EMPTY, ...(getSetting(SETTING) || {}) });
    const write = (next) => saveSetting(SETTING, next);
    const secret = (item) => { try { return JSON.parse(store.get(item) || 'null'); } catch { return null; } };
    const keep = (item, value) => {
        if (!store.available()) fail('secure_storage');
        store.set(item, JSON.stringify(value));
    };
    const notBlocked = () => { if (blockedMode()) throw codedError('SHOPS_LINK_BLOCKED'); };

    function view() {
        const s = read();
        return { ...s, websiteCloudflare: !!cloudflare.websiteLinked?.() };
    }

    async function call(url, { method = 'GET', key, shopId, json, text } = {}) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        const headers = { Accept: 'application/json', 'User-Agent': 'AfusBoutique' };
        if (key) headers.Authorization = `Bearer ${key}`;
        if (shopId) headers['X-Afus-Shop'] = shopId;
        let body;
        if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
        if (text !== undefined) { headers['Content-Type'] = 'application/json'; body = text; }
        let res;
        try {
            res = await doFetch(url, { method, headers, body, signal: controller.signal, redirect: 'error' });
        } catch {
            fail('network');
        } finally {
            clearTimeout(timer);
        }
        const raw = await res.text().catch(() => '');
        let data = null;
        try { data = JSON.parse(raw); } catch { data = null; }
        return { status: res.status, ok: res.ok, data: data && typeof data === 'object' ? data : {}, raw, headers: res.headers };
    }
    const reasonOf = (r) => (r.status === 401 ? 'unauthorized' : r.status === 429 ? (r.data.error || 'too_many') : r.status === 403 ? (r.data.error || 'refused') : r.status >= 500 ? 'network' : (r.data.error || 'unknown'));

    /** The Cloudflare key and account of the main shop: pasted here, or the website's. */
    async function cloudflareOf(token) {
        const client = cloudflare.client;
        if (token) {
            const t = String(token).trim();
            if (!TOKEN_FORMAT.test(t)) fail('token_format');
            let accounts;
            try { accounts = await client.listAccounts(t); } catch (e) { fail(e.reason === 'revoked' ? 'token_refused' : e.reason || 'unknown'); }
            if (!accounts.length) fail('no_account');
            return { token: t, accountId: accounts[0].id, source: 'token' };
        }
        const w = await cloudflare.websiteAccess?.().catch(() => null);
        if (!w?.token) fail('cloudflare_needed');
        return { token: w.token, accountId: w.accountId, source: 'website' };
    }

    /** The main shop's link: Worker + D1 on the owner's account (safe to run again). */
    async function connectMain({ token, groupName } = {}) {
        notBlocked();
        const s = read();
        if (s.role === 'branch') fail('is_branch');
        const client = cloudflare.client;
        const cf = await cloudflareOf(token);
        const access = await client.checkAccess(cf.token, cf.accountId).catch((e) => fail(e.reason || 'network'));
        if (!access.workers || !access.d1) fail('scope');
        let subdomain = await client.getWorkersSubdomain(cf.token, cf.accountId).catch((e) => fail(e.reason || 'network'));
        if (!subdomain) {
            const base = String(shopName() || 'afus').normalize('NFKD').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 20) || 'afus';
            for (let i = 0; i < 3 && !subdomain; i++) {
                subdomain = await client.createWorkersSubdomain(cf.token, cf.accountId, `${base}-${crypto.randomInt(1000, 9999)}`).catch((e) => fail(e.reason || 'network'));
            }
            if (!subdomain) fail('no_subdomain');
        }
        let db = await client.findDatabase(cf.token, cf.accountId, DATABASE).catch((e) => fail(e.reason || 'network'));
        if (!db) {
            db = await client.createDatabase(cf.token, cf.accountId, DATABASE).catch((e) => fail(e.reason || 'network'));
            if (db.exists) db = await client.findDatabase(cf.token, cf.accountId, DATABASE);
        }
        if (!db?.id) fail('database');
        await client.queryDatabase(cf.token, cf.accountId, db.id, schemaSql).catch((e) => fail(e.reason || 'network'));
        const old = secret(MAIN_ITEM);
        const ownerKey = old?.ownerKey && old.accountId === cf.accountId ? old.ownerKey : crypto.randomBytes(32).toString('hex');
        const group = String(groupName || s.groupName || shopName() || '').trim().slice(0, 80);
        await client.uploadWorker(cf.token, cf.accountId, WORKER, {
            module: workerSource, moduleName: 'link.mjs',
            bindings: [
                { type: 'd1', name: 'DB', id: db.id },
                { type: 'secret_text', name: 'OWNER_KEY', text: ownerKey },
                { type: 'plain_text', name: 'GROUP_NAME', text: group },
            ],
        }).catch((e) => fail(e.reason || 'network'));
        await client.enableWorkersDev(cf.token, cf.accountId, WORKER).catch((e) => fail(e.reason || 'network'));
        const url = client.workerUrl(WORKER, subdomain);
        keep(MAIN_ITEM, { ownerKey, accountId: cf.accountId, subdomain, url, source: cf.source, token: cf.source === 'token' ? cf.token : null });
        // workers.dev answers a few seconds after the first upload
        let up = false;
        for (let i = 0; i < HEALTH_TRIES && !up; i++) {
            const r = await call(`${url}/health`).catch(() => null);
            up = !!r?.ok && r.data.app === 'afus-shops';
            if (!up) await sleep(healthWaitMs);
        }
        if (!up) fail('not_answering');
        write({ ...s, role: 'main', groupName: group, shopName: shopName() || '', linkedAt: s.linkedAt || now().toISOString() });
        return view();
    }

    function mainKeys() {
        const k = secret(MAIN_ITEM);
        if (read().role !== 'main' || !k?.ownerKey) fail('not_main');
        return k;
    }

    async function pushCatalog() {
        notBlocked();
        const k = mainKeys();
        const pkg = exportCatalog(api, getSetting, now);
        const r = await call(`${k.url}/owner/catalog`, { method: 'PUT', key: k.ownerKey, text: JSON.stringify(pkg) });
        if (!r.ok) fail(reasonOf(r));
        const s = read();
        write({ ...s, lastPush: { at: now().toISOString(), products: pkg.products.length } });
        return view();
    }

    async function newCode({ shopName: name } = {}) {
        notBlocked();
        const k = mainKeys();
        const shop = String(name || '').trim().slice(0, 80);
        if (!shop) fail('name_required');
        await pushCatalog();
        const r = await call(`${k.url}/owner/codes`, { method: 'POST', key: k.ownerKey, json: { shopName: shop } });
        if (!r.ok || !/^\d{8}$/.test(String(r.data.code || ''))) fail(reasonOf(r));
        const c = r.data.code;
        return { code: `${k.subdomain}-${c.slice(0, 4)}-${c.slice(4)}`, expiresAt: r.data.expiresAt, shopName: shop };
    }

    async function listShops() {
        const k = mainKeys();
        const r = await call(`${k.url}/owner/shops`, { key: k.ownerKey });
        if (!r.ok || !Array.isArray(r.data.shops)) fail(reasonOf(r));
        const shops = r.data.shops.map(x => ({ id: String(x.id), name: String(x.name || ''), joinedAt: x.joinedAt || null, lastSeen: x.lastSeen || null }));
        write({ ...read(), shops });
        return view();
    }

    async function removeShop(id) {
        notBlocked();
        const k = mainKeys();
        if (!/^[a-f0-9]{32}$/.test(String(id || ''))) fail('unknown');
        const r = await call(`${k.url}/owner/shops/${id}`, { method: 'DELETE', key: k.ownerKey });
        if (!r.ok) fail(reasonOf(r));
        return listShops();
    }

    /** The main shop's catalogue -> this shop (adds what is missing only). */
    async function copyFrom(keys) {
        const r = await call(`${keys.url}/catalog`, { key: keys.token, shopId: keys.shopId });
        if (r.status === 404) fail('no_catalog');
        if (!r.ok) fail(reasonOf(r));
        let pkg;
        try { pkg = checkPackage(JSON.parse(r.raw)); } catch { fail('bad_package'); }
        const counts = importCatalog(api, pkg, { getSetting, saveSetting, employeeId: employee() });
        const s = read();
        write({ ...s, lastCopy: { at: now().toISOString(), catalogAt: pkg.at || null, counts } });
        return counts;
    }

    async function join({ code, shopName: name } = {}) {
        notBlocked();
        const s = read();
        if (s.role === 'main') fail('is_main');
        const m = CODE.exec(String(code || '').trim().replace(/\s+/g, ''));
        if (!m) fail('code_format');
        const url = cloudflare.client.workerUrl(WORKER, m[1].toLowerCase());
        const shop = String(name || shopName() || '').trim().slice(0, 80);
        const r = await call(`${url}/join`, { method: 'POST', json: { code: `${m[2]}${m[3]}`, shopName: shop } });
        if (!r.ok || !/^[a-f0-9]{32}$/.test(String(r.data.shopId || '')) || !r.data.token) fail(r.ok ? 'unknown' : reasonOf(r));
        const keys = { url, shopId: r.data.shopId, token: String(r.data.token) };
        keep(BRANCH_ITEM, keys);
        write({ ...s, role: 'branch', shopName: r.data.shopName || shop, mainName: String(r.data.groupName || ''), linkedAt: now().toISOString() });
        const counts = await copyFrom(keys);
        return { ...view(), counts };
    }

    async function pullCatalog() {
        notBlocked();
        const keys = secret(BRANCH_ITEM);
        if (read().role !== 'branch' || !keys?.token) fail('not_branch');
        const counts = await copyFrom(keys);
        return { ...view(), counts };
    }

    function leave() {
        notBlocked();
        store.remove(MAIN_ITEM);
        store.remove(BRANCH_ITEM);
        write({ ...EMPTY });
        return view();
    }

    return { view, connectMain, newCode, pushCatalog, listShops, removeShop, join, pullCatalog, leave };
}

module.exports = { createShopsService, CODE, WORKER, DATABASE, SETTING };
