// Shops link, phase 1, the whole way: the main shop makes the link on the
// owner's Cloudflare (the real Worker run on a sql.js D1), gives a code, the
// second shop joins with it and gets the catalogue.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createShop } from './helpers/shop';
import { createLegacyDb, createApi } from './helpers/testDb';

const require = createRequire(import.meta.url);
const { startFakeCloud } = require('./helpers/fakeCloud.cjs');
const { createShopsService } = require('../electron/shops/shopsService');
const { createCloudflareClient } = require('../electron/website/cloudflare');
const { createSecureStore } = require('../electron/website/secureStore');
const { applyMigrations } = require('../electron/database/migrations');
const catalog = require('../electron/services/catalogService');
const initSqlJs = require('sql.js');

const ACCOUNT = 'c'.repeat(32);
const WORKER = fs.readFileSync(path.resolve(__dirname, '../electron/shops/worker/link.mjs'), 'utf8');
const SCHEMA = fs.readFileSync(path.resolve(__dirname, '../electron/shops/worker/schema.sql'), 'utf8');
const fakeSafeStorage = () => ({
    isEncryptionAvailable: () => true, getSelectedStorageBackend: () => 'gnome_libsecret',
    encryptString: (t) => Buffer.from(`enc:${Buffer.from(t).toString('base64')}`),
    decryptString: (b) => Buffer.from(b.toString().slice(4), 'base64').toString(),
});
const reasonOf = async (fn) => { try { await fn(); } catch (e) { return e.reason || e.code; } return null; };
let SQL;

describe('shops link: main shop, code, second shop', () => {
    let cloud, dirs, client;

    function serviceFor(api, name, extra = {}) {
        const settings = {};
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afus-shops-'));
        dirs.push(dir);
        const store = createSecureStore({ dir, safeStorage: fakeSafeStorage(), platform: 'linux' });
        const service = createShopsService({
            api, getSetting: (k) => settings[k] ?? null, saveSetting: (k, v) => { settings[k] = JSON.parse(JSON.stringify(v)); },
            store, cloudflare: { client, websiteAccess: async () => null }, fetch: globalThis.fetch,
            workerSource: WORKER, schemaSql: SCHEMA, codedError: catalog.codedError, shopName: () => name,
            sleep: async () => {}, ...extra,
        });
        return { service, settings, store, dir };
    }
    async function emptyShopApi() {
        const db = await createLegacyDb();
        applyMigrations(db);
        return createApi(db);
    }

    beforeEach(async () => {
        SQL = SQL || await initSqlJs();
        dirs = [];
        cloud = await startFakeCloud({ accounts: [{ id: ACCOUNT, name: 'Owner' }], subdomain: 'yasmine', d1Factory: async () => new SQL.Database() });
        client = createCloudflareClient({ clientId: '', fetch: globalThis.fetch, dashBase: cloud.base, apiBase: `${cloud.base}/client/v4`, workerUrl: (n) => `${cloud.base}/w/${n}` });
    });
    afterEach(async () => { await cloud.close(); dirs.forEach(d => fs.rmSync(d, { recursive: true, force: true })); });

    it('links two shops with a one-time code and copies the catalogue (stock 0)', async () => {
        const { api: mainApi } = await createShop();
        const main = serviceFor(mainApi, 'Boutique Yasmine');
        // Without a Cloudflare key nothing is made
        expect(await reasonOf(() => main.service.connectMain({}))).toBe('cloudflare_needed');
        const view = await main.service.connectMain({ token: cloud.cloudflareApiToken() });
        expect(view.role).toBe('main');
        expect(JSON.stringify(main.settings)).not.toMatch(/[a-f0-9]{64}/); // no key in settings

        const { code, expiresAt } = await main.service.newCode({ shopName: 'Boutique Bab Ezzouar' });
        expect(code).toMatch(/^yasmine-\d{4}-\d{4}$/);
        expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());

        const branchApi = await emptyShopApi();
        const branch = serviceFor(branchApi, '');
        const joined = await branch.service.join({ code, shopName: 'Boutique Bab Ezzouar' });
        expect(joined.role).toBe('branch');
        expect(joined.mainName).toBe('Boutique Yasmine');
        expect(joined.counts).toMatchObject({ products: 2, variants: 5 });
        expect(catalog.lookupCode(branchApi, 'J-N-40').variant.stock_quantity).toBe(0);

        // The code was for one shop only
        const again = serviceFor(await emptyShopApi(), '');
        expect(await reasonOf(() => again.service.join({ code, shopName: 'X' }))).toBe('bad_code');

        // The main shop sees its shops
        const listed = await main.service.listShops();
        expect(listed.shops.map(s => s.name)).toEqual(['Boutique Bab Ezzouar']);

        // A new article in the main shop reaches the second shop on "update"
        catalog.saveProduct(mainApi, { id: 'robe', name: 'Robe', price: 4500 }, [{ color: 'Rouge', size: 'M', sku: 'R-R-M' }], { isNew: true });
        await main.service.pushCatalog();
        const pulled = await branch.service.pullCatalog();
        expect(pulled.counts).toMatchObject({ products: 1, variants: 1, skipped: 2 });

        // Unlinked by the main shop: its key is refused
        await main.service.removeShop(listed.shops[0].id);
        expect(await reasonOf(() => branch.service.pullCatalog())).toBe('unauthorized');
    });

    it('refuses wrong codes, and stops answering after too many', async () => {
        const main = serviceFor((await createShop()).api, 'Boutique Yasmine');
        await main.service.connectMain({ token: cloud.cloudflareApiToken() });
        const branch = serviceFor(await emptyShopApi(), '');
        expect(await reasonOf(() => branch.service.join({ code: 'not a code' }))).toBe('code_format');
        for (let i = 0; i < 10; i++) expect(await reasonOf(() => branch.service.join({ code: `yasmine-0000-000${i}`, shopName: 'X' }))).toBe('bad_code');
        // Even the right code waits now
        const { code } = await main.service.newCode({ shopName: 'B' });
        expect(await reasonOf(() => branch.service.join({ code, shopName: 'B' }))).toBe('too_many_tries');
        expect(branch.service.view().role).toBe('none');
    });

    it('the owner endpoints need the owner key; a main shop cannot join another', async () => {
        const main = serviceFor((await createShop()).api, 'Boutique Yasmine');
        await main.service.connectMain({ token: cloud.cloudflareApiToken() });
        const url = `${cloud.base}/w/afus-shops`;
        for (const [method, p] of [['POST', '/owner/codes'], ['GET', '/owner/shops'], ['PUT', '/owner/catalog'], ['GET', '/catalog']]) {
            const r = await fetch(`${url}${p}`, { method, headers: { Authorization: 'Bearer nope', 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : '{}' });
            expect(r.status).toBe(401);
        }
        expect((await (await fetch(`${url}/health`)).json()).app).toBe('afus-shops');
        expect(await reasonOf(() => main.service.join({ code: 'yasmine-1234-5678' }))).toBe('is_main');
    });

    it('in the demo nothing is linked', async () => {
        const main = serviceFor((await createShop()).api, 'Boutique', { blockedMode: () => 'demo' });
        expect(await reasonOf(() => main.service.connectMain({ token: cloud.cloudflareApiToken() }))).toBe('SHOPS_LINK_BLOCKED');
    });
});
