// Selling a grocery shop's articles through the program's own handlers:
// by weight, by the carton, at a capped price, and returning a weighed line.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
type Handler = (event: null, arg: unknown) => unknown;
const h: Record<string, Handler> = {};
const call = (name: string, arg: unknown) => h[name](null, arg);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let api: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let catalog: any;

beforeAll(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afus-grocery-'));
    const ep = require.resolve('electron');
    require.cache[ep] = { id: ep, filename: ep, loaded: true, exports: { app: { getPath: () => dir, isPackaged: false } } } as never;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const init = require('../electron/database/init');
    await init.initDatabase();
    api = require('../electron/database/api');
    catalog = require('../electron/services/catalogService');
    const session = require('../electron/services/session');
    const creditSales = require('../electron/services/creditSaleService');
    api.run("INSERT INTO employees (id, name, pin, role) VALUES ('boss', 'Patron', '0000', 'admin')");
    session.setEmployee({ id: 'boss', name: 'Patron', role: 'admin' });
    const ctx = new Proxy({
        ipcMain: { handle: (name: string, fn: Handler) => { h[name] = fn; } },
        getOne: init.getOne, runInsert: init.runInsert, runQuery: init.runQuery, runTransaction: init.runTransaction,
        dbApi: api, uuid: () => require('uuid').v4(), session, catalog,
        guard: require('../electron/services/guard'),
        returnService: require('../electron/services/returnService'),
        loyaltyService: require('../electron/services/loyaltyService'),
        salesStatsService: require('../electron/services/salesStatsService'),
        createCreditSale: (c: unknown) => creditSales.createCreditSale(api, c),
        generateInvoiceNumber: () => creditSales.nextInvoiceNumber(api),
        getStoreSettings: () => ({ taxRate: 0, taxType: 'inclusive' }),
        SyncManager: { triggerSync: () => {} },
    }, { get: (t: Record<string, unknown>, k: string) => (k in t ? t[k] : () => {}) });
    require('../electron/ipc/sales')(ctx);

    // Tomatoes by weight: 5 kg in stock (grams), 120 DA/kg, bought 80 DA/kg
    api.run("INSERT INTO products (id, name, price, cost, stock_quantity, unit) VALUES ('tomato', 'Tomates', 120, 80, 5000, 'kg')");
    // Milk: 100 bags, 25 DA each, cartons of 24 sold 570 DA, the carton's own barcode
    api.run("INSERT INTO products (id, name, barcode, price, cost, stock_quantity, carton_qty, carton_price) VALUES ('milk', 'Lait sachet', '6130000000011', 25, 22, 100, 24, 570)");
    api.run("INSERT INTO product_barcodes (barcode, product_id, kind) VALUES ('6130000000028', 'milk', 'carton')");
    // Bread at an official price of 7.50 DA
    api.run("INSERT INTO products (id, name, price, cost, stock_quantity, capped_price) VALUES ('bread', 'Pain', 7.5, 6, 200, 7.5)");
});

interface Line { id: string; product_id: string; product_name: string; quantity: number; unit_price: number; discount: number; total: number; weight_grams?: number; sold_as?: string }
let n = 0;
const sell = (lines: Omit<Line, 'id'>[]) => {
    n += 1;
    const id = `g${n}`;
    const items = lines.map((l, i) => ({ id: `${id}-${i}`, ...l }));
    const total = items.reduce((s, i) => s + i.total, 0);
    return call('db:sales:create', {
        id, receipt_number: `T-${id}`, employee_id: 'boss', subtotal: total, discount_amount: 0, tax_amount: 0, total,
        items, payments: [{ id: `${id}-p`, method: 'cash', amount: total }],
    }) as { id: string };
};
const stock = (id: string): number => api.get('SELECT stock_quantity FROM products WHERE id = ?', [id]).stock_quantity;

describe('selling by weight', () => {
    it('one line of 750 g: priced per kg, stock down by its grams, cost for its weight', () => {
        sell([{ product_id: 'tomato', product_name: 'Tomates', quantity: 1, unit_price: 90, discount: 0, total: 90, weight_grams: 750, sold_as: 'weight' }]);
        expect(stock('tomato')).toBe(4250);
        const line = api.get("SELECT quantity, weight_grams, sold_as, unit_price, unit_cost FROM sale_items WHERE product_id = 'tomato'");
        expect(line).toEqual({ quantity: 1, weight_grams: 750, sold_as: 'weight', unit_price: 90, unit_cost: 60 });
    });

    it('more grams than in stock is refused', () => {
        expect(() => sell([{ product_id: 'tomato', product_name: 'Tomates', quantity: 1, unit_price: 600, discount: 0, total: 600, weight_grams: 5000, sold_as: 'weight' }]))
            .toThrow(/STOCK_INSUFFICIENT/);
        expect(stock('tomato')).toBe(4250);
    });
});

describe('selling by the carton', () => {
    it('the carton barcode is found as one carton of the article', () => {
        const found = catalog.lookupCode(api, '6130000000028');
        expect(found.type).toBe('product');
        expect(found.carton).toBe(true);
        expect(found.product.id).toBe('milk');
        const piece = catalog.lookupCode(api, '6130000000011');
        expect(piece.carton).toBeFalsy();
    });

    it('one carton = 24 bags at the carton price; stock down by 24', () => {
        sell([{ product_id: 'milk', product_name: 'Lait sachet', quantity: 24, unit_price: 25, discount: 30, total: 570, sold_as: 'carton' }]);
        expect(stock('milk')).toBe(76);
        expect(api.get("SELECT sold_as, quantity, total FROM sale_items WHERE product_id = 'milk'")).toEqual({ sold_as: 'carton', quantity: 24, total: 570 });
    });
});

describe('capped price', () => {
    it('bread above its official price is refused; at it, sold', () => {
        expect(() => sell([{ product_id: 'bread', product_name: 'Pain', quantity: 2, unit_price: 8, discount: 0, total: 16 }])).toThrow(/PRICE_ABOVE_CAP/);
        sell([{ product_id: 'bread', product_name: 'Pain', quantity: 2, unit_price: 7.5, discount: 0, total: 15 }]);
        expect(stock('bread')).toBe(198);
    });
});

describe('returning a weighed line', () => {
    it('its grams go back in stock', () => {
        const sale = sell([{ product_id: 'tomato', product_name: 'Tomates', quantity: 1, unit_price: 60, discount: 0, total: 60, weight_grams: 500, sold_as: 'weight' }]);
        expect(stock('tomato')).toBe(3750);
        const lineId = `${sale.id}-0`;
        call('db:returns:create', {
            id: 'ret-1', sale_id: sale.id, return_number: 'RET-1', total_refund: 60, reason: 'abîmées', employee_id: 'boss', refund_method: 'cash',
            items: [{ sale_item_id: lineId, product_id: 'tomato', quantity: 1, refund_amount: 60, condition: 'sellable' }],
        });
        expect(stock('tomato')).toBe(4250);
        expect(api.get("SELECT weight_grams FROM return_items WHERE sale_item_id = ?", [lineId]).weight_grams).toBe(500);
    });
});
