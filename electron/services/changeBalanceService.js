/**
 * Change kept for a customer (رصيد الصرف): coins under 5 DA are rare, so
 * the change of a cash payment can be written on the customer's name instead
 * of being given, and is taken off one of his next tickets (payment method
 * `change_balance`). The money stayed in the drawer: the drawer's expected
 * cash counts it (shiftService). Every move is a row of
 * change_balance_moves: + kept, − used. `api` is the database adapter.
 */
const catalog = require('./catalogService');

const { CHANGE_KEEP_MAX } = require('../shared/grocery.ts');
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100 + 0;

function balance(api, customerId) {
    if (!customerId) return 0;
    return r2(api.get('SELECT COALESCE(SUM(amount), 0) AS b FROM change_balance_moves WHERE customer_id = ?', [customerId])?.b);
}

/**
 * Keep the change of a cash sale for its customer: under 5 DA, not more than
 * the change the cash gave (tendered − cash paid), and only for a known customer.
 */
function keep(api, { customerId, amount, saleId, changeGiven }) {
    const value = r2(amount);
    if (!customerId || !(value > 0) || value >= CHANGE_KEEP_MAX || value > r2(changeGiven) + 0.004) {
        throw catalog.codedError('CHANGE_KEEP', { max: CHANGE_KEEP_MAX });
    }
    api.run('INSERT INTO change_balance_moves (id, customer_id, amount, sale_id) VALUES (?, ?, ?, ?)', [api.uuid(), customerId, value, saleId || null]);
    return balance(api, customerId);
}

/** Use the customer's kept change on a ticket: never more than he has. */
function use(api, { customerId, amount, saleId }) {
    const value = r2(amount);
    const has = balance(api, customerId);
    if (!customerId || !(value > 0) || value > has + 0.004) throw catalog.codedError('CHANGE_BALANCE_LOW', { balance: has });
    api.run('INSERT INTO change_balance_moves (id, customer_id, amount, sale_id) VALUES (?, ?, ?, ?)', [api.uuid(), customerId, -value, saleId || null]);
    return balance(api, customerId);
}

module.exports = { balance, keep, use, CHANGE_KEEP_MAX };
