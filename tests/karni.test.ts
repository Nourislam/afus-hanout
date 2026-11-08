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

describe('a new customer', () => {
    it('has the karni on with the shop\'s default ceiling, whoever adds them at the till', () => {
        // A cashier (no right over credit settings): on, at the shop's ceiling, whatever the window sent
        expect(karni.newCustomerCredit({ credit_enabled: 0, credit_limit: 99999 }, { allowed: false, defaultLimit: 5000 })).toEqual([1, 5000]);
        // The owner: what the form says; nothing said = on at the shop's ceiling
        expect(karni.newCustomerCredit({}, { allowed: true, defaultLimit: 5000 })).toEqual([1, 5000]);
        expect(karni.newCustomerCredit({ credit_enabled: false, credit_limit: 0 }, { allowed: true, defaultLimit: 5000 })).toEqual([0, 0]);
        expect(karni.newCustomerCredit({ credit_enabled: true, credit_limit: 12000 }, { allowed: true, defaultLimit: 5000 })).toEqual([1, 12000]);
        // No ceiling set by the shop: 5000 DA
        expect(karni.newCustomerCredit({}, { allowed: false })).toEqual([1, karni.DEFAULT_KARNI_LIMIT]);
        expect(karni.DEFAULT_KARNI_LIMIT).toBe(5000);
    });
});

describe('the old paper karni', () => {
    it('each name and what he owes goes in once: a known name gets the debt, a new one is created', () => {
        karni.openingDebt(api, { name: 'amine ', amount: 400, date: '2026-09-15' });
        karni.openingDebt(api, { name: 'Ali le voisin', phone: '0661 22 33 44', amount: 750.5, date: '2026-10-01' });
        expect(karni.owed(api, 'amine')).toBe(1590 + 400);
        const ali = api.get("SELECT id, phone, credit_enabled, credit_limit FROM customers WHERE name = 'Ali le voisin'");
        expect(ali).toMatchObject({ phone: '0661 22 33 44', credit_enabled: 1, credit_limit: 5000 });
        expect(karni.openLines(api, ali.id)).toEqual([{ date: '2026-10-01 00:00:00', left: 750.5, invoice: expect.stringMatching(/^KO-/) }]);
    });

    it('a line taken away does not block the next one (its number follows the highest)', () => {
        const first = karni.openingDebt(api, { name: 'Ali', amount: 100 });
        karni.openingDebt(api, { name: 'Omar', amount: 200 });
        api.run('DELETE FROM credit_sales WHERE id = ?', [first.creditId]);
        const third = karni.openingDebt(api, { name: 'Said', amount: 300 });
        expect(api.get('SELECT invoice_number FROM credit_sales WHERE id = ?', [third.creditId]).invoice_number).toBe('KO-0003');
    });

    it('refuses no name or no amount', () => {
        expect(() => karni.openingDebt(api, { name: '', amount: 100 })).toThrow(/KARNI_OLD_LINE/);
        expect(() => karni.openingDebt(api, { name: 'Ali', amount: 0 })).toThrow(/KARNI_OLD_LINE/);
    });
});
