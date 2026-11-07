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

describe('the main process checks the units, not the window', () => {
    it('an article sold by weight without its weight is refused (it would move grams as pieces)', () => {
        const before = stock('tomato');
        expect(() => sell([{ product_id: 'tomato', product_name: 'Tomates', quantity: 2, unit_price: 120, discount: 0, total: 240 }]))
            .toThrow(/WEIGHT_REQUIRED/);
        expect(stock('tomato')).toBe(before);
    });

    it('a weight sent with an article sold by the piece is ignored: its pieces leave the stock', () => {
        api.run("INSERT INTO products (id, name, price, cost, stock_quantity) VALUES ('salt', 'Sel', 30, 20, 10)");
        const sale = sell([{ product_id: 'salt', product_name: 'Sel', quantity: 2, unit_price: 30, discount: 0, total: 60, weight_grams: 900, sold_as: 'weight' }]);
        expect(stock('salt')).toBe(8);
        expect(api.get('SELECT weight_grams, sold_as FROM sale_items WHERE sale_id = ?', [sale.id])).toEqual({ weight_grams: null, sold_as: null });
    });
});

describe('Baridi Pay', () => {
    const pay = (method: string, amount: number) => {
        n += 1;
        const id = `bp${n}`;
        return call('db:sales:create', {
            id, receipt_number: `T-${id}`, employee_id: 'boss', subtotal: amount, discount_amount: 0, tax_amount: 0, total: amount,
            items: [{ id: `${id}-0`, product_id: 'water', product_name: 'Eau', quantity: amount / 15, unit_price: 15, discount: 0, total: amount }],
            payments: [{ id: `${id}-p`, method, amount }],
        });
    };

    it('refuses less than 100 DA (Algérie Poste\'s minimum); 100 DA or more is paid', () => {
        api.run("INSERT INTO products (id, name, price, cost, stock_quantity) VALUES ('water', 'Eau', 15, 10, 100)");
        expect(() => pay('transfer', 75)).toThrow(/BARIDI_MIN/);
        expect(pay('transfer', 105)).toBeTruthy();
        expect(pay('cash', 15)).toBeTruthy();
    });
});

describe('change under 5 DA kept for the customer', () => {
    const ticket = (id: string, total: number, payments: unknown[], extra: Record<string, unknown> = {}) => call('db:sales:create', {
        id, receipt_number: `T-${id}`, employee_id: 'boss', customer_id: 'c-change', subtotal: total, discount_amount: 0, tax_amount: 0, total,
        items: [{ id: `${id}-0`, product_id: 'rice', product_name: 'Riz', quantity: total / 97 * 1, unit_price: 97, discount: 0, total }],
        payments, ...extra,
    });
    const balance = () => require('../electron/services/changeBalanceService').balance(api, 'c-change');

    it('97 DA paid with 100: «سجّله للزبون» keeps 3 DA for him; his next ticket uses them', () => {
        api.run("INSERT INTO customers (id, name) VALUES ('c-change', 'Karim')");
        api.run("INSERT INTO products (id, name, price, cost, stock_quantity) VALUES ('rice', 'Riz', 97, 80, 100)");
        ticket('ch1', 97, [{ id: 'ch1-p', method: 'cash', amount: 97, reference: JSON.stringify({ tendered: 100 }) }], { change_kept: 3 });
        expect(balance()).toBe(3);
        ticket('ch2', 97, [{ id: 'ch2-a', method: 'change_balance', amount: 3 }, { id: 'ch2-b', method: 'cash', amount: 94 }]);
        expect(balance()).toBe(0);
    });

    it('refused: 5 DA or more, more than the change given, no customer, or more than his balance', () => {
        const cash = (id: string, tendered: number) => [{ id: `${id}-p`, method: 'cash', amount: 97, reference: JSON.stringify({ tendered }) }];
        expect(() => ticket('ch3', 97, cash('ch3', 102), { change_kept: 5 })).toThrow(/CHANGE_KEEP/);
        expect(() => ticket('ch4', 97, cash('ch4', 99), { change_kept: 3 })).toThrow(/CHANGE_KEEP/);
        expect(() => ticket('ch5', 97, cash('ch5', 100), { change_kept: 3, customer_id: null })).toThrow(/CHANGE_KEEP/);
        expect(() => ticket('ch6', 97, [{ id: 'ch6-a', method: 'change_balance', amount: 1 }, { id: 'ch6-b', method: 'cash', amount: 96 }])).toThrow(/CHANGE_BALANCE_LOW/);
        expect(balance()).toBe(0);
    });

    it('the drawer counts the change kept: it stayed in the drawer', () => {
        const ShiftService = require('../electron/services/shiftService');
        api.run("INSERT INTO shifts (id, employee_id, start_time, opening_cash) VALUES ('sh-change', 'boss', '2000-01-01T00:00:00.000Z', 0)");
        const before = new ShiftService().getShiftStats('sh-change').expected_cash;
        ticket('ch7', 97, [{ id: 'ch7-p', method: 'cash', amount: 97, reference: JSON.stringify({ tendered: 100 }) }], { change_kept: 3 });
        expect(new ShiftService().getShiftStats('sh-change').expected_cash).toBe(before + 100);
    });
});

describe('a service (flexy)', () => {
    it('sold at the amount typed: no stock needed or moved, its cost is the amount less the margin', () => {
        api.run("INSERT INTO products (id, name, price, cost, stock_quantity, unit, service_margin) VALUES ('flexy', 'Flexy', 0, 0, 0, 'service', 5)");
        const sale = sell([{ product_id: 'flexy', product_name: 'Flexy', quantity: 1, unit_price: 500, discount: 0, total: 500, sold_as: 'service' }]);
        expect(stock('flexy')).toBe(0);
        expect(api.get('SELECT unit_cost, sold_as FROM sale_items WHERE sale_id = ?', [sale.id])).toEqual({ unit_cost: 475, sold_as: 'service' });
        expect(api.get("SELECT COUNT(*) AS n FROM inventory_logs WHERE product_id = 'flexy'").n).toBe(0);
    });
});

describe('scarcity limit', () => {
    it('more than the limit per customer on one ticket is refused by the main process', () => {
        api.run("INSERT INTO products (id, name, price, cost, stock_quantity, max_per_customer) VALUES ('oil-s', 'Huile', 650, 600, 20, 2)");
        expect(() => sell([
            { product_id: 'oil-s', product_name: 'Huile', quantity: 2, unit_price: 650, discount: 0, total: 1300 },
            { product_id: 'oil-s', product_name: 'Huile', quantity: 1, unit_price: 650, discount: 0, total: 650 },
        ])).toThrow(/SCARCITY_LIMIT/);
        expect(stock('oil-s')).toBe(20);
        sell([{ product_id: 'oil-s', product_name: 'Huile', quantity: 2, unit_price: 650, discount: 0, total: 1300 }]);
        expect(stock('oil-s')).toBe(18);
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
