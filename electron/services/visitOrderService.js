/**
 * The distributor's days (يوم مرور الموزع) and the order to give him.
 *
 * Each supplier has the weekdays he comes by (supplier_visits.weekdays,
 * 0 = Sunday … 6 = Saturday). On his day the program proposes, for each of
 * his articles, what is missing until his next visit and one day more:
 *   need = sales per day (last 28 days) × (days to the next visit + 1) − stock
 * at least back to the article's minimum, rounded up to whole cartons (or
 * whole kg for an article sold by weight, in grams). Nothing is proposed for
 * an article that has enough. `api` is the { all, get, run } adapter.
 */
const { countedSale } = require('./saleStatus');

const WINDOW_DAYS = 28;
const DAY = 86400000;

/** The weekdays a supplier comes by (0 = Sunday), from supplier_visits. */
function visitDays(api, supplierId) {
    const row = api.get('SELECT weekdays FROM supplier_visits WHERE supplier_id = ?', [supplierId]);
    try {
        const days = JSON.parse(row?.weekdays || '[]');
        return [...new Set((Array.isArray(days) ? days : []).map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
    } catch {
        return [];
    }
}

/** Save the weekdays a supplier comes by. */
function setVisitDays(api, supplierId, weekdays) {
    const days = [...new Set((weekdays || []).map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
    api.run(`INSERT INTO supplier_visits (supplier_id, weekdays) VALUES (?, ?)
             ON CONFLICT(supplier_id) DO UPDATE SET weekdays = excluded.weekdays`, [supplierId, JSON.stringify(days)]);
    return days;
}

/** Days from today to the next visit after today (7 when he has no day: once a week). */
function daysToNextVisit(weekdays, today = new Date()) {
    if (!weekdays || !weekdays.length) return 7;
    const d = today.getDay();
    for (let k = 1; k <= 7; k++) if (weekdays.includes((d + k) % 7)) return k;
    return 7;
}

/** Suppliers who come by today, with their name and phone. */
function visitsToday(api, today = new Date()) {
    const day = today.getDay();
    return api.all(`SELECT v.supplier_id, v.weekdays, s.name, s.phone FROM supplier_visits v JOIN suppliers s ON s.id = v.supplier_id
                    WHERE COALESCE(s.is_active, 1) = 1 ORDER BY s.name`)
        .filter(v => visitDays(api, v.supplier_id).includes(day))
        .map(({ supplier_id: supplierId, name, phone }) => ({ supplier_id: supplierId, name, phone }));
}

/** Sold in the last 28 days per article, in stock units (grams for a weighed line). */
function soldByProduct(api, since) {
    const rows = api.all(`
        SELECT si.product_id, SUM(CASE WHEN COALESCE(si.weight_grams, 0) > 0 THEN si.weight_grams ELSE si.quantity END) AS units
        FROM sale_items si JOIN sales sa ON sa.id = si.sale_id
        WHERE ${countedSale('sa')} AND datetime(sa.created_at) >= datetime(?)
        GROUP BY si.product_id`, [since]);
    return new Map(rows.map(r => [r.product_id, Number(r.units) || 0]));
}

/**
 * The order to give this supplier today.
 * @returns {{ product_id, name, unit, stock, per_day, quantity, cartons?, carton_qty?, cost }[]}
 */
function suggestedOrder(api, supplierId, { today = new Date() } = {}) {
    const since = new Date(today.getTime() - WINDOW_DAYS * DAY).toISOString().replace('T', ' ').slice(0, 19);
    const sold = soldByProduct(api, since);
    const cover = daysToNextVisit(visitDays(api, supplierId), today) + 1;
    // His articles: the ones he usually brings, or that he delivered last
    const products = api.all(`
        SELECT p.id, p.name, p.unit, p.stock_quantity, p.min_stock_level, p.carton_qty, p.cost
        FROM products p
        WHERE p.is_active = 1 AND COALESCE(p.unit, 'piece') <> 'service' AND COALESCE(p.has_variants, 0) = 0
          AND (p.supplier_id = ? OR EXISTS (SELECT 1 FROM product_suppliers ps WHERE ps.product_id = p.id AND ps.supplier_id = ?))
        ORDER BY p.name`, [supplierId, supplierId]);
    const lines = [];
    for (const p of products) {
        const stock = Math.max(0, Number(p.stock_quantity) || 0);
        const perDay = (sold.get(p.id) || 0) / WINDOW_DAYS;
        const need = Math.max(Math.ceil(perDay * cover - stock), (Number(p.min_stock_level) || 0) - stock);
        if (!(need > 0)) continue;
        const weighed = p.unit === 'kg';
        const cartonQty = !weighed && Number(p.carton_qty) > 1 ? Number(p.carton_qty) : null;
        let quantity = need;
        let cartons = null;
        if (weighed) quantity = Math.ceil(need / 1000) * 1000;
        else if (cartonQty) { cartons = Math.ceil(need / cartonQty); quantity = cartons * cartonQty; }
        lines.push({
            product_id: p.id, name: p.name, unit: weighed ? 'kg' : 'piece', stock, per_day: Math.round(perDay * 100) / 100,
            quantity, ...(cartons ? { cartons, carton_qty: cartonQty } : {}), cost: Number(p.cost) || 0,
        });
    }
    return lines;
}

module.exports = { visitDays, setVisitDays, daysToNextVisit, visitsToday, suggestedOrder, WINDOW_DAYS };
