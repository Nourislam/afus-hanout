// Shop charges and the month's net profit: a bill every 3 months is spread over
// its months, a stopped charge keeps the months before, the drawer's expenses
// count, and purchase charges raise the cost of what arrived.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const charges = require('../electron/services/chargesService');
let init; let api;

beforeAll(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afus-charges-'));
    const ep = require.resolve('electron');
    require.cache[ep] = { id: ep, filename: ep, loaded: true, exports: { app: { getPath: () => dir, isPackaged: false } } };
    const quiet = console.log; console.log = () => {};
    init = require('../electron/database/init');
    await init.initDatabase();
    console.log = quiet;
    api = require('../electron/database/api');
});

describe('a charge in a month', () => {
    const bill = { amount: 12000, every_months: 3, start_date: '2026-01-01', is_active: 1 };
    it('every 3 months: a third in each month, nothing before it starts', () => {
        expect(charges.monthShare(bill, { y: 2026, m: 2 })).toBe(4000);
        expect(charges.monthShare(bill, { y: 2025, m: 12 })).toBe(0);
    });
    it('once: all of it in its month only', () => {
        const once = { ...bill, every_months: 0 };
        expect(charges.monthShare(once, { y: 2026, m: 1 })).toBe(12000);
        expect(charges.monthShare(once, { y: 2026, m: 2 })).toBe(0);
    });
});

describe('net profit', () => {
    it('= profit on sales − charges − drawer expenses; a stopped charge keeps its past months', () => {
        api.run("INSERT INTO sales (id, receipt_number, subtotal, total, tax_amount, discount_amount, status, created_at) VALUES ('s1', 'T1', 10000, 10000, 0, 0, 'completed', '2026-03-10 10:00:00')");
        api.run("INSERT INTO sale_items (id, sale_id, product_name, quantity, unit_price, total, unit_cost) VALUES ('i1', 's1', 'Robe', 1, 10000, 10000, 6000)");
        const rent = charges.save(api, { name: 'Kra', kind: 'rent', amount: 30000, every_months: 1, start_date: '2026-01' });
        charges.save(api, { name: 'Sonelgaz', kind: 'electricity', amount: 9000, every_months: 3, start_date: '2026-01' });
        api.run("INSERT INTO employees (id, name, pin, role) VALUES ('e1', 'Soufi', '0000', 'cashier')");
        api.run("INSERT INTO shifts (id, employee_id, start_time) VALUES ('sh1', 'e1', '2026-03-12 08:00:00')");
        api.run("INSERT INTO cash_expenses (id, shift_id, employee_id, amount, reason, created_at) VALUES ('x1', 'sh1', 'e1', 500, 'Café', '2026-03-12 09:00:00')");
        const march = charges.netProfit(api, '2026-03');
        expect(march.salesProfit).toBe(4000);
        expect(march.chargesTotal).toBe(33000);
        expect(march.drawerExpenses).toBe(500);
        expect(march.net).toBe(4000 - 33000 - 500);
        expect(march.series).toHaveLength(6);
        charges.stop(api, rent.id, '2026-04');
        expect(charges.netProfit(api, '2026-03').chargesTotal).toBe(33000);
        expect(charges.netProfit(api, '2026-04').chargesTotal).toBe(3000);
    });
    it('a charge needs a name and an amount', () => {
        expect(() => charges.save(api, { name: '', amount: 10 })).toThrow(/CHARGE_NAME_REQUIRED/);
        expect(() => charges.save(api, { name: 'Eau', amount: 0 })).toThrow(/CHARGE_AMOUNT_REQUIRED/);
    });
});

describe('purchase charges', () => {
    it('spread by value, then the cost is the average of the stock and what arrived', () => {
        const per = charges.landedCosts([{ key: 'a', quantity: 10, unitCost: 1000 }, { key: 'b', quantity: 10, unitCost: 3000 }], 4000);
        expect(per.get('a')).toBe(100);
        expect(per.get('b')).toBe(300);
        expect(charges.averageCost({ stock: 10, cost: 1000, quantity: 10, unitCost: 1100 })).toBe(1050);
        expect(charges.averageCost({ stock: 0, cost: 0, quantity: 5, unitCost: 1100 })).toBe(1100);
    });
});

describe('receiving with purchase charges', () => {
    it('raises the cost of the pieces received (average with the stock), and keeps the charges on the receiving', () => {
        const handlers = {};
        const ctx = new Proxy({
            ipcMain: { handle: (name, fn) => { handlers[name] = fn; } },
            getOne: init.getOne, runInsert: init.runInsert, runQuery: init.runQuery, runTransaction: init.runTransaction,
            dbApi: api, uuid: () => require('uuid').v4(),
            catalog: require('../electron/services/catalogService'),
        }, { get: (t, k) => (k in t ? t[k] : () => {}) });
        require('../electron/ipc/people')(ctx);
        api.run("INSERT INTO suppliers (id, name) VALUES ('sup', 'Tassili')");
        api.run("INSERT INTO products (id, name, price, cost) VALUES ('p1', 'Robe', 5000, 2000)");
        api.run("INSERT INTO product_variants (id, product_id, sku, qr_code, cost, stock_quantity) VALUES ('v1', 'p1', 'ROBE-M', 'Q1', 2000, 10)");
        api.run("INSERT INTO purchase_orders (id, po_number, supplier_id, status, total) VALUES ('po1', 'PO-1', 'sup', 'sent', 20000)");
        api.run("INSERT INTO purchase_order_items (id, purchase_order_id, product_id, variant_id, product_name, quantity, unit_cost, total_cost) VALUES ('poi1', 'po1', 'p1', 'v1', 'Robe', 10, 2000, 20000)");
        const r = handlers['db:receivings:create'](null, {
            poId: 'po1', notes: '',
            items: [{ po_item_id: 'poi1', product_id: 'p1', variant_id: 'v1', product_name: 'Robe', quantity_ordered: 10, quantity_received: 10 }],
            extras: { transport: 3000, customs: 1000 },
        });
        // 4 000 DA on 10 pieces = +400 each; average with the 10 in stock at 2 000: (10×2000 + 10×2400) / 20
        expect(api.get("SELECT cost, stock_quantity FROM product_variants WHERE id = 'v1'")).toEqual({ cost: 2200, stock_quantity: 20 });
        expect(api.get('SELECT extra_transport, extra_customs FROM receivings WHERE id = ?', [r.id])).toEqual({ extra_transport: 3000, extra_customs: 1000 });
    });
});
