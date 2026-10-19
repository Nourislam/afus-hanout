/**
 * Employee commissions and the employee of the month (Settings › Modules ›
 * Shop add-ons › Commissions).
 *
 * Each employee may have a commission: a share of what they sold (percent) or
 * an amount per piece, and a monthly goal. What they sold is counted net: the
 * pieces brought back later are taken off the employee who sold them, not the
 * one who took them back.
 *
 * `api` is the { all, get, run } database adapter.
 */
const { countedSale } = require('./saleStatus');
const { parseMonth, monthKey, monthRange } = require('./chargesService');

const KINDS = ['none', 'percent', 'piece'];
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function rule(row) {
    return { kind: KINDS.includes(row?.kind) ? row.kind : 'none', rate: Number(row?.rate) || 0, monthly_goal: Number(row?.monthly_goal) || 0 };
}

function getRules(api) {
    return api.all('SELECT * FROM employee_commissions');
}

function saveRule(api, input = {}) {
    if (!input.employee_id || !api.get('SELECT id FROM employees WHERE id = ?', [input.employee_id])) {
        throw Object.assign(new Error('EMPLOYEE_NOT_FOUND|{}'), { code: 'EMPLOYEE_NOT_FOUND' });
    }
    const kind = KINDS.includes(input.kind) ? input.kind : 'none';
    let rate = kind === 'none' ? 0 : r2(input.rate);
    if (kind !== 'none' && !(rate > 0)) throw Object.assign(new Error('COMMISSION_RATE_REQUIRED|{}'), { code: 'COMMISSION_RATE_REQUIRED' });
    if (kind === 'percent' && rate > 50) throw Object.assign(new Error('COMMISSION_RATE_TOO_HIGH|{}'), { code: 'COMMISSION_RATE_TOO_HIGH' });
    const goal = Math.max(0, r2(input.monthly_goal));
    api.run(`INSERT INTO employee_commissions (employee_id, kind, rate, monthly_goal, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(employee_id) DO UPDATE SET kind = excluded.kind, rate = excluded.rate, monthly_goal = excluded.monthly_goal, updated_at = CURRENT_TIMESTAMP`,
        [input.employee_id, kind, rate, goal]);
    return rule(api.get('SELECT * FROM employee_commissions WHERE employee_id = ?', [input.employee_id]));
}

/** What one employee earns on their month. */
function commissionOf(r, { net, pieces }) {
    if (r.kind === 'percent') return r2(Math.max(0, net) * r.rate / 100);
    if (r.kind === 'piece') return r2(Math.max(0, pieces) * r.rate);
    return 0;
}

/** Sales, pieces and returns of every employee in the month. */
function figures(api, month) {
    const { startDate, endDate } = monthRange(month);
    const sold = api.all(`
        SELECT s.employee_id AS id, COUNT(s.id) AS tickets, COALESCE(SUM(s.total), 0) AS sales, COALESCE(SUM(p.pieces), 0) AS pieces
        FROM sales s
        LEFT JOIN (SELECT sale_id, SUM(quantity) AS pieces FROM sale_items GROUP BY sale_id) p ON p.sale_id = s.id
        WHERE s.employee_id IS NOT NULL AND datetime(s.created_at) >= datetime(?) AND datetime(s.created_at) < datetime(?) AND ${countedSale('s')}
        GROUP BY s.employee_id`, [startDate, endDate]);
    // Returns go to the employee who made the sale
    const where = `s.employee_id IS NOT NULL AND datetime(r.created_at) >= datetime(?) AND datetime(r.created_at) < datetime(?) AND ${countedSale('s')}`;
    const refunds = api.all(`SELECT s.employee_id AS id, COALESCE(SUM(r.total_refund), 0) AS refunds
        FROM returns r JOIN sales s ON s.id = r.sale_id WHERE ${where} GROUP BY s.employee_id`, [startDate, endDate]);
    const piecesBack = new Map(api.all(`SELECT s.employee_id AS id, COALESCE(SUM(ri.quantity), 0) AS pieces
        FROM return_items ri JOIN returns r ON r.id = ri.return_id JOIN sales s ON s.id = r.sale_id WHERE ${where} GROUP BY s.employee_id`, [startDate, endDate])
        .map(b => [b.id, b.pieces]));
    const back = refunds.map(b => ({ ...b, pieces: piecesBack.get(b.id) || 0 }));
    const out = new Map();
    for (const s of sold) out.set(s.id, { tickets: s.tickets, sales: s.sales, pieces: s.pieces, refunds: 0, piecesBack: 0 });
    for (const b of back) {
        const row = out.get(b.id) || { tickets: 0, sales: 0, pieces: 0, refunds: 0, piecesBack: 0 };
        row.refunds = b.refunds; row.piecesBack = b.pieces;
        out.set(b.id, row);
    }
    return out;
}

function lineFor(employee, f = {}, r) {
    const sales = r2(f.sales);
    const refunds = r2(f.refunds);
    const net = r2(sales - refunds);
    const pieces = Math.max(0, (f.pieces || 0) - (f.piecesBack || 0));
    return {
        id: employee.id, name: employee.name, role: employee.role,
        tickets: f.tickets || 0, sales, refunds, net, pieces,
        returnRate: sales > 0 ? r2((refunds / sales) * 100) : 0,
        kind: r.kind, rate: r.rate, goal: r.monthly_goal,
        goalPercent: r.monthly_goal > 0 ? Math.round((Math.max(0, net) / r.monthly_goal) * 100) : null,
        commission: commissionOf(r, { net, pieces }),
    };
}

/**
 * The month's ranking: every active employee (and a former one who sold that
 * month), best net sales first, the employee of the month, the commissions due.
 */
function board(api, value) {
    const month = parseMonth(value);
    const f = figures(api, month);
    const rules = new Map(getRules(api).map(r => [r.employee_id, rule(r)]));
    const employees = api.all('SELECT id, name, role, is_active FROM employees ORDER BY name')
        .filter(e => e.is_active || f.has(e.id));
    const rows = employees.map(e => lineFor(e, f.get(e.id), rules.get(e.id) || rule()))
        .sort((a, b) => b.net - a.net || b.tickets - a.tickets || a.name.localeCompare(b.name));
    const best = rows.length > 1 && rows[0].net > 0 && rows[0].net > rows[1].net ? rows[0].id
        : rows.length === 1 && rows[0].net > 0 ? rows[0].id : null;
    return { month: monthKey(month), rows, best, totalCommissions: r2(rows.reduce((s, r) => s + r.commission, 0)) };
}

/** One employee's own month (what a cashier sees on the sales screen: no one else's figures). */
function mine(api, employeeId, value) {
    const month = parseMonth(value);
    const employee = api.get('SELECT id, name, role FROM employees WHERE id = ?', [employeeId]);
    if (!employee) return null;
    const r = rule(api.get('SELECT * FROM employee_commissions WHERE employee_id = ?', [employeeId]));
    if (r.kind === 'none' && !(r.monthly_goal > 0)) return null;
    const line = lineFor(employee, figures(api, month).get(employeeId), r);
    return { month: monthKey(month), net: line.net, pieces: line.pieces, goal: line.goal, goalPercent: line.goalPercent, commission: line.commission, kind: r.kind };
}

/** Total of the commissions of a month (taken off the net profit). */
const monthTotal = (api, value) => board(api, value).totalCommissions;

module.exports = { KINDS, getRules, saveRule, commissionOf, board, mine, monthTotal };
