/**
 * "Check the figures" (Settings › Data): every amount and quantity the shop
 * relies on, computed again from the lines it comes from and compared with
 * what is saved. Read only: nothing is changed.
 *
 *  1. each ticket line  = quantity × price − its discount
 *  2. each ticket       = the sum of its lines
 *  3. each ticket total = lines − discounts (+ TVA when prices are without TVA)
 *  4. each ticket       = what was paid for it (cash, card, kridi...)
 *  5. an article with sizes holds the sum of its sizes
 *  6. the stock of each article / size = the last movement of its history
 *  7. no stock below 0
 *  8. each kridi: paid = its payments, never more than owed
 *  9. each customer's debt = what is left on their kridi
 * 10. a return never gives back more pieces than were sold, and = its lines
 * 11. each purchase order = its lines (quantity × purchase price) ± discount, TVA, transport
 * 12. the stock value is the same everywhere (Inventory, home screen)
 *
 * @returns {{ ok: boolean, checks: { id, ok, count, samples }[] }}
 */
const { countedSale } = require('./saleStatus');
const stock = require('./stockService');

const SAMPLES = 20;
const near = (a, b, tolerance = 0.01) => Math.abs((Number(a) || 0) - (Number(b) || 0)) <= tolerance;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const rows = (api, sql, params = []) => api.all(sql, params);

