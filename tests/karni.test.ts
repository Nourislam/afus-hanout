// The karni: who owes what, «خلّص بعض» against the whole balance (oldest debt
// first), and the lines of the statement.
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { createShop } from './helpers/shop';

const require = createRequire(import.meta.url);
const karni = require('../electron/services/karniService');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let api: any;

const debt = (id: string, customer: string, due: number, paid: number, at: string) => {
    api.run('INSERT INTO credit_sales (id, customer_id, invoice_number, amount_due, amount_paid, status, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, customer, `K-${id}`, due, paid, paid > 0 ? 'partial' : 'pending', at, at]);
};

beforeEach(async () => {
    ({ api } = await createShop());
    api.run("INSERT INTO customers (id, name, phone, credit_enabled, credit_limit, credit_balance) VALUES ('amine', 'Amine', '0555123456', 1, 5000, 1590)");
    api.run("INSERT INTO customers (id, name, credit_enabled) VALUES ('sara', 'Sara', 1)");
    debt('k1', 'amine', 1250, 0, '2026-11-02 10:00:00');
    debt('k2', 'amine', 500, 160, '2026-11-04 18:00:00');
    debt('k3', 'sara', 300, 300, '2026-11-01 09:00:00');
});

describe('the karni', () => {
    it('lists who owes, how much, since when; a customer who paid everything is not there', () => {
        expect(karni.balances(api)).toEqual([
            expect.objectContaining({ id: 'amine', name: 'Amine', owed: 1590, oldest: '2026-11-02 10:00:00', last: '2026-11-04 18:00:00', credit_limit: 5000 }),
        ]);
    });

    it('«خلّص بعض»: 1300 DA pays the oldest debt first, then part of the next', () => {
        const result = karni.payPart(api, { customerId: 'amine', amount: 1300, method: 'cash' });
        expect(result).toMatchObject({ paid: 1300, left: 290 });
        expect(api.get("SELECT amount_paid, status FROM credit_sales WHERE id = 'k1'")).toEqual({ amount_paid: 1250, status: 'paid' });
        expect(api.get("SELECT amount_paid, status FROM credit_sales WHERE id = 'k2'")).toEqual({ amount_paid: 210, status: 'partial' });
        expect(api.all("SELECT credit_sale_id, amount FROM credit_payments ORDER BY amount DESC")).toEqual([
            { credit_sale_id: 'k1', amount: 1250 }, { credit_sale_id: 'k2', amount: 50 },
        ]);
        expect(api.get("SELECT credit_balance FROM customers WHERE id = 'amine'").credit_balance).toBe(290);
    });

    it('refuses nothing, a negative amount, or more than owed', () => {
        for (const amount of [0, -5, 1590.01]) {
            expect(() => karni.payPart(api, { customerId: 'amine', amount, method: 'cash' })).toThrow(/CREDIT_PAYMENT_AMOUNT/);
        }
        expect(karni.payPart(api, { customerId: 'amine', amount: 1590, method: 'cash' })).toMatchObject({ paid: 1590, left: 0 });
    });

    it('the lines of the statement: each debt still open, oldest first, with what is left of it', () => {
        expect(karni.openLines(api, 'amine')).toEqual([
            { date: '2026-11-02 10:00:00', left: 1250, invoice: 'K-k1' },
            { date: '2026-11-04 18:00:00', left: 340, invoice: 'K-k2' },
        ]);
    });
});
