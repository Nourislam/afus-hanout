// Employee commissions and the employee of the month: net of the returns
// (taken off the seller, not who took the piece back), percent or per piece,
// the monthly goal, a cashier sees only their own month, and the net profit
// takes the commissions off when that add-on is on.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const commissions = require('../electron/services/commissionService');
const charges = require('../electron/services/chargesService');
let api;

const sale = (id, emp, total, pieces, at, status = 'completed') => {
    api.run('INSERT INTO sales (id, receipt_number, employee_id, subtotal, total, tax_amount, discount_amount, status, created_at) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)', [id, `T-${id}`, emp, total, total, status, at]);
    api.run('INSERT INTO sale_items (id, sale_id, product_name, quantity, unit_price, total, unit_cost) VALUES (?, ?, ?, ?, ?, ?, ?)', [`i-${id}`, id, 'Article', pieces, total / pieces, total, (total / pieces) / 2]);
};

beforeAll(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afus-commissions-'));
    const ep = require.resolve('electron');
    require.cache[ep] = { id: ep, filename: ep, loaded: true, exports: { app: { getPath: () => dir, isPackaged: false } } };
    const quiet = console.log; console.log = () => {};
    await require('../electron/database/init').initDatabase();
    console.log = quiet;
    api = require('../electron/database/api');
    api.run("INSERT INTO employees (id, name, pin, role) VALUES ('amina', 'Amina', '0000', 'cashier'), ('karim', 'Karim', '0000', 'cashier'), ('owner', 'Patron', '0000', 'admin')");
    sale('a1', 'amina', 20000, 4, '2026-05-03 10:00:00');
    sale('a2', 'amina', 10000, 2, '2026-05-20 10:00:00');
    sale('k1', 'karim', 25000, 5, '2026-05-04 10:00:00');
    sale('k0', 'karim', 90000, 9, '2026-05-05 10:00:00', 'voided'); // never counts
    sale('a0', 'amina', 7000, 1, '2026-04-28 10:00:00'); // last month
    // Karim takes back 2 pieces Amina sold: they come off Amina
    api.run("INSERT INTO returns (id, sale_id, return_number, total_refund, employee_id, created_at) VALUES ('r1', 'a1', 'R1', 10000, 'karim', '2026-05-21 12:00:00')");
    api.run("INSERT INTO return_items (id, return_id, sale_item_id, quantity, refund_amount) VALUES ('ri1', 'r1', 'i-a1', 2, 10000)");
});

describe('commission rules', () => {
    it('percent of the net sales or an amount per piece; none = 0', () => {
        expect(commissions.commissionOf({ kind: 'percent', rate: 5 }, { net: 20000, pieces: 4 })).toBe(1000);
        expect(commissions.commissionOf({ kind: 'piece', rate: 150 }, { net: 20000, pieces: 4 })).toBe(600);
        expect(commissions.commissionOf({ kind: 'none', rate: 9 }, { net: 20000, pieces: 4 })).toBe(0);
        expect(commissions.commissionOf({ kind: 'percent', rate: 5 }, { net: -500, pieces: 0 })).toBe(0);
    });
    it('a rate is needed, a percent stays reasonable, the employee must exist', () => {
        expect(() => commissions.saveRule(api, { employee_id: 'amina', kind: 'percent', rate: 0 })).toThrow(/COMMISSION_RATE_REQUIRED/);
        expect(() => commissions.saveRule(api, { employee_id: 'amina', kind: 'percent', rate: 80 })).toThrow(/COMMISSION_RATE_TOO_HIGH/);
        expect(() => commissions.saveRule(api, { employee_id: 'nobody', kind: 'none' })).toThrow(/EMPLOYEE_NOT_FOUND/);
    });
});

describe('the month board', () => {
    it('net of returns on the seller, voided sales left out, best employee, commissions due', () => {
        commissions.saveRule(api, { employee_id: 'amina', kind: 'percent', rate: 5, monthly_goal: 40000 });
        commissions.saveRule(api, { employee_id: 'karim', kind: 'piece', rate: 100 });
        const b = commissions.board(api, '2026-05');
        const amina = b.rows.find(r => r.id === 'amina');
        const karim = b.rows.find(r => r.id === 'karim');
        expect(amina).toMatchObject({ sales: 30000, refunds: 10000, net: 20000, pieces: 4, tickets: 2, commission: 1000, goalPercent: 50, returnRate: 33.33 });
        expect(karim).toMatchObject({ sales: 25000, refunds: 0, net: 25000, pieces: 5, commission: 500, goalPercent: null });
        expect(b.best).toBe('karim');
        expect(b.rows[0].id).toBe('karim');
        expect(b.totalCommissions).toBe(1500);
        // The owner with no sales is listed, no commission
        expect(b.rows.find(r => r.id === 'owner')).toMatchObject({ net: 0, commission: 0 });
    });
    it('no best employee in an empty month', () => {
        expect(commissions.board(api, '2026-01').best).toBeNull();
    });
    it('an employee sees only their own month; nothing when they have no commission nor goal', () => {
        expect(commissions.mine(api, 'amina', '2026-05')).toEqual({ month: '2026-05', net: 20000, pieces: 4, goal: 40000, goalPercent: 50, commission: 1000, kind: 'percent' });
        expect(commissions.mine(api, 'owner', '2026-05')).toBeNull();
    });
});

describe('net profit with commissions', () => {
    it('takes the commissions off only when asked (add-on on)', () => {
        const without = charges.netProfit(api, '2026-05');
        const withC = charges.netProfit(api, '2026-05', { withCommissions: true });
        expect(without.commissions).toBe(0);
        expect(withC.commissions).toBe(1500);
        expect(withC.net).toBe(without.net - 1500);
    });
});