const CHECKS = [
    ['sale_lines', (api) => rows(api, `
        SELECT si.id, s.receipt_number AS ticket, si.product_name AS name, si.quantity, si.unit_price, si.discount, si.total,
               ROUND(si.quantity * si.unit_price - COALESCE(si.discount, 0), 2) AS expected
        FROM sale_items si JOIN sales s ON s.id = si.sale_id
        WHERE ABS(si.total - (si.quantity * si.unit_price - COALESCE(si.discount, 0))) > 0.01`)],
    ['sale_subtotal', (api) => rows(api, `
        SELECT s.id, s.receipt_number AS ticket, s.subtotal AS saved, ROUND(COALESCE(l.lines, 0), 2) AS expected
        FROM sales s LEFT JOIN (SELECT sale_id, SUM(total) AS lines FROM sale_items GROUP BY sale_id) l ON l.sale_id = s.id
        WHERE ABS(s.subtotal - COALESCE(l.lines, 0)) > 0.01`)],
    ['sale_total', (api) => rows(api, `
        SELECT s.id, s.receipt_number AS ticket, s.total AS saved,
               ROUND(s.subtotal - COALESCE(s.discount_amount, 0) + COALESCE(s.service_charge, 0), 2) AS expected
        FROM sales s
        WHERE ABS(s.total - MAX(0, s.subtotal - COALESCE(s.discount_amount, 0) + COALESCE(s.service_charge, 0))) > 0.01
          AND ABS(s.total - MAX(0, s.subtotal - COALESCE(s.discount_amount, 0) + COALESCE(s.service_charge, 0) + COALESCE(s.tax_amount, 0))) > 0.01`)],
    ['sale_paid', (api) => rows(api, `
        SELECT s.id, s.receipt_number AS ticket, s.total AS saved, ROUND(COALESCE(p.paid, 0), 2) AS expected
        FROM sales s LEFT JOIN (SELECT sale_id, SUM(amount) AS paid FROM payments GROUP BY sale_id) p ON p.sale_id = s.id
        WHERE ${countedSale('s')} AND ABS(s.total - COALESCE(p.paid, 0)) > 0.01`)],
    ['sizes_sum', (api) => rows(api, `
        SELECT p.id, p.name, p.stock_quantity AS saved, COALESCE(v.pieces, 0) AS expected
        FROM products p LEFT JOIN (SELECT product_id, SUM(stock_quantity) AS pieces FROM product_variants WHERE COALESCE(is_active, 1) = 1 GROUP BY product_id) v ON v.product_id = p.id
        WHERE COALESCE(p.has_variants, 0) = 1 AND p.stock_quantity <> COALESCE(v.pieces, 0)`)],
    ['stock_history', (api) => rows(api, `
        WITH last AS (
            SELECT product_id, variant_id, quantity_after, ROW_NUMBER() OVER (PARTITION BY product_id, COALESCE(variant_id, '') ORDER BY created_at DESC, rowid DESC) AS n
            FROM inventory_logs)
        SELECT p.name, v.color, v.size, COALESCE(v.stock_quantity, p.stock_quantity) AS saved, l.quantity_after AS expected
        FROM last l JOIN products p ON p.id = l.product_id LEFT JOIN product_variants v ON v.id = l.variant_id
        WHERE l.n = 1 AND (l.variant_id IS NULL OR v.id IS NOT NULL)
          AND (CASE WHEN l.variant_id IS NULL THEN COALESCE(p.has_variants, 0) = 0 ELSE 1 END)
          AND COALESCE(v.stock_quantity, p.stock_quantity) <> l.quantity_after`)],
    ['stock_negative', (api) => rows(api, `
        SELECT p.name, v.color, v.size, v.stock_quantity AS saved FROM product_variants v JOIN products p ON p.id = v.product_id
        WHERE COALESCE(v.is_active, 1) = 1 AND v.stock_quantity < 0
        UNION ALL
        SELECT name, NULL, NULL, stock_quantity FROM products WHERE COALESCE(has_variants, 0) = 0 AND COALESCE(is_active, 1) = 1 AND stock_quantity < 0`)],
    ['kridi_paid', (api) => rows(api, `
        SELECT cs.invoice_number AS ticket, cs.amount_due, cs.amount_paid AS saved, ROUND(COALESCE(p.paid, 0), 2) AS expected
        FROM credit_sales cs LEFT JOIN (SELECT credit_sale_id, SUM(amount) AS paid FROM credit_payments GROUP BY credit_sale_id) p ON p.credit_sale_id = cs.id
        WHERE ABS(COALESCE(cs.amount_paid, 0) - COALESCE(p.paid, 0)) > 0.01 OR COALESCE(cs.amount_paid, 0) > cs.amount_due + 0.01`)],
    ['customer_debt', (api) => rows(api, `
        SELECT c.name, ROUND(COALESCE(c.credit_balance, 0), 2) AS saved, ROUND(COALESCE(o.left_to_pay, 0), 2) AS expected
        FROM customers c LEFT JOIN (SELECT customer_id, SUM(MAX(amount_due - COALESCE(amount_paid, 0), 0)) AS left_to_pay FROM credit_sales GROUP BY customer_id) o ON o.customer_id = c.id
        WHERE ABS(COALESCE(c.credit_balance, 0) - COALESCE(o.left_to_pay, 0)) > 0.01`)],
    ['returns', (api) => [
        ...rows(api, `
            SELECT s.receipt_number AS ticket, si.product_name AS name, si.quantity AS saved, SUM(ri.quantity) AS expected
            FROM return_items ri JOIN sale_items si ON si.id = ri.sale_item_id JOIN sales s ON s.id = si.sale_id
            GROUP BY si.id HAVING SUM(ri.quantity) > si.quantity`),
        ...rows(api, `
            SELECT r.return_number AS ticket, r.total_refund AS saved, ROUND(SUM(ri.refund_amount), 2) AS expected
            FROM returns r JOIN return_items ri ON ri.return_id = r.id
            GROUP BY r.id HAVING ABS(r.total_refund - SUM(ri.refund_amount)) > 0.01`),
    ]],
    ['purchase_orders', (api) => rows(api, `
        SELECT o.po_number AS ticket, o.total AS saved,
               ROUND(COALESCE(l.lines, 0)
                 - (CASE WHEN o.discount_type = 'percent' THEN COALESCE(l.lines, 0) * COALESCE(o.discount_value, 0) / 100 ELSE COALESCE(o.discount_value, 0) END)
                 + COALESCE(o.tax_amount, 0) + COALESCE(o.shipping_cost, 0), 2) AS expected
        FROM purchase_orders o
        LEFT JOIN (SELECT purchase_order_id, SUM(quantity * COALESCE(unit_cost, 0)) AS lines FROM purchase_order_items GROUP BY purchase_order_id) l ON l.purchase_order_id = o.id
        WHERE COALESCE(o.status, '') <> 'cancelled' AND l.lines IS NOT NULL
          AND ABS(o.total - (COALESCE(l.lines, 0)
                 - (CASE WHEN o.discount_type = 'percent' THEN COALESCE(l.lines, 0) * COALESCE(o.discount_value, 0) / 100 ELSE COALESCE(o.discount_value, 0) END)
                 + COALESCE(o.tax_amount, 0) + COALESCE(o.shipping_cost, 0))) > 0.05`)],
    ['stock_value', (api) => {
        const t = stock.stockTotals(stock.stockLines(api));
        const home = require('./dashboardService').stockValue(api);
        return near(t.cost, home.cost) && near(t.retail, home.retail) && t.pieces === home.units ? []
            : [{ saved: r2(home.cost), expected: t.cost, retail_saved: r2(home.retail), retail_expected: t.retail, pieces_saved: home.units, pieces_expected: t.pieces }];
    }],
];

function check(api) {
    const checks = CHECKS.map(([id, run]) => {
        try {
            const found = run(api) || [];
            return { id, ok: found.length === 0, count: found.length, samples: found.slice(0, SAMPLES) };
        } catch (error) {
            // A check that cannot run (an old database without a table) is shown, never hidden
            return { id, ok: false, count: 0, samples: [], error: error.message };
        }
    });
    return { ok: checks.every(c => c.ok), checks };
}

module.exports = { check, CHECK_IDS: CHECKS.map(([id]) => id) };
