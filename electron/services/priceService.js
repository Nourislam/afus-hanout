/**
 * A new purchase price (تعديل سعر البيع حين يتغير سعر الشراء): the program
 * suggests a sale price that keeps the margin, rounded the way a shop writes
 * it, never above the official price. Nothing changes by itself: one press
 * («طبّق») changes the price at the till (the price checker and the scale's
 * list read it from there) and puts the article in «ملصقات للطباعة».
 * `api` is the { all, get, run, uuid } adapter.
 */
const catalog = require('./catalogService');

const LABELS = 'labels_to_print';

/** Rounded up the way prices are written: 0.5 DA under 20 DA, 1 DA under 100 DA, 5 DA from 100 DA. */
function shopRound(n) {
    const step = n < 20 ? 0.5 : n < 100 ? 1 : 5;
    return Math.ceil(Math.round(n * 1000) / 1000 / step) * step;
}

/**
 * The sale price that keeps the margin after the purchase price went from
 * `before` to `now`; null when there is nothing to change.
 * @returns {{ price: number, capped: boolean } | null}
 */
function suggestedPrice({ price, before, now, capped = null }) {
    const p = Number(price) || 0;
    const b = Number(before) || 0;
    const n = Number(now) || 0;
    if (!(p > 0) || !(b > 0) || !(n > b)) return null;
    let next = shopRound(p * n / b);
    const cap = Number(capped) > 0 ? Number(capped) : null;
    const atCap = cap !== null && next > cap;
    if (atCap) next = cap;
    return next > p ? { price: next, capped: atCap } : null;
}

function readList(api) {
    const row = api.get('SELECT value FROM settings WHERE key = ?', [LABELS]);
    try { const ids = row ? JSON.parse(row.value) : []; return Array.isArray(ids) ? ids : []; } catch { return []; }
}
function writeList(api, ids) {
    const value = JSON.stringify(ids);
    if (api.get('SELECT key FROM settings WHERE key = ?', [LABELS])) api.run('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?', [value, LABELS]);
    else api.run('INSERT INTO settings (key, value) VALUES (?, ?)', [LABELS, value]);
}

/** «طبّق»: the new price at the till, and the article's label to print again. */
function applyPrice(api, { productId, price, employeeId = null }) {
    const product = api.get('SELECT id, name, price, capped_price FROM products WHERE id = ?', [productId]);
    if (!product) throw catalog.codedError('PRODUCT_NOT_FOUND', {});
    const next = Math.round(Number(price) * 100) / 100;
    if (!Number.isFinite(next) || !(next > 0)) throw catalog.codedError('PRICE_INVALID', {});
    const cap = Number(product.capped_price) > 0 ? Number(product.capped_price) : null;
    if (cap !== null && next > cap + 0.004) throw catalog.codedError('PRICE_ABOVE_CAP', { product: product.name, cap });
    api.run('UPDATE products SET price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [next, product.id]);
    if (api.get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'system_logs'")) {
        api.run('INSERT INTO system_logs (id, action_type, description, details, employee_id) VALUES (?, ?, ?, ?, ?)',
            [api.uuid(), 'price_changed', `Price of ${product.name}: ${product.price} → ${next}`, JSON.stringify({ productId: product.id, before: product.price, now: next }), employeeId]);
    }
    queueLabel(api, product.id);
    return { id: product.id, price: next };
}

/** The article's label is to print again (its price changed). */
function queueLabel(api, productId) {
    const ids = readList(api);
    if (!ids.includes(productId)) writeList(api, [...ids, productId]);
}

/** The articles whose label is to print again (their price changed), in the order they were changed. */
function labelsToPrint(api) {
    const ids = readList(api);
    if (!ids.length) return [];
    const rows = api.all(`SELECT id, name, price, barcode, unit FROM products WHERE is_active = 1 AND id IN (${ids.map(() => '?').join(',')})`, ids);
    return ids.map(id => rows.find(r => r.id === id)).filter(Boolean);
}

/** The labels page took these. */
function clearLabelsToPrint(api, ids = []) {
    writeList(api, readList(api).filter(id => !ids.includes(id)));
}

module.exports = { suggestedPrice, applyPrice, queueLabel, labelsToPrint, clearLabelsToPrint, shopRound };
