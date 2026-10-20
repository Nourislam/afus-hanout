// Before a count: the stock lines that cannot be scanned (no QR, reference or
// barcode) are listed, and "Create codes" gives each one a reference that the
// scanner and the count then find; lines that have a code are left alone.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
let api; const h = {};

beforeAll(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afus-codes-'));
    const ep = require.resolve('electron');
    require.cache[ep] = { id: ep, filename: ep, loaded: true, exports: { app: { getPath: () => dir, isPackaged: false } } };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await require('../electron/database/init').initDatabase();
    api = require('../electron/database/api');
    api.run("INSERT INTO products (id, name, price, cost, stock_quantity, has_variants) VALUES ('scarf', 'وشاح', 900, 400, 6, 0)");
    api.run("INSERT INTO products (id, name, sku, price, cost, stock_quantity, has_variants) VALUES ('belt', 'Ceinture', 'CEIN-001', 800, 300, 4, 0)");
    api.run("INSERT INTO products (id, name, price, cost, has_variants) VALUES ('robe', 'Robe soirée', 5000, 2500, 1)");
    api.run("INSERT INTO product_variants (id, product_id, color, size, sku, qr_code, stock_quantity) VALUES ('robe-m', 'robe', 'Noir', 'M', '', '', 3)");
    api.run("INSERT INTO product_variants (id, product_id, color, size, sku, qr_code, stock_quantity) VALUES ('robe-l', 'robe', 'Noir', 'L', 'ROB-NR-L-001', 'ROB-NR-L-001', 2)");
    require('../electron/ipc/figures')({ dbApi: api, ipcMain: { handle: (n, f) => { h[n] = f; } }, getSettingValue: () => null, runTransaction: (fn) => fn() });
});

describe('codes for the lines that have none', () => {
    it('lists only the lines without any code', () => {
        const lines = h['stock:withoutCode']();
        expect(lines.map(l => [l.product_id, l.variant_id]).sort()).toEqual([['robe', 'robe-m'], ['scarf', null]]);
        expect(lines.find(l => l.product_id === 'scarf')).toMatchObject({ name: 'وشاح', quantity: 6 });
    });

    it('makes a reference for each, the scanner finds it, the others keep theirs', () => {
        const made = h['stock:createCodes']();
        expect(made.length).toBe(2);
        const catalog = require('../electron/services/catalogService');
        for (const m of made) {
            expect(m.sku).toMatch(/^[A-Z0-9-]+$/);
            const found = catalog.lookupCode(api, m.sku);
            expect(found?.product?.id, m.sku).toBe(m.product_id);
            if (m.variant_id) expect(found.variant.id).toBe(m.variant_id);
        }
        // The size gets its QR too
        expect(api.get("SELECT qr_code FROM product_variants WHERE id = 'robe-m'").qr_code).toBe(made.find(m => m.variant_id).sku);
        expect(api.get("SELECT sku FROM products WHERE id = 'belt'").sku).toBe('CEIN-001');
        expect(api.get("SELECT sku FROM product_variants WHERE id = 'robe-l'").sku).toBe('ROB-NR-L-001');
        expect(h['stock:withoutCode']()).toEqual([]);
        // Pressed again: nothing to do
        expect(h['stock:createCodes']()).toEqual([]);
    });

    it('the count can now read these lines from the shop\'s stock file', () => {
        const stock = require('../electron/services/stockService');
        expect(stock.stockLines(api).every(l => l.qr || l.sku || l.barcode)).toBe(true);
        const guard = require('../electron/services/ipcGuard');
        expect(guard.RULES['stock:createCodes']).toBe('products.edit');
    });
});
