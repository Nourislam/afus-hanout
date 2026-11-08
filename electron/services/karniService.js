/**
 * The karni (كارني): the shop's notebook of who owes what. A customer pays
 * «some» (خلّص بعض) against everything they owe, not ticket by ticket: the
 * payment goes to the oldest debts first. The same rule records a payment of
 * one ticket (the credit page) and keeps customers.credit_balance in step.
 * `api` is the { all, get, run, uuid } database adapter. Call payPart inside
 * a transaction.
 */
const catalog = require('./catalogService');

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100 + 0;
/** ", is_synced = 0" where the table has that column (a full database; not every test shop) */
const synced = (api, table) => (api.all(`PRAGMA table_info(${table})`).some(c => c.name === 'is_synced') ? ', is_synced = 0' : '');

/** Debts of a customer still open, oldest first, with what is left of each. */
function openCredits(api, customerId) {
    return api.all(`
        SELECT id, invoice_number, amount_due, COALESCE(amount_paid, 0) AS amount_paid, created_at
        FROM credit_sales
        WHERE customer_id = ? AND ROUND(amount_due - COALESCE(amount_paid, 0), 2) > 0
        ORDER BY created_at, id`, [customerId])
        .map(c => ({ ...c, left: r2(c.amount_due - c.amount_paid) }));
}

/** What a customer owes now. */
function owed(api, customerId) {
    return r2(openCredits(api, customerId).reduce((s, c) => s + c.left, 0));
}

/**
 * One payment of one debt: never 0 nor more than is left of it (to the
 * centime). Updates the debt's status and the customer's credit balance.
 */
function recordPayment(api, { creditSaleId, amount, method = 'cash', reference = null, receivedBy = null, notes = null, id = null }) {
    const credit = api.get('SELECT * FROM credit_sales WHERE id = ?', [creditSaleId]);
    if (!credit) throw new Error('Credit sale not found');
    const left = r2((credit.amount_due || 0) - (credit.amount_paid || 0));
    const value = r2(amount);
    if (!(value > 0) || value > left + 0.004) throw catalog.codedError('CREDIT_PAYMENT_AMOUNT', { left });
    const paymentId = id || api.uuid();
    api.run(`INSERT INTO credit_payments (id, credit_sale_id, amount, payment_method, reference, received_by, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`, [paymentId, creditSaleId, value, method, reference, receivedBy, notes]);
    const paid = r2((credit.amount_paid || 0) + value);
    const status = Math.round(paid * 100) >= Math.round(credit.amount_due * 100) ? 'paid' : 'partial';
    api.run(`UPDATE credit_sales SET amount_paid = ?, status = ?, updated_at = CURRENT_TIMESTAMP${synced(api, 'credit_sales')} WHERE id = ?`, [paid, status, creditSaleId]);
    api.run(`UPDATE customers SET credit_balance = ROUND(MAX(0, COALESCE(credit_balance, 0) - ?), 2), updated_at = CURRENT_TIMESTAMP${synced(api, 'customers')}
             WHERE id = ?`, [value, credit.customer_id]);
    return { id: paymentId, credit_sale_id: creditSaleId, amount: value, payment_method: method };
}

/**
 * «خلّص بعض»: an amount against everything the customer owes, the oldest
 * debts first. Refuses nothing, a negative amount, or more than owed.
 * @returns {{ paid: number, left: number, payments: object[] }}
 */
function payPart(api, { customerId, amount, method = 'cash', receivedBy = null }) {
    const debts = openCredits(api, customerId);
    const total = r2(debts.reduce((s, c) => s + c.left, 0));
    const value = r2(amount);
    if (!(value > 0) || value > total + 0.004) throw catalog.codedError('CREDIT_PAYMENT_AMOUNT', { left: total });
    let rest = value;
    const payments = [];
    for (const debt of debts) {
        if (rest <= 0.004) break;
        const part = r2(Math.min(rest, debt.left));
        payments.push(recordPayment(api, { creditSaleId: debt.id, amount: part, method, receivedBy, notes: 'karni' }));
        rest = r2(rest - part);
    }
    return { paid: value, left: r2(total - value), payments };
}

