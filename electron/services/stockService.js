/**
 * The stock, line by line: one line per colour / size of an article (or one
 * for an article without sizes), with its own purchase price and sale price.
 * The one place the stock's money is computed: the Inventory page, its Excel
 * file and the home screen give the same figures.
 *
 * - purchase price of a size = its own when set, else the article's (same rule
 *   as the cost kept on each sale);
 * - sale price of a size = its own when set, else the article's (same rule as
 *   the sales screen, catalogService.effectivePrice);
 * - values count the pieces really there: a stock below 0 counts as 0.
 *
 * `api` is the { all, get } database adapter.
 */
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const set = (v) => v !== null && v !== undefined && v !== '';

/** @returns one line per size / colour (articles with sizes) or per article, sorted by article then size */
function stockLines(api) {
    const products = api.all(`
        SELECT p.id, p.name, p.sku, p.barcode, p.price, p.cost, p.stock_quantity, p.min_stock_level,
               COALESCE(p.has_variants, 0) AS has_variants, p.brand, p.season, p.collection, c.name AS category
        FROM products p LEFT JOIN categories c ON c.id = p.category_id
        WHERE COALESCE(p.is_active, 1) = 1
        ORDER BY c.name, p.name`);
    const variants = new Map();
    for (const v of api.all(`
        SELECT v.* FROM product_variants v JOIN products p ON p.id = v.product_id
        WHERE COALESCE(v.is_active, 1) = 1 AND COALESCE(p.is_active, 1) = 1 AND COALESCE(p.has_variants, 0) = 1
        ORDER BY v.product_id, COALESCE(v.sort_order, 0), v.color, v.size`)) {
        if (!variants.has(v.product_id)) variants.set(v.product_id, []);
        variants.get(v.product_id).push(v);
    }
    const lines = [];
    const line = (p, v) => {
        const quantity = Number(v ? v.stock_quantity : p.stock_quantity) || 0;
        const unitCost = r2(v && set(v.cost) ? v.cost : p.cost);
        const unitPrice = r2(v && set(v.price) ? v.price : p.price);
        const pieces = Math.max(0, quantity);
        return {
            product_id: p.id, variant_id: v ? v.id : null,
            name: p.name, category: p.category || '', brand: p.brand || '', season: p.season || '', collection: p.collection || '',
            color: v?.color || '', color_code: v?.color_code || '', size: v?.size || '',
            sku: (v ? v.sku : p.sku) || '', barcode: (v ? v.barcode : p.barcode) || '',
            qr: (v ? v.qr_code || v.sku : p.sku) || '',
            quantity, min_level: Number(v ? v.min_stock_level : p.min_stock_level) || 0,
            unit_cost: unitCost, unit_price: unitPrice,
            cost_value: r2(pieces * unitCost), retail_value: r2(pieces * unitPrice),
            margin_value: r2(pieces * (unitPrice - unitCost)),
        };
    };
    for (const p of products) {
        if (p.has_variants) for (const v of variants.get(p.id) || []) lines.push(line(p, v));
        else lines.push(line(p, null));
    }
    return lines;
}

/** Totals of some lines: pieces, purchase value, sale value, margin. */
function stockTotals(lines) {
    const t = { articles: new Set(lines.map(l => l.product_id)).size, lines: lines.length, pieces: 0, cost: 0, retail: 0, margin: 0, pieces_without_cost: 0 };
    for (const l of lines) {
        const pieces = Math.max(0, l.quantity);
        t.pieces += pieces;
        t.cost += l.cost_value;
        t.retail += l.retail_value;
        t.margin += l.margin_value;
        if (pieces > 0 && !(l.unit_cost > 0)) t.pieces_without_cost += pieces;
    }
    return { ...t, cost: r2(t.cost), retail: r2(t.retail), margin: r2(t.margin) };
}

/** The same totals per category (for the summary sheet). */
function byCategory(lines) {
    const groups = new Map();
    for (const l of lines) {
        const key = l.category || '';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(l);
    }
    return [...groups.entries()].map(([category, rows]) => ({ category, ...stockTotals(rows) }))
        .sort((a, b) => b.cost - a.cost || String(a.category).localeCompare(String(b.category)));
}

/** Per article: its pieces and values (sum of its sizes), for the Inventory page. */
function byArticle(lines) {
    const out = {};
    for (const l of lines) {
        const a = out[l.product_id] || (out[l.product_id] = { pieces: 0, cost: 0, retail: 0 });
        a.pieces += Math.max(0, l.quantity);
        a.cost = r2(a.cost + l.cost_value);
        a.retail = r2(a.retail + l.retail_value);
    }
    return out;
}

module.exports = { stockLines, stockTotals, byCategory, byArticle };
