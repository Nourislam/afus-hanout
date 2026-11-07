// The zakat estimate: the program gathers the shop's figures and shows 2.5 %
// of what the merchant chose to count; the valuation, the nisab and the debts
// counted are his decision.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { zakatEstimate, daysToZakatDay } from '../electron/shared/zakat.ts';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let api: any, zakat: any;

beforeAll(async () => {
    // A full database (the suppliers' orders come from init.js), empty
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afus-zakat-'));
    const ep = require.resolve('electron');
    require.cache[ep] = { id: ep, filename: ep, loaded: true, exports: { app: { getPath: () => dir, isPackaged: false } } } as never;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await require('../electron/database/init').initDatabase();
    api = require('../electron/database/api');
    zakat = require('../electron/services/zakatService');
    api.run('UPDATE products SET is_active = 0');
    api.run("INSERT INTO products (id, name, price, cost, stock_quantity) VALUES ('milk', 'Lait', 25, 22, 100)");
    api.run("INSERT INTO products (id, name, price, cost, stock_quantity, unit) VALUES ('frik', 'Frik', 300, 220, 2500, 'kg')");
    api.run("INSERT INTO customers (id, name, credit_enabled) VALUES ('amine', 'Amine', 1)");
    api.run(`INSERT INTO credit_sales (id, customer_id, invoice_number, amount_due, amount_paid, status, due_date) VALUES
             ('k1', 'amine', 'K1', 1500, 500, 'partial', '2026-12-01'), ('k2', 'amine', 'K2', 300, 300, 'paid', '2026-12-01')`);
    // A supplier owed 6 000 DA on goods received
    api.run("INSERT INTO suppliers (id, name) VALUES ('dist', 'Distributeur')");
    api.run(`INSERT INTO purchase_orders (id, po_number, supplier_id, status, subtotal, total, amount_paid, payment_status)
             VALUES ('po1', 'R-1', 'dist', 'received', 10000, 10000, 4000, 'partial')`);
    api.run(`INSERT INTO purchase_order_items (id, purchase_order_id, product_id, product_name, quantity, unit_cost, total_cost, received_quantity)
             VALUES ('poi1', 'po1', 'milk', 'Lait', 400, 25, 10000, 400)`);
});

describe('the shop\'s figures', () => {
    it('goods at purchase and sale price (kg by the kg), the karni owed, the drawers', () => {
        expect(zakat.zakatFigures(api, { drawers: 4200 })).toEqual({
            goodsCost: 100 * 22 + 2.5 * 220, goodsRetail: 100 * 25 + 2.5 * 300,
            receivables: 1000, payables: 6000, drawers: 4200,
        });
    });
});

describe('the estimate', () => {
    it('2.5 % of goods + cash + debts counted − what the shop owes', () => {
        expect(zakatEstimate({ goods: 800000, cash: 150000, receivables: 50000, payables: 200000, nisab: 0 }))
            .toEqual({ base: 800000, reached: null, due: 20000 });
    });

    it('under the nisab he gave: nothing due; never below 0', () => {
        expect(zakatEstimate({ goods: 100000, cash: 0, receivables: 0, payables: 0, nisab: 1200000 })).toEqual({ base: 100000, reached: false, due: 0 });
        expect(zakatEstimate({ goods: 0, cash: 0, receivables: 0, payables: 5000, nisab: 0 })).toEqual({ base: 0, reached: null, due: 0 });
    });

    it('days to his zakat day, in this Hijri year or the next', () => {
        expect(daysToZakatDay({ year: 1448, month: 9, day: 1 }, { month: 9, day: 1 })).toBe(0);
        expect(daysToZakatDay({ year: 1448, month: 8, day: 25 }, { month: 9, day: 1 })).toBe(6);
        expect(daysToZakatDay({ year: 1448, month: 9, day: 2 }, { month: 9, day: 1 })).toBeGreaterThan(350);
    });
});
