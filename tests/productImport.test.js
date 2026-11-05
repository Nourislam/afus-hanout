import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import { createShop, reopen } from './helpers/shop';

const require = createRequire(import.meta.url);
const importer = require('../electron/services/productImportService');
const excel = require('../electron/services/excelService');

const run = (api, rows) => api.transaction(() => importer.importProducts(api, rows));
const row = (n, fields) => ({ row: n, ...fields });

describe('Excel quick start', () => {
    let shop, api;
    beforeEach(async () => {
        shop = await createShop();
        api = shop.api;
        api.run("INSERT INTO categories (id, name) VALUES ('epicerie', 'Épicerie')");
    });

    it('the template: one row per article, sold by the piece or by weight, and reads back as valid', () => {
        // Real round trip: the template file is read again like a shop's file
        const parsed = excel.parseBuffer(excel.generateTemplate('products'));
        expect(parsed.success).toBe(true);
        const sheet = parsed.sheets[parsed.sheetNames[0]];
        expect(sheet.headers.slice(0, 4)).toEqual(['name', 'price', 'unit', 'stock_quantity']);
        expect(sheet.headers).not.toContain('color');
        expect(sheet.headers).not.toContain('size');
        const { mappings, missingRequired } = excel.detectColumnMappings(sheet.headers, 'products');
        expect(missingRequired).toEqual([]);
        const result = excel.validateAndTransform(sheet.rows, mappings, 'products');
        expect(result.errors).toEqual([]);
        expect(result.valid.map(r => [r.name, r.unit ?? '', r.stock_quantity, r.__row])).toEqual([
            ['Semoule 1 kg', '', 24, 2], ['Huile 5 L', '', 6, 3], ['Tomates', 'kg', 12.5, 4],
        ]);
        // ...and imports as 3 articles, the tomatoes in grams
        const report = run(api, result.valid.map(({ __row, ...r }) => ({ ...r, row: __row })));
        expect(report.rejected).toEqual([]);
        expect(report.imported).toEqual([{ name: 'Semoule 1 kg', pieces: 24 }, { name: 'Huile 5 L', pieces: 6 }, { name: 'Tomates', grams: 12500 }]);
        // French / Arabic column names are understood
        expect(excel.detectColumnMappings(['Désignation', 'Prix', 'يُباع بـ', 'Quantité'], 'products').mappings)
            .toEqual({ name: 0, price: 1, unit: 2, stock_quantity: 3 });
    });

    it('an article sold by weight: «kg» in the sold-by column, stock in kg kept in grams, price per kg', () => {
        const report = run(api, [
            row(2, { name: 'Bananes', unit: 'كغ', stock_quantity: '7,5', price: 350, cost: 260 }),
            row(3, { name: 'Pommes de terre', unit: 'Poids', stock_quantity: 40, price: 90 }),
            row(4, { name: 'Lait 1 L', unit: 'قطعة', stock_quantity: 30, price: 25, cost: 22, sku: 'LAIT-1', barcode: '6130000000014', category: 'épicerie' }),
        ]);
        expect(report.rejected).toEqual([]);
        expect(api.get("SELECT unit, stock_quantity, price FROM products WHERE name = 'Bananes'")).toEqual({ unit: 'kg', stock_quantity: 7500, price: 350 });
        expect(api.get("SELECT unit, stock_quantity FROM products WHERE name = 'Pommes de terre'")).toEqual({ unit: 'kg', stock_quantity: 40000 });
        expect(api.get("SELECT unit, stock_quantity, sku, barcode, category_id, has_variants FROM products WHERE name = 'Lait 1 L'"))
            .toEqual({ unit: 'piece', stock_quantity: 30, sku: 'LAIT-1', barcode: '6130000000014', category_id: 'epicerie', has_variants: 0 });
        // Stock movements are logged as initial stock
        expect(api.get("SELECT COUNT(*) AS n FROM inventory_logs WHERE type = 'initial'").n).toBeGreaterThanOrEqual(3);
    });

    it('the minimum of an article sold by weight is in kg too (kept in grams)', () => {
        run(api, [
            row(2, { name: 'Tomates', unit: 'kg', stock_quantity: 12.5, price: 120, min_stock_level: 5 }),
            row(3, { name: 'Oignons', unit: 'kg', stock_quantity: 3, price: 70 }),
            row(4, { name: 'Levure', stock_quantity: 3, price: 20 }),
        ]);
        expect(api.get("SELECT min_stock_level FROM products WHERE name = 'Tomates'").min_stock_level).toBe(5000);
        expect(api.get("SELECT min_stock_level FROM products WHERE name = 'Oignons'").min_stock_level).toBe(2000);
        expect(api.get("SELECT min_stock_level FROM products WHERE name = 'Levure'").min_stock_level).toBe(2);
    });

    it('prices written the French way: 7,50 is 7.50 DA, 1 250,00 is 1250 DA, 1,200 is 1200 DA', () => {
        const mappings = { name: 0, price: 1, cost: 2 };
        const result = excel.validateAndTransform([['Pain', '7,50', '6,25'], ['Huile', '1 250,00', '1 100'], ['Riz', '1,200', '950']], mappings, 'products');
        expect(result.valid.map(r => [r.name, r.price, r.cost])).toEqual([['Pain', 7.5, 6.25], ['Huile', 1250, 1100], ['Riz', 1200, 950]]);
    });

    it('a bad article is rejected with its rows and the reason, the others are imported', async () => {
        api.run("INSERT INTO products (id, name, price, sku) VALUES ('sucre', 'Sucre 1 kg', 130, 'SUC-1')");
        const report = run(api, [
            row(2, { name: 'Sucre 1 kg', stock_quantity: 1, price: 130 }), // already in the shop
            row(3, { name: 'Café 250 g', stock_quantity: 2, price: 400 }),
            row(4, { name: 'café 250 g ', stock_quantity: 1, price: 400 }), // same article twice
            row(5, { name: 'Thé', stock_quantity: 1.5, price: 300 }), // half a box
            row(6, { name: 'Pâtes', stock_quantity: 4, price: -1 }),
            row(7, { name: 'Biscuits', stock_quantity: 5, price: 60, sku: 'SUC-1' }), // code of another article
            row(8, { name: 'Oignons', unit: 'carton de 12', stock_quantity: 3, price: 80 }), // not a way of selling
            row(9, { name: 'Levure', stock_quantity: 3, price: 20 }),
        ]);
        expect(report.imported.map(x => x.name)).toEqual(['Levure']);
        const reasons = Object.fromEntries(report.rejected.map(r => [r.name, [r.rows, r.reason.split('|')[0]]]));
        expect(reasons).toEqual({
            'Sucre 1 kg': [[2], 'IMPORT_EXISTS'],
            'Café 250 g': [[3, 4], 'IMPORT_DUPLICATE'],
            Thé: [[5], 'IMPORT_QUANTITY'],
            Pâtes: [[6], 'IMPORT_NO_PRICE'],
            Biscuits: [[7], 'ID_TAKEN'],
            Oignons: [[8], 'IMPORT_UNIT'],
        });
        // Nothing half-saved of the rejected articles
        for (const name of ['Café 250 g', 'Biscuits', 'Oignons']) expect(api.get('SELECT id FROM products WHERE name = ?', [name])).toBeNull();
        const again = await reopen(shop.db);
        expect(again.api.get("SELECT stock_quantity FROM products WHERE name = 'Levure'").stock_quantity).toBe(3);
    });
});
