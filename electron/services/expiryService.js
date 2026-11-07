/**
 * «بِعها قبل ما تفسد» (sell it before it goes off): batches received with an
 * expiry date (product_batches, written at receiving) that expire within N
 * days, with what is probably left of each. The oldest goods are sold first,
 * so the stock left belongs to the newest batches: the stock is spread over
 * the batches from the newest one down. `api` is the { all } adapter.
 */
const DAY = 86400000;

/** Midnight of a YYYY-MM-DD date in local time. */
const localDay = (iso) => { const [y, m, d] = String(iso).split('-').map(Number); return new Date(y, m - 1, d); };

/**
 * @returns {{ product_id, name, expiry_date, left, days_left, unit }[]} soonest first (expired ones first of all)
 */
function sellSoon(api, { days = 7, today = new Date() } = {}) {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const rows = api.all(`
        SELECT b.product_id, b.expiry_date, b.quantity, b.created_at, p.name, p.stock_quantity, COALESCE(p.unit, 'piece') AS unit
        FROM product_batches b JOIN products p ON p.id = b.product_id
        WHERE p.is_active = 1
        ORDER BY b.product_id, b.created_at DESC, b.expiry_date DESC`);
    const out = [];
    let current = null;
    let remaining = 0;
    for (const r of rows) {
        if (r.product_id !== current) { current = r.product_id; remaining = Math.max(0, Number(r.stock_quantity) || 0); }
        const left = Math.min(Number(r.quantity) || 0, remaining);
        remaining -= left;
        if (!(left > 0)) continue;
        const daysLeft = Math.round((localDay(r.expiry_date) - start) / DAY);
        if (daysLeft <= days) out.push({ product_id: r.product_id, name: r.name, expiry_date: r.expiry_date, left, days_left: daysLeft, unit: r.unit === 'kg' ? 'kg' : 'piece' });
    }
    return out.sort((a, b) => a.days_left - b.days_left || a.name.localeCompare(b.name));
}

module.exports = { sellSoon };
