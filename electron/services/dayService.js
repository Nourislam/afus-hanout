/**
 * The end of the shop's day (ملخص الغلق) and what looks odd (الغرائب).
 *
 * daySummary: three lines for the owner, sent by WhatsApp if he wants:
 *   sold, earned about (sales − their purchase price), the karni grew or
 *   shrank (credit given − credit paid back), on the shop day (04:00 → 04:00).
 * oddities: over the last 7 days, cash missing or extra at a drawer's
 *   closing, lines sold under their purchase price, an employee who refunds
 *   much more than the others. Shown to the owner only; nothing is changed.
 * `api` is the { all, get } adapter.
 */
const { countedSale } = require('./saleStatus');
const { shopDayStart } = require('../shared/shopDay.ts');

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100 + 0;
const toDb = (d) => d.toISOString().replace('T', ' ').slice(0, 19);
const DAY = 86400000;

/** Cash difference at closing worth showing (a few dinars of change are not). */
const CASH_GAP = 100;
/** Refunds in 7 days from which an employee is shown, when also twice the others' average. */
const MANY_REFUNDS = 3;

/** The shop day so far: sold, profit about, tickets, karni given and paid back. */
function daySummary(api, { now = new Date() } = {}) {
    const since = toDb(shopDayStart(now));
    const sold = api.get(`
        SELECT ROUND(COALESCE(SUM(si.total), 0), 2) AS sales,
               ROUND(COALESCE(SUM(si.total - si.quantity * COALESCE(si.unit_cost, 0)), 0), 2) AS profit
        FROM sale_items si JOIN sales s ON s.id = si.sale_id
        WHERE ${countedSale('s')} AND datetime(s.created_at) >= datetime(?)`, [since]);
    const tickets = api.get(`SELECT COUNT(*) AS n FROM sales s WHERE ${countedSale('s')} AND datetime(s.created_at) >= datetime(?)`, [since]).n;
    const given = api.get('SELECT COALESCE(SUM(amount_due), 0) AS n FROM credit_sales WHERE datetime(created_at) >= datetime(?)', [since]).n;
    const paid = api.get('SELECT COALESCE(SUM(amount), 0) AS n FROM credit_payments WHERE datetime(created_at) >= datetime(?)', [since]).n;
    return {
        sales: r2(sold.sales), profit: r2(sold.profit), tickets: Number(tickets) || 0,
        karniGiven: r2(given), karniPaid: r2(paid), karniChange: r2(given - paid),
    };
}

/**
 * What looks odd over the last 7 days.
 * @param {{ now?: Date, cashDifference?: (shiftId: string) => number|null }} options
 *   cashDifference: the drawer's difference at closing (shiftService.getShiftStats)
 * @returns {{ kind: 'cash'|'belowCost'|'refunds', ... }[]}
 */
function oddities(api, { now = new Date(), cashDifference = () => null } = {}) {
    const since = toDb(new Date(now.getTime() - 7 * DAY));
    const out = [];

    for (const shift of api.all(`SELECT sh.id, sh.end_time, e.name AS employee FROM shifts sh LEFT JOIN employees e ON e.id = sh.employee_id
                                 WHERE sh.end_time IS NOT NULL AND sh.closing_cash IS NOT NULL AND datetime(sh.end_time) >= datetime(?)
                                 ORDER BY datetime(sh.end_time) DESC`, [since])) {
        let difference = null;
        try { difference = cashDifference(shift.id); } catch { /* a broken drawer is skipped */ }
        if (difference !== null && Math.abs(difference) >= CASH_GAP) {
            out.push({ kind: 'cash', shiftId: shift.id, employee: shift.employee || '', date: shift.end_time, difference: r2(difference) });
        }
    }

    const below = api.all(`
        SELECT si.product_name AS name, COUNT(*) AS lines, ROUND(SUM(si.quantity * si.unit_cost - si.total), 2) AS lost
        FROM sale_items si JOIN sales s ON s.id = si.sale_id
        WHERE ${countedSale('s')} AND datetime(s.created_at) >= datetime(?)
          AND COALESCE(si.unit_cost, 0) > 0 AND COALESCE(si.sold_as, '') <> 'service'
          AND si.total < si.quantity * si.unit_cost - 0.01
        GROUP BY COALESCE(si.product_id, si.product_name) ORDER BY lost DESC LIMIT 5`, [since]);
    for (const b of below) out.push({ kind: 'belowCost', name: b.name, lines: b.lines, lost: r2(b.lost) });

    const refunds = api.all(`SELECT r.employee_id, e.name AS employee, COUNT(*) AS n, ROUND(SUM(r.total_refund), 2) AS total
                             FROM returns r LEFT JOIN employees e ON e.id = r.employee_id
                             WHERE datetime(r.created_at) >= datetime(?) GROUP BY r.employee_id`, [since]);
    for (const r of refunds) {
        const others = refunds.filter(o => o.employee_id !== r.employee_id);
        const average = others.length ? others.reduce((s, o) => s + o.n, 0) / others.length : 0;
        if (r.n >= MANY_REFUNDS && r.n >= 2 * average) out.push({ kind: 'refunds', employee: r.employee || '', count: r.n, total: r2(r.total) });
    }
    return out;
}

module.exports = { daySummary, oddities, CASH_GAP };
