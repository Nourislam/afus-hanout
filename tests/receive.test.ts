// The distributor comes by: what he brought goes into stock in one go, with
// its purchase price, what is still owed to him, the name on his invoice and
// the expiry date. The next time, a higher price is pointed out.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let api: any, receiving: any, partners: any;

beforeAll(async () => {
    // A full database (the purchase tables come from init.js)
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afus-receive-'));
    const ep = require.resolve('electron');
    require.cache[ep] = { id: ep, filename: ep, loaded: true, exports: { app: { getPath: () => dir, isPackaged: false } } } as never;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await require('../electron/database/init').initDatabase();
    api = require('../electron/database/api');
    receiving = require('../electron/services/receiveService');
    partners = require('../electron/services/partnersService');
});

let n = 0;
/** A distributor, milk (cartons of 24) and tomatoes (by weight) of their own for each test. */
function shop() {
    n += 1;
    const ids = { dist: `dist${n}`, milk: `milk${n}`, tomato: `tomato${n}` };
    api.run('INSERT INTO suppliers (id, name, phone) VALUES (?, ?, ?)', [ids.dist, `Distributeur ${n}`, '0550112233']);
    api.run('INSERT INTO products (id, name, price, cost, stock_quantity, carton_qty, carton_price) VALUES (?, ?, 25, 22, 10, 24, 570)', [ids.milk, `Lait ${n}`]);
    api.run("INSERT INTO products (id, name, price, cost, stock_quantity, unit) VALUES (?, ?, 120, 80, 2000, 'kg')", [ids.tomato, `Tomates ${n}`]);
    return ids;
}

const delivery = (ids: Record<string, string>) => receiving.receive(api, {
    supplierId: ids.dist, paid: 1000, lines: [
        { productId: ids.milk, quantity: 48, unitCost: 21, invoiceName: 'LAIT  Candia 1L ', expiresOn: '2026-11-20' },
        { productId: ids.tomato, quantity: 10000, unitCost: 70 },
    ],
});

describe('quick receiving', () => {
    it('stock, average cost, an order received at once and the debt left', () => {
        const ids = shop();
        const result = delivery(ids);
        expect(result).toMatchObject({ total: 1708, paid: 1000, owed: 708 });
        expect(api.get('SELECT stock_quantity, cost FROM products WHERE id = ?', [ids.milk])).toEqual({ stock_quantity: 58, cost: 21.17 });
        // Sold by weight: 10 kg arrived at 70 DA/kg, kept in grams
        expect(api.get('SELECT stock_quantity, cost FROM products WHERE id = ?', [ids.tomato])).toEqual({ stock_quantity: 12000, cost: 71.67 });
        expect(api.get('SELECT status, total, amount_paid, payment_status FROM purchase_orders WHERE id = ?', [result.orderId]))
            .toEqual({ status: 'received', total: 1708, amount_paid: 1000, payment_status: 'partial' });
        expect(partners.suppliersOverview(api).find((s: { id: string }) => s.id === ids.dist).owed).toBe(708);
        expect(api.get("SELECT COUNT(*) AS n FROM inventory_logs WHERE type = 'purchase' AND product_id IN (?, ?)", [ids.milk, ids.tomato]).n).toBe(2);
    });

    it('remembers the last price at this supplier, the name on his invoice and the expiry date', () => {
        const ids = shop();
        delivery(ids);
        expect(api.all('SELECT product_id, last_cost FROM product_suppliers WHERE supplier_id = ? ORDER BY last_cost DESC', [ids.dist])).toEqual([
            { product_id: ids.tomato, last_cost: 70 }, { product_id: ids.milk, last_cost: 21 },
        ]);
        expect(receiving.matchInvoiceName(api, ids.dist, 'lait candia 1l')).toBe(ids.milk);
        expect(receiving.matchInvoiceName(api, ids.dist, 'Yaourt')).toBeNull();
        expect(api.get('SELECT expiry_date, quantity FROM product_batches WHERE product_id = ?', [ids.milk])).toEqual({ expiry_date: '2026-11-20', quantity: 48 });
    });

    it('the next delivery points out a price that went up by more than 5 %', () => {
        const ids = shop();
        delivery(ids);
        expect(receiving.priceRises(api, ids.dist, [{ productId: ids.milk, unitCost: 23.5 }, { productId: ids.tomato, unitCost: 72 }]))
            // With the sale price that keeps the margin: 25 × 23.5 / 21 = 27.98 → 28 DA
            .toEqual([{ productId: ids.milk, before: 21, now: 23.5, percent: 11.9, price: 25, suggested: { price: 28, capped: false } }]);
    });

    it('each delivery of the day has its own number, R-YYMMDD-n, after the highest', () => {
        const ids = shop();
        const a = delivery(ids);
        const b = delivery(ids);
        const stem = a.number.replace(/\d+$/, '');
        expect(a.number).toMatch(/^R-\d{6}-\d+$/);
        expect(b.number).toBe(`${stem}${Number(a.number.slice(stem.length)) + 1}`);
    });

    it('refuses an empty delivery, a quantity of 0, a negative price, or more paid than delivered', () => {
        const ids = shop();
        expect(() => receiving.receive(api, { supplierId: ids.dist, lines: [] })).toThrow(/RECEIVE_EMPTY/);
        expect(() => receiving.receive(api, { supplierId: ids.dist, lines: [{ productId: ids.milk, quantity: 0, unitCost: 21 }] })).toThrow(/RECEIVE_LINE/);
        expect(() => receiving.receive(api, { supplierId: ids.dist, lines: [{ productId: ids.milk, quantity: 5, unitCost: -1 }] })).toThrow(/RECEIVE_LINE/);
        expect(() => receiving.receive(api, { supplierId: ids.dist, paid: 500, lines: [{ productId: ids.milk, quantity: 5, unitCost: 21 }] })).toThrow(/RECEIVE_PAID/);
        expect(api.get('SELECT stock_quantity FROM products WHERE id = ?', [ids.milk]).stock_quantity).toBe(10);
    });
});
