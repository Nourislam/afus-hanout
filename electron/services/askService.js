/**
 * «اسأل حانوتك» (ask your hanout): ready questions, one button each,
 * answered from the shop's own figures on this computer, without the
 * internet. Each answer is { id, rows: [{ id, label, ... }], total? }; the
 * screen writes it in the shop's language. `api` is the { all, get } adapter.
 */
const catalog = require('./catalogService');
const { countedSale } = require('./saleStatus');

const DAY = 86400000;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100 + 0;
const toDb = (d) => d.toISOString().replace('T', ' ').slice(0, 19);
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
// Stock units of a line: grams for a weighed line, pieces otherwise
const UNITS = "CASE WHEN COALESCE(si.weight_grams, 0) > 0 THEN si.weight_grams ELSE si.quantity END";

const QUESTIONS = [
    { id: 'bestThisWeek', icon: 'flame' },
    { id: 'profitToday', icon: 'coins' },
    { id: 'whoOwes', icon: 'book' },
    { id: 'runningOut', icon: 'alert' },
    { id: 'notSelling', icon: 'moon' },
];

function bestThisWeek(api, now) {
    const since = toDb(new Date(startOfDay(now).getTime() - 6 * DAY));
    const rows = api.all(`
        SELECT si.product_id AS id, COALESCE(p.name, si.product_name) AS label, p.unit,
               ROUND(SUM(si.total), 2) AS amount, SUM(${UNITS}) AS quantity
        FROM sale_items si JOIN sales s ON s.id = si.sale_id LEFT JOIN products p ON p.id = si.product_id
        WHERE ${countedSale('s')} AND datetime(s.created_at) >= datetime(?)
        GROUP BY si.product_id ORDER BY amount DESC LIMIT 10`, [since]);
    return { rows: rows.map(({ unit, ...r }) => ({ ...r, amount: r2(r.amount), ...(unit === 'kg' ? { unit: 'kg' } : {}) })) };
}

function profitToday(api, now) {
    const since = toDb(startOfDay(now));
    const row = api.get(`
        SELECT ROUND(COALESCE(SUM(si.total), 0), 2) AS sales, ROUND(COALESCE(SUM(si.total - si.quantity * COALESCE(si.unit_cost, 0)), 0), 2) AS profit
        FROM sale_items si JOIN sales s ON s.id = si.sale_id
        WHERE ${countedSale('s')} AND datetime(s.created_at) >= datetime(?)`, [since]);
    return { rows: [], total: { sales: r2(row.sales), profit: r2(row.profit) } };
}

function whoOwes(api) {
    const rows = api.all(`
        SELECT c.id, c.name AS label, ROUND(SUM(cs.amount_due - COALESCE(cs.amount_paid, 0)), 2) AS amount
        FROM credit_sales cs JOIN customers c ON c.id = cs.customer_id
        WHERE ROUND(cs.amount_due - COALESCE(cs.amount_paid, 0), 2) > 0
        GROUP BY c.id ORDER BY amount DESC LIMIT 10`);
    return { rows: rows.map(r => ({ ...r, amount: r2(r.amount) })) };
}

/** At the pace of the last 28 days, what runs out within a week. */
function runningOut(api, now) {
    const since = toDb(new Date(now.getTime() - 28 * DAY));
    const rows = api.all(`
        SELECT p.id, p.name AS label, p.unit, p.stock_quantity AS stock, SUM(${UNITS}) AS sold
        FROM products p JOIN sale_items si ON si.product_id = p.id JOIN sales s ON s.id = si.sale_id
        WHERE p.is_active = 1 AND COALESCE(p.unit, 'piece') <> 'service' AND ${countedSale('s')} AND datetime(s.created_at) >= datetime(?)
        GROUP BY p.id`, [since]);
    return {
        rows: rows
            .map(r => ({ id: r.id, label: r.label, stock: Math.max(0, Number(r.stock) || 0), unit: r.unit === 'kg' ? 'kg' : 'piece', days: Math.floor(Math.max(0, Number(r.stock) || 0) / ((Number(r.sold) || 0) / 28)) }))
            .filter(r => Number.isFinite(r.days) && r.days <= 7)
            .sort((a, b) => a.days - b.days)
            .slice(0, 10),
    };
}

/** In stock, not sold for 30 days. */
function notSelling(api, now) {
    const since = toDb(new Date(now.getTime() - 30 * DAY));
    const rows = api.all(`
        SELECT p.id, p.name AS label, p.stock_quantity AS stock, p.unit, ROUND(p.stock_quantity * COALESCE(p.cost, 0) / CASE WHEN p.unit = 'kg' THEN 1000 ELSE 1 END, 2) AS value
        FROM products p
        WHERE p.is_active = 1 AND p.stock_quantity > 0 AND COALESCE(p.unit, 'piece') <> 'service'
          AND NOT EXISTS (SELECT 1 FROM sale_items si JOIN sales s ON s.id = si.sale_id
                          WHERE si.product_id = p.id AND ${countedSale('s')} AND datetime(s.created_at) >= datetime(?))
        ORDER BY value DESC LIMIT 10`, [since]);
    return { rows: rows.map(r => ({ ...r, unit: r.unit === 'kg' ? 'kg' : 'piece', value: r2(r.value) })) };
}

const ANSWERS = { bestThisWeek, profitToday, whoOwes, runningOut, notSelling };

/** The answer to one ready question. */
function answer(api, id, { now = new Date() } = {}) {
    const fn = ANSWERS[id];
    if (!fn) throw catalog.codedError('ASK_UNKNOWN', { id: String(id || '') });
    return { id, ...fn(api, now) };
}

module.exports = { QUESTIONS, answer };