/** Customers who owe, by name: what, since when (oldest open debt), last debt, ceiling. */
function balances(api) {
    return api.all(`
        SELECT c.id, c.name, c.phone, COALESCE(c.credit_limit, 0) AS credit_limit,
               ROUND(SUM(cs.amount_due - COALESCE(cs.amount_paid, 0)), 2) AS owed,
               MIN(cs.created_at) AS oldest, MAX(cs.created_at) AS last
        FROM credit_sales cs JOIN customers c ON c.id = cs.customer_id
        WHERE ROUND(cs.amount_due - COALESCE(cs.amount_paid, 0), 2) > 0
        GROUP BY c.id
        ORDER BY c.name COLLATE NOCASE`).map(r => ({ ...r, owed: r2(r.owed) }));
}

/** The statement's lines: each open debt, oldest first. */
function openLines(api, customerId) {
    return openCredits(api, customerId).map(c => ({ date: c.created_at, left: c.left, invoice: c.invoice_number }));
}

/** Ceiling of a new customer's karni when the shop has not set one (Settings › Sales screen). */
const DEFAULT_KARNI_LIMIT = 5000;

/**
 * Credit of a customer being created: in a hanout the karni is the rule, so
 * it is on, at the shop's default ceiling. Someone allowed to set credit
 * (the owner) may say otherwise in the form; anyone else gets the default.
 * @returns {[number, number]} [credit_enabled, credit_limit]
 */
function newCustomerCredit(customer = {}, { allowed = false, defaultLimit } = {}) {
    const limit = Number(defaultLimit) > 0 ? Number(defaultLimit) : DEFAULT_KARNI_LIMIT;
    if (!allowed || customer.credit_enabled === undefined || customer.credit_enabled === null) return [1, limit];
    if (!customer.credit_enabled) return [0, 0];
    return [1, Number(customer.credit_limit) > 0 ? Number(customer.credit_limit) : limit];
}

/**
 * The old paper karni, written in once (at setup or any day): a name, what
 * he owes, since when. A name the shop knows (case and spaces do not matter)
 * gets the debt; a new one is created with the karni on at the shop's ceiling.
 * @returns {{ customerId: string, creditId: string }}
 */
function openingDebt(api, { name, phone = '', amount, date = null, defaultLimit } = {}) {
    const clean = String(name || '').trim().replace(/\s+/g, ' ');
    const value = r2(amount);
    if (!clean || !(value > 0)) throw catalog.codedError('KARNI_OLD_LINE', {});
    const known = api.all('SELECT id, name FROM customers').find(c => String(c.name || '').trim().replace(/\s+/g, ' ').toLowerCase() === clean.toLowerCase());
    let customerId = known?.id;
    if (!customerId) {
        customerId = api.uuid();
        const [enabled, limit] = newCustomerCredit({}, { allowed: false, defaultLimit });
        api.run('INSERT INTO customers (id, name, phone, credit_enabled, credit_limit) VALUES (?, ?, ?, ?, ?)', [customerId, clean, String(phone || '').trim(), enabled, limit]);
    }
    const when = /^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) ? `${date} 00:00:00` : new Date().toISOString().replace('T', ' ').slice(0, 19);
    // After the highest number (a line taken away never makes the next one collide)
    const n = (Number(api.get("SELECT MAX(CAST(SUBSTR(invoice_number, 4) AS INTEGER)) AS n FROM credit_sales WHERE invoice_number LIKE 'KO-%'").n) || 0) + 1;
    const creditId = api.uuid();
    api.run(`INSERT INTO credit_sales (id, sale_id, customer_id, invoice_number, amount_due, amount_paid, status, due_date, notes, created_at)
             VALUES (?, NULL, ?, ?, ?, 0, 'pending', ?, ?, ?)`, [creditId, customerId, `KO-${String(n).padStart(4, '0')}`, value, when, 'old karni', when]);
    api.run('UPDATE customers SET credit_balance = ROUND(COALESCE(credit_balance, 0) + ?, 2) WHERE id = ?', [value, customerId]);
    return { customerId, creditId };
}

module.exports = { openCredits, owed, recordPayment, payPart, balances, openLines, newCustomerCredit, openingDebt, DEFAULT_KARNI_LIMIT };
