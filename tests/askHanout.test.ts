// «اسأل حانوتك»: ready questions as buttons, answered from the shop's own
// figures, without the internet.
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { createShop } from './helpers/shop';

const require = createRequire(import.meta.url);
const ask = require('../electron/services/askService');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let api: any;
const NOW = new Date(2026, 10, 7, 18, 0);
const at = (daysAgo: number, h = 10) => {
    const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysAgo, h);
    return d.toISOString().replace('T', ' ').slice(0, 19);
};

beforeEach(async () => {
    ({ api } = await createShop());
    api.run("INSERT INTO products (id, name, price, cost, stock_quantity) VALUES ('milk', 'Lait', 25, 22, 40)");
    api.run("INSERT INTO products (id, name, price, cost, stock_quantity) VALUES ('coffee', 'Café', 280, 220, 5)");
    api.run("INSERT INTO products (id, name, price, cost, stock_quantity) VALUES ('tea', 'Thé', 150, 120, 12)");
    const sale = (id: string, when: string, lines: [string, number, number, number][]) => {
        const total = lines.reduce((s, l) => s + l[2], 0);
        api.run('INSERT INTO sales (id, receipt_number, total, subtotal, status, created_at) VALUES (?, ?, ?, ?, ?, ?)', [id, `T-${id}`, total, total, 'completed', when]);
        lines.forEach(([p, q, t, cost], i) => api.run('INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, total, unit_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [`${id}-${i}`, id, p, p, q, t / q, t, cost]));
    };
    sale('a', at(0), [['milk', 10, 250, 22], ['coffee', 2, 560, 220]]);
    sale('b', at(3), [['coffee', 3, 840, 220]]);
    sale('c', at(40), [['tea', 5, 750, 120]]);
    api.run("INSERT INTO customers (id, name, credit_enabled) VALUES ('amine', 'Amine', 1), ('sara', 'Sara', 1)");
    api.run(`INSERT INTO credit_sales (id, customer_id, invoice_number, amount_due, amount_paid, status, due_date, created_at)
             VALUES ('k1', 'amine', 'K1', 1500, 200, 'partial', '2026-11-20', '2026-10-01'), ('k2', 'sara', 'K2', 300, 0, 'pending', '2026-11-20', '2026-11-01')`);
});

describe('Ask your hanout', () => {
    it('offers its questions as buttons', () => {
        expect(ask.QUESTIONS.map((q: { id: string }) => q.id)).toEqual(
            expect.arrayContaining(['bestThisWeek', 'whoOwes', 'profitToday', 'notSelling', 'runningOut']));
    });

    it('what sold best this week: by money, with the pieces', () => {
        expect(ask.answer(api, 'bestThisWeek', { now: NOW }).rows.slice(0, 2)).toEqual([
            { id: 'coffee', label: 'Café', amount: 1400, quantity: 5 },
            { id: 'milk', label: 'Lait', amount: 250, quantity: 10 },
        ]);
    });

    it('who owes the most', () => {
        expect(ask.answer(api, 'whoOwes', { now: NOW }).rows).toEqual([
            { id: 'amine', label: 'Amine', amount: 1300 },
            { id: 'sara', label: 'Sara', amount: 300 },
        ]);
    });

    it('the profit of today (sales less what they cost)', () => {
        const a = ask.answer(api, 'profitToday', { now: NOW });
        expect(a.total).toEqual({ sales: 810, profit: 810 - 10 * 22 - 2 * 220 });
    });

    it('what has not sold for 30 days, with its stock', () => {
        const ids = ask.answer(api, 'notSelling', { now: NOW }).rows.map((r: { id: string }) => r.id);
        expect(ids).toContain('tea');
        expect(ids).not.toContain('milk');
        expect(ids).not.toContain('coffee');
    });

    it('what will run out within a week at this pace', () => {
        // Over the last 28 days: milk 10 sold, 40 left (112 days); coffee 5 sold, 5 left (28 days): neither within a week
        api.run("UPDATE products SET stock_quantity = 1 WHERE id = 'coffee'");
        const rows = ask.answer(api, 'runningOut', { now: NOW }).rows;
        expect(rows.map((r: { id: string }) => r.id)).toEqual(['coffee']);
        expect(rows[0].days).toBe(5);
    });

    it('an unknown question is refused', () => {
        expect(() => ask.answer(api, 'nope', { now: NOW })).toThrow(/ASK_UNKNOWN/);
    });
});
