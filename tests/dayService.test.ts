// The end of the day in three lines, and what looks odd in the last week:
// cash missing at a closing, a line sold under its purchase price, an
// employee refunding much more than the others.
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { createShop } from './helpers/shop';

const require = createRequire(import.meta.url);
const day = require('../electron/services/dayService');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let api: any;
const NOW = new Date(2026, 10, 7, 21, 0);
const at = (hoursAgo: number) => new Date(NOW.getTime() - hoursAgo * 3600000).toISOString().replace('T', ' ').slice(0, 19);

function sale(id: string, when: string, lines: [string, number, number, number, number?][], employee: string | null = null) {
    api.run('INSERT INTO sales (id, receipt_number, total, subtotal, status, created_at, employee_id) VALUES (?, ?, 0, 0, ?, ?, ?)', [id, `T-${id}`, 'completed', when, employee]);
    lines.forEach(([p, q, total, cost, grams], i) => api.run('INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, total, unit_cost, weight_grams) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [`${id}-${i}`, id, p, p, q, total / q, total, cost, grams ?? null]));
}

beforeEach(async () => {
    ({ api } = await createShop());
    api.run("INSERT INTO customers (id, name, credit_enabled) VALUES ('amine', 'Amine', 1)");
});

describe('the closing summary', () => {
    it('sold, earned about, the karni grew or shrank, on the shop day (from 04:00)', () => {
        sale('a', at(2), [['Lait', 10, 250, 22], ['Tomates', 1, 240, 120, 2000]]);
        sale('b', at(10), [['Café', 1, 280, 220]]); // 11:00 today
        sale('night', at(20), [['Café', 5, 1400, 1100]]); // 01:00 this morning: the shop day that began yesterday at 04:00
        api.run(`INSERT INTO credit_sales (id, customer_id, invoice_number, amount_due, amount_paid, status, due_date, created_at) VALUES ('k1', 'amine', 'K1', 900, 0, 'pending', '2026-12-01', ?)`, [at(3)]);
        api.run(`INSERT INTO credit_sales (id, customer_id, invoice_number, amount_due, amount_paid, status, due_date, created_at) VALUES ('k0', 'amine', 'K0', 2000, 500, 'partial', '2026-12-01', ?)`, [at(48)]);
        api.run(`INSERT INTO credit_payments (id, credit_sale_id, amount, payment_method, created_at) VALUES ('p1', 'k0', 500, 'cash', ?)`, [at(1)]);
        const summary = day.daySummary(api, { now: NOW });
        expect(summary).toEqual({ sales: 770, profit: 770 - 220 - 120 - 220, tickets: 2, karniGiven: 900, karniPaid: 500, karniChange: 400 });
    });
});

describe('what looks odd', () => {
    beforeEach(() => {
        api.run("INSERT OR IGNORE INTO employees (id, name, role, pin) VALUES ('sofia', 'Sofia', 'cashier', '5555'), ('karim', 'Karim', 'cashier', '6666')");
    });

    it('cash missing or extra at a closing (100 DA or more), with who and when', () => {
        api.run(`INSERT INTO shifts (id, employee_id, start_time, end_time, opening_cash, closing_cash) VALUES
                 ('s1', 'sofia', ?, ?, 0, 1000), ('s2', 'karim', ?, ?, 0, 1000), ('old', 'karim', ?, ?, 0, 1000)`,
        [at(30), at(25), at(10), at(5), at(300), at(290)]);
        const gaps: Record<string, number> = { s1: -350, s2: 20, old: -900 };
        const found = day.oddities(api, { now: NOW, cashDifference: (id: string) => gaps[id] });
        expect(found).toEqual([{ kind: 'cash', shiftId: 's1', employee: 'Sofia', date: at(25), difference: -350 }]);
    });

    it('lines sold under their purchase price (a weighed line costs its weight)', () => {
        sale('a', at(5), [['Lait', 10, 200, 22], ['Tomates', 1, 100, 120, 2000], ['Café', 1, 280, 220]]);
        sale('b', at(4), [['Lait', 2, 40, 22]]);
        expect(day.oddities(api, { now: NOW })).toEqual([
            { kind: 'belowCost', name: 'Lait', lines: 2, lost: 24 },
            { kind: 'belowCost', name: 'Tomates', lines: 1, lost: 20 },
        ]);
    });

    it('an employee who refunds much more than the others', () => {
        const refund = (id: string, emp: string) => api.run('INSERT INTO returns (id, return_number, total_refund, employee_id, created_at) VALUES (?, ?, 100, ?, ?)', [id, `R-${id}`, emp, at(6)]);
        ['1', '2', '3', '4'].forEach(n => refund(`s${n}`, 'sofia'));
        refund('k1', 'karim');
        expect(day.oddities(api, { now: NOW })).toEqual([{ kind: 'refunds', employee: 'Sofia', count: 4, total: 400 }]);
    });
});
