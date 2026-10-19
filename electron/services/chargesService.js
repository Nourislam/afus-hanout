/**
 * Shop charges and the month's net profit (Settings › Modules › Shop add-ons ›
 * Charges). What a shop owner asks at the end of the month: "how much is left
 * for me?" = profit on the sales − the shop's charges (rent, salaries,
 * electricity, water...) − the drawer's expenses.
 *
 * A charge paid every N months (Sonelgaz every 3 months) is spread over its
 * months: 12 000 DA every 3 months = 4 000 DA in each month.
 *
 * Purchase charges (transport, customs, travel) are added to the cost of the
 * pieces received (landedCosts), so the profit on each sale already counts them.
 *
 * `api` is the { all, get, run, uuid } database adapter.
 */
const { salesStats } = require('./salesStatsService');

const KINDS = ['rent', 'salary', 'electricity', 'water', 'internet', 'phone', 'tax', 'other'];
const EVERY = [0, 1, 2, 3, 6, 12]; // 0 = once
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const pad = (n) => String(n).padStart(2, '0');

/** "2026-10" → { y: 2026, m: 10 } */
function parseMonth(value) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(value || ''));
    if (!m) { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() + 1 }; }
    return { y: Number(m[1]), m: Number(m[2]) };
}
const monthKey = ({ y, m }) => `${y}-${pad(m)}`;
const monthIndex = ({ y, m }) => y * 12 + (m - 1);
const fromIndex = (i) => ({ y: Math.floor(i / 12), m: (i % 12) + 1 });
const startOf = (date) => parseMonth(String(date || '').slice(0, 7));

/** What one charge weighs in a month (0 when it does not run that month). */
function monthShare(charge, month) {
    const amount = Number(charge.amount) || 0;
    if (!(amount > 0) || !charge.is_active) return 0;
    const at = monthIndex(month);
    const from = monthIndex(startOf(charge.start_date));
    if (at < from) return 0;
    if (charge.end_date && at > monthIndex(startOf(charge.end_date))) return 0;
    const every = Number(charge.every_months) || 0;
    if (every === 0) return at === from ? amount : 0;
    return amount / every;
}

function clean(input = {}) {
    const name = String(input.name || '').trim().slice(0, 80);
    const kind = KINDS.includes(input.kind) ? input.kind : 'other';
    const amount = r2(input.amount);
    const every = EVERY.includes(Number(input.every_months)) ? Number(input.every_months) : 1;
    const start = /^\d{4}-\d{2}(-\d{2})?$/.test(String(input.start_date || '')) ? String(input.start_date).slice(0, 7) + '-01' : `${monthKey(parseMonth())}-01`;
    const end = input.end_date && /^\d{4}-\d{2}/.test(String(input.end_date)) ? String(input.end_date).slice(0, 7) + '-01' : null;
    if (!name) throw Object.assign(new Error('CHARGE_NAME_REQUIRED|{}'), { code: 'CHARGE_NAME_REQUIRED' });
    if (!(amount > 0)) throw Object.assign(new Error('CHARGE_AMOUNT_REQUIRED|{}'), { code: 'CHARGE_AMOUNT_REQUIRED' });
    return { name, kind, amount, every_months: every, start_date: start, end_date: end, employee_id: input.employee_id || null };
}

function list(api) {
    return api.all(`SELECT c.*, e.name AS employee_name FROM shop_charges c LEFT JOIN employees e ON e.id = c.employee_id
        WHERE c.is_active = 1 ORDER BY CASE c.kind WHEN 'rent' THEN 0 WHEN 'salary' THEN 1 ELSE 2 END, c.name`);
}

