/**
 * Quick receiving (الاستلام السريع): the distributor comes by, what he
 * brought goes into stock in one transaction with its purchase price, what is
 * paid now and what is still owed to him.
 *
 * It is written as a purchase order received at once, so the supplier's debt,
 * his page and the reports read it like any order. A line's quantity is in
 * stock units (pieces, or grams for an article sold by weight); its unit cost
 * is per piece, or per kg. The shop learns from each delivery:
 *   - product_suppliers: the last price at this supplier and its date;
 *   - supplier_item_names: the name on his invoice → the shop's article;
 *   - product_batches: the expiry date when one is given.
 * `api` is the { all, get, run, uuid, transaction } adapter. Call inside a transaction.
 */
const catalog = require('./catalogService');
const { isWeighed } = require('../shared/grocery.ts');
const { suggestedPrice } = require('./priceService');

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100 + 0;
const err = (code, params = {}) => catalog.codedError(code, params);

/** The key of a name on an invoice: case, spaces and accents do not matter. */
function nameKey(name) {
    return String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** The shop's article for a name on this supplier's invoice, or null. */
function matchInvoiceName(api, supplierId, name) {
    const key = nameKey(name);
    if (!key) return null;
    return api.get('SELECT product_id FROM supplier_item_names WHERE supplier_id = ? AND name_key = ?', [supplierId, key])?.product_id || null;
}

/** Remember that this name on the supplier's invoice is this article. */
function rememberInvoiceName(api, supplierId, name, productId) {
    const key = nameKey(name);
    if (!key || !productId) return;
    api.run(`INSERT INTO supplier_item_names (supplier_id, name_key, product_id, last_seen) VALUES (?, ?, ?, datetime('now'))
             ON CONFLICT(supplier_id, name_key) DO UPDATE SET product_id = excluded.product_id, last_seen = excluded.last_seen`,
    [supplierId, key, productId]);
}

/**
 * Prices that went up by more than 5 % at this supplier since the last delivery,
 * with the sale price now and the one that keeps the margin (null: nothing to change).
 * @returns {{ productId, before, now, percent, price, suggested: { price, capped } | null }[]}
 */
function priceRises(api, supplierId, lines, threshold = 5) {
    const out = [];
    for (const line of lines || []) {
        const last = api.get('SELECT last_cost FROM product_suppliers WHERE product_id = ? AND supplier_id = ?', [line.productId, supplierId])?.last_cost;
        const now = Number(line.unitCost);
        if (!(last > 0) || !(now > 0)) continue;
        const percent = Math.round((now - last) / last * 1000) / 10;
        if (percent > threshold) {
            // The sale price that keeps the margin («طبّق» applies it; never above the official price)
            const p = api.get('SELECT price, capped_price FROM products WHERE id = ?', [line.productId]);
            const suggested = p ? suggestedPrice({ price: p.price, before: last, now, capped: p.capped_price }) : null;
            out.push({ productId: line.productId, before: last, now, percent, price: p ? Number(p.price) || 0 : 0, suggested });
        }
    }
    return out;
}

/** Each supplier's last price for an article, the cheapest first. */
function supplierPrices(api, productId) {
    return api.all(`SELECT ps.supplier_id, s.name AS supplier_name, ps.last_cost, ps.last_date
                    FROM product_suppliers ps JOIN suppliers s ON s.id = ps.supplier_id
                    WHERE ps.product_id = ? AND ps.last_cost IS NOT NULL
                    ORDER BY ps.last_cost, ps.last_date DESC`, [productId]);
}

/** A delivery number readable on the paper: R-YYMMDD-n. */
function deliveryNumber(api) {
    const d = new Date();
    const stem = `R-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-`;
    const n = api.get('SELECT COUNT(*) AS n FROM purchase_orders WHERE po_number LIKE ?', [`${stem}%`]).n + 1;
    return `${stem}${n}`;
}

/**
 * Receive a delivery.
 * @param {{ supplierId: string, lines: { productId: string, quantity: number, unitCost: number, invoiceName?: string, expiresOn?: string }[], paid?: number, employeeId?: string }} input
 * @returns {{ orderId: string, number: string, total: number, paid: number, owed: number, rises: object[] }}
 */
function receive(api, { supplierId, lines = [], paid = 0, employeeId = null }) {
    const supplier = api.get('SELECT id FROM suppliers WHERE id = ?', [supplierId]);
    if (!supplier) throw err('RECEIVE_SUPPLIER');
    if (!lines.length) throw err('RECEIVE_EMPTY');
    // Every line: an article, more than 0, a price of 0 or more
    const checked = lines.map((line, i) => {
        const product = api.get('SELECT id, name, unit, cost, stock_quantity FROM products WHERE id = ?', [line.productId]);
        const quantity = Number(line.quantity);
        const unitCost = Number(line.unitCost);
        if (!product || !(quantity > 0) || !Number.isFinite(unitCost) || unitCost < 0) throw err('RECEIVE_LINE', { line: i + 1 });
        const weighed = isWeighed(product);
        // Sold by weight: grams in stock, the price per kg
        const units = weighed ? Math.round(quantity) : Math.round(quantity);
        const amount = r2(weighed ? units / 1000 * unitCost : units * unitCost);
        return { ...line, product, weighed, units, unitCost, amount };
    });
    const total = r2(checked.reduce((s, l) => s + l.amount, 0));
    const paidNow = r2(paid);
    if (paidNow < 0 || paidNow > total + 0.004) throw err('RECEIVE_PAID', { total });
    const rises = priceRises(api, supplierId, checked);

    const orderId = api.uuid();
    const number = deliveryNumber(api);
    api.run(`INSERT INTO purchase_orders (id, po_number, supplier_id, status, subtotal, total, amount_paid, payment_status, created_by, notes)
             VALUES (?, ?, ?, 'received', ?, ?, ?, ?, ?, ?)`,
    [orderId, number, supplierId, total, total, paidNow, paidNow >= total - 0.004 ? 'paid' : paidNow > 0 ? 'partial' : 'unpaid', employeeId, 'quick receiving']);
    const receivingId = api.uuid();
    api.run('INSERT INTO receivings (id, receive_number, purchase_order_id, supplier_id, created_by) VALUES (?, ?, ?, ?, ?)',
        [receivingId, number, orderId, supplierId, employeeId]);

    for (const line of checked) {
        // On the order: kg and price per kg for a weighed article (its total is right), pieces otherwise
        const orderQty = line.weighed ? line.units / 1000 : line.units;
        api.run(`INSERT INTO purchase_order_items (id, purchase_order_id, product_id, product_name, quantity, unit_cost, total_cost, received_quantity)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [api.uuid(), orderId, line.product.id, line.product.name, orderQty, line.unitCost, line.amount, orderQty]);
        api.run('INSERT INTO receiving_items (id, receiving_id, product_id, product_name, quantity_ordered, quantity_received) VALUES (?, ?, ?, ?, ?, ?)',
            [api.uuid(), receivingId, line.product.id, line.product.name, orderQty, orderQty]);

        // Cost: the average of what was on the shelf and what arrived (per piece or per kg)
        const before = Math.max(0, Number(line.product.stock_quantity) || 0);
        const beforeUnits = line.weighed ? before / 1000 : before;
        const arrived = line.weighed ? line.units / 1000 : line.units;
        const cost = beforeUnits + arrived > 0
            ? r2((beforeUnits * (Number(line.product.cost) || 0) + arrived * line.unitCost) / (beforeUnits + arrived))
            : line.unitCost;
        api.run('UPDATE products SET cost = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [cost, line.product.id]);
        catalog.adjustStock(api, { productId: line.product.id, delta: line.units, type: 'purchase', reason: `GRN: ${number}`, employeeId });

        api.run(`INSERT INTO product_suppliers (product_id, supplier_id, last_cost, last_date) VALUES (?, ?, ?, datetime('now'))
                 ON CONFLICT(product_id, supplier_id) DO UPDATE SET last_cost = excluded.last_cost, last_date = excluded.last_date`,
        [line.product.id, supplierId, line.unitCost]);
        if (line.invoiceName) rememberInvoiceName(api, supplierId, line.invoiceName, line.product.id);
        if (line.expiresOn && /^\d{4}-\d{2}-\d{2}$/.test(line.expiresOn)) {
            api.run('INSERT INTO product_batches (id, product_id, expiry_date, quantity, receiving_id) VALUES (?, ?, ?, ?, ?)',
                [api.uuid(), line.product.id, line.expiresOn, line.units, receivingId]);
        }
    }
    return { orderId, number, total, paid: paidNow, owed: r2(total - paidNow), rises };
}

module.exports = { receive, priceRises, supplierPrices, matchInvoiceName, rememberInvoiceName, nameKey };
