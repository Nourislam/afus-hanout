import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// A shop installs the new version over an older one: its database must open,
// end up with the same tables, columns and indexes as a new shop, keep every
// row, and pass the figures check. tests/fixtures/upgrade holds a small
// database made by each older version itself (an article with two sizes, a
// customer with kridi allowed, a sale paid in cash, its stock movement).
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'afus-upgrade-'));
let dataDir = path.join(root, 'new-shop');
const electronPath = require.resolve('electron');
require.cache[electronPath] = { id: electronPath, filename: electronPath, loaded: true, exports: { app: { getPath: () => dataDir } } };
const init = require('../electron/database/init');
const api = require('../electron/database/api');
const integrity = require('../electron/services/integrityService');
const { databasePath } = require('../electron/brand');
const initSqlJs = require('sql.js');

const FIXTURES = path.join(path.dirname(new URL(import.meta.url).pathname), 'fixtures', 'upgrade');
const VERSIONS = fs.readdirSync(FIXTURES).filter(f => f.endsWith('.db.gz')).map(f => f.replace('.db.gz', '')).sort();

/** Tables with their columns (type, NOT NULL, default, key) and the indexes. */
function structure() {
    const tables = api.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map(r => r.name);
    const columns = Object.fromEntries(tables.map(t => [t, api.all(`PRAGMA table_info(${t})`)
        .map(c => `${c.name} ${c.type}${c.notnull ? ' NOT NULL' : ''}${c.dflt_value !== null ? ` DEFAULT ${c.dflt_value}` : ''}${c.pk ? ' PK' : ''}`)
        .sort()]));
    const indexes = api.all("SELECT tbl_name || '.' || name AS name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name").map(r => r.name);
    return { columns, indexes };
}

describe('a shop that installs the new version over an older one', () => {
    let fresh;
    let SQL;
    beforeAll(async () => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        SQL = await initSqlJs();
        fs.mkdirSync(dataDir, { recursive: true });
        await init.initDatabase();
        fresh = structure();
        init.closeDatabase();
    });
    afterAll(() => {
        init.closeDatabase();
        vi.restoreAllMocks();
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('has a database from each older version to try', () => {
        expect(VERSIONS.length).toBeGreaterThanOrEqual(4);
    });

    it.each(VERSIONS)('from %s: same structure as a new shop, every row kept, figures right', async (version) => {
        dataDir = path.join(root, version);
        fs.mkdirSync(dataDir, { recursive: true });
        const file = zlib.gunzipSync(fs.readFileSync(path.join(FIXTURES, `${version}.db.gz`)));
        fs.writeFileSync(databasePath(dataDir), file);

        // The rows before, read straight from the old file
        const old = new SQL.Database(file);
        const before = Object.fromEntries(old.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")[0].values
            .map(([t]) => [t, old.exec(`SELECT COUNT(*) FROM ${t}`)[0].values[0][0]]));
        const oldBrands = before.brands ? old.exec('SELECT name FROM brands')[0]?.values.map(([n]) => String(n)) || [] : [];
        old.close();
        expect(before.sales, 'the old shop has a sale').toBeGreaterThan(0);

        try {
            await init.initDatabase();
            expect(api.get('PRAGMA integrity_check').integrity_check).toBe('ok');
            expect(api.all('PRAGMA foreign_key_check')).toEqual([]);
            expect(init.foreignKeysEnabled()).toBe(true);

            const now = structure();
            expect(now.columns).toEqual(fresh.columns);
            expect(now.indexes).toEqual(fresh.indexes);

            // Afus Hanout has no online store: those tables are removed on purpose
            // (migration 2026_11_hanout_no_online_store); every other table keeps its rows
            const REMOVED = /^ecommerce_/;
            expect(api.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'ecommerce_%'")).toEqual([]);
            const lost = Object.entries(before).filter(([t, n]) => !REMOVED.test(t) && t !== 'brands' && api.get(`SELECT COUNT(*) AS n FROM ${t}`).n < n);
            expect(lost).toEqual([]);
            // Brands: only the clothing brands of the old seed that no article names are removed
            // (migration 2026_11_hanout_no_clothing_brands); every other brand is kept
            const seed = new Set(require('../electron/shared/clothing.json').brands.map(b => b.toLowerCase()));
            const named = new Set(api.all("SELECT DISTINCT LOWER(TRIM(brand)) AS b FROM products WHERE brand IS NOT NULL").map(r => r.b));
            const brandsNow = new Set(api.all('SELECT name FROM brands').map(r => r.name.toLowerCase()));
            expect(oldBrands.filter(b => (!seed.has(b.toLowerCase()) || named.has(b.toLowerCase())) && !brandsNow.has(b.toLowerCase()))).toEqual([]);

            expect(integrity.check(api).checks.filter(c => !c.ok)).toEqual([]);
        } finally {
            init.closeDatabase();
        }
    }, 60000);
});