function save(api, input = {}) {
    const c = clean(input);
    if (input.id && api.get('SELECT id FROM shop_charges WHERE id = ?', [input.id])) {
        api.run(`UPDATE shop_charges SET name = ?, kind = ?, amount = ?, every_months = ?, start_date = ?, end_date = ?, employee_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [c.name, c.kind, c.amount, c.every_months, c.start_date, c.end_date, c.employee_id, input.id]);
        return api.get('SELECT * FROM shop_charges WHERE id = ?', [input.id]);
    }
    const id = api.uuid();
    api.run(`INSERT INTO shop_charges (id, name, kind, amount, every_months, start_date, end_date, employee_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [id, c.name, c.kind, c.amount, c.every_months, c.start_date, c.end_date, c.employee_id]);
    return api.get('SELECT * FROM shop_charges WHERE id = ?', [id]);
}

/** Stopped from this month on: the months before keep it (their profit does not change). */
function stop(api, id, month = monthKey(parseMonth())) {
    const charge = api.get('SELECT * FROM shop_charges WHERE id = ?', [id]);
    if (!charge) return false;
    const last = fromIndex(monthIndex(parseMonth(month)) - 1);
    if (monthIndex(last) < monthIndex(startOf(charge.start_date))) api.run('DELETE FROM shop_charges WHERE id = ?', [id]);
    else api.run('UPDATE shop_charges SET end_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [`${monthKey(last)}-01`, id]);
    return true;
}

const range = (month) => {
    const next = fromIndex(monthIndex(month) + 1);
    return { startDate: `${monthKey(month)}-01 00:00:00`, endDate: `${monthKey(next)}-01 00:00:00` };
};

/** The month: profit on sales, every charge's share, the drawer's expenses, what is left. */
function monthResult(api, value, { withCommissions = false } = {}) {
    const month = parseMonth(value);
    const { startDate, endDate } = range(month);
    const stats = salesStats(api, { startDate, endDate });
    const charges = api.all('SELECT c.*, e.name AS employee_name FROM shop_charges c LEFT JOIN employees e ON e.id = c.employee_id')
        .map(c => ({ id: c.id, name: c.name, kind: c.kind, employee_name: c.employee_name || null, every_months: c.every_months, amount: r2(monthShare(c, month)) }))
        .filter(c => c.amount > 0);
    const drawer = r2(api.get('SELECT COALESCE(SUM(amount), 0) AS total FROM cash_expenses WHERE datetime(created_at) >= datetime(?) AND datetime(created_at) < datetime(?)', [startDate, endDate])?.total);
    const chargesTotal = r2(charges.reduce((s, c) => s + c.amount, 0));
    const salesProfit = r2(stats.total_profit);
    // Employees' commissions (when that add-on is on); required here to avoid a require cycle
    const commissions = withCommissions ? require('./commissionService').monthTotal(api, monthKey(month)) : 0;
    return {
        month: monthKey(month),
        revenue: r2(stats.net_revenue), salesProfit, charges, chargesTotal, drawerExpenses: drawer, commissions,
        net: r2(salesProfit - chargesTotal - drawer - commissions),
    };
}

/** The month and the ones before it, for the chart (oldest first). */
function netProfit(api, value, { months = 6, withCommissions = false } = {}) {
    const month = parseMonth(value);
    const series = [];
    for (let i = months - 1; i >= 0; i--) {
        const r = monthResult(api, monthKey(fromIndex(monthIndex(month) - i)), { withCommissions });
        series.push({ month: r.month, salesProfit: r.salesProfit, costs: r2(r.chargesTotal + r.drawerExpenses + r.commissions), net: r.net });
    }
    const current = monthResult(api, monthKey(month), { withCommissions });
    const previous = series.length > 1 ? series[series.length - 2] : null;
    return { ...current, previousNet: previous ? previous.net : null, series };
}

/**
 * Purchase charges spread over the pieces received, by their value:
 * 10 000 DA of transport on 100 000 DA of goods = +10 % on each piece's cost.
 * @param {{ key, quantity, unitCost }[]} lines
 * @returns {Map<key, number>} extra cost per piece
 */
function landedCosts(lines, extras) {
    const total = r2(extras);
    const value = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0);
    const pieces = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
    const out = new Map();
    for (const l of lines) {
        const q = Number(l.quantity) || 0;
        if (!(q > 0) || !(total > 0)) { out.set(l.key, 0); continue; }
        // By value; by number of pieces when the order has no prices
        const share = value > 0 ? (q * (Number(l.unitCost) || 0)) / value : q / pieces;
        out.set(l.key, (total * share) / q);
    }
    return out;
}

/** New cost after receiving: average of what was in stock and what arrived (with its charges). */
const averageCost = ({ stock, cost, quantity, unitCost }) => {
    const before = Math.max(0, Number(stock) || 0);
    const q = Number(quantity) || 0;
    if (!(before + q > 0)) return r2(unitCost);
    return r2((before * (Number(cost) || 0) + q * (Number(unitCost) || 0)) / (before + q));
};

module.exports = { KINDS, EVERY, monthShare, list, save, stop, monthResult, netProfit, landedCosts, averageCost, parseMonth, monthKey, monthRange: range };
