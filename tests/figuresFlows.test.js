// The figures stay right through the program's own handlers (not inserted by
// hand): a purchase order with odd prices, part of it received, sales in cash
// and on kridi, a kridi payment, a return, a pack. Then "Check the figures"
// finds nothing wrong, and the stock value is quantity × the price of each size.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
let api; let init; const h = {};
const call = (name, arg) => h[name](null, arg);

beforeAll(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afus-figures-'));
    const ep = require.resolve('electron');
    require.cache[ep] = { id: ep, filename: ep, loaded: true, exports: { app: { getPath: () => dir, isPackaged: false } } };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    init = require('../electron/database/init');
    await init.initDatabase();
    api = require('../electron/database/api');
    const session = require('../electron/services/session');
    const creditSales = require('../electron/services/creditSaleService');
    api.run("INSERT INTO employees (id, name, pin, role) VALUES ('boss', 'Patron', '0000', 'admin')");
    session.setEmployee({ id: 'boss', name: 'Patron', role: 'admin' });
    const ctx = new Proxy({
        ipcMain: { handle: (name, fn) => { h[name] = fn; } },
        getOne: init.getOne, runInsert: init.runInsert, runQuery: init.runQuery, runTransaction: init.runTransaction,
        dbApi: api, uuid: () => require('uuid').v4(), session,
        catalog: require('../electron/services/catalogService'),
        guard: require('../electron/services/guard'),
        returnService: require('../electron/services/returnService'),
        loyaltyService: require('../electron/services/loyaltyService'),
        salesStatsService: require('../electron/services/salesStatsService'),
        createCreditSale: (c) => creditSales.createCreditSale(api, c),
        generateInvoiceNumber: () => creditSales.nextInvoiceNumber(api),
        getStoreSettings: () => ({ taxRate: 0, taxType: 'inclusive' }),
        SyncManager: { triggerSync: () => {} },
    }, { get: (t, k) => (k in t ? t[k] : () => {}) });
    for (const file of ['sales', 'credit', 'offers', 'people']) require(`../electron/ipc/${file}`)(ctx);

    api.run("INSERT INTO suppliers (id, name) VALUES ('sup', 'Textile Oran')");
    api.run("INSERT INTO customers (id, name, credit_enabled, credit_limit, credit_balance) VALUES ('amina', 'Amina', 1, 0, 0)");
    // A jean in two sizes with their own purchase prices, and a belt without sizes
    api.run("INSERT INTO products (id, name, price, cost, stock_quantity, has_variants) VALUES ('jean', 'Jean slim', 4000, 2000, 0, 1)");
    api.run("INSERT INTO product_variants (id, product_id, size, sku, qr_code, price, cost, stock_quantity) VALUES ('j38', 'jean', '38', 'JEAN-38', 'Q-J38', NULL, 2100, 0), ('j40', 'jean', '40', 'JEAN-40', 'Q-J40', 4500, 2300, 0)");
    api.run("INSERT INTO products (id, name, sku, price, cost, stock_quantity, has_variants) VALUES ('belt', 'Ceinture', 'CEIN-1', 900, 333.33, 10, 0)");
});

const sale = (id, lines, payments, extra = {}) => {
    const items = lines.map((l, i) => ({ id: `${id}-${i}`, product_name: l.name, product_id: l.product, variant_id: l.variant || null, quantity: l.qty, unit_price: l.price, discount: 0, total: l.qty * l.price }));
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    return call('db:sales:create', {
        id, receipt_number: `T-${id}`, employee_id: 'boss', subtotal, discount_amount: 0, tax_amount: 0, total: subtotal,
        items, payments: payments(subtotal).map((p, i) => ({ id: `${id}-p${i}`, ...p })), ...extra,
    });
};

describe('a day in the shop, through the real handlers', () => {
    it('purchase order: the program computes its money, the window cannot change it', () => {
        call('db:purchaseOrders:create', {
            id: 'po1', po_number: 'PO-1', supplier_id: 'sup', status: 'sent', tax_rate: 0, discount_type: 'percent', discount_value: 10, shipping_cost: 500,
            subtotal: 1, tax_amount: 0, total: 1, // what a wrong window would send
            items: [
                { id: 'l38', product_id: 'jean', variant_id: 'j38', product_name: 'Jean 38', quantity: 6, unit_cost: 2100, total_cost: 1 },
                { id: 'l40', product_id: 'jean', variant_id: 'j40', product_name: 'Jean 40', quantity: 4, unit_cost: 2300.555, total_cost: 1 },
            ],
        });
        // 6 × 2100 + 4 × 2300.56 = 21 802.24; −10 % = 19 622.02; + 500 transport
        expect(api.get("SELECT subtotal, total FROM purchase_orders WHERE id = 'po1'")).toEqual({ subtotal: 21802.24, total: 20122.02 });
        expect(api.get("SELECT total_cost FROM purchase_order_items WHERE id = 'l40'").total_cost).toBe(9202.24);
    });

    it('received in part: the stock grows by what arrived, the supplier is owed only that', () => {
        call('db:receivings:create', { poId: 'po1', items: [
            { po_item_id: 'l38', product_id: 'jean', variant_id: 'j38', product_name: 'Jean 38', quantity_ordered: 6, quantity_received: 6 },
            { po_item_id: 'l40', product_id: 'jean', variant_id: 'j40', product_name: 'Jean 40', quantity_ordered: 4, quantity_received: 0 },
        ] });
        expect(api.get("SELECT stock_quantity FROM products WHERE id = 'jean'").stock_quantity).toBe(6);
        const owed = require('../electron/services/partnersService').suppliersOverview(api).find(s => s.id === 'sup').owed;
        // The 6 pieces of size 38 are 12 600 of the 21 802.24 ordered: that share of the order's 20 122.02
        expect(owed).toBeCloseTo(20122.02 * 12600 / 21802.24, 2);
    });

    it('sales: refused when what is paid is not the total; cash and kridi saved', () => {
        expect(() => sale('bad', [{ name: 'Ceinture', product: 'belt', qty: 1, price: 900 }], () => [{ method: 'cash', amount: 500 }])).toThrow(/SALE_PAYMENT_MISMATCH/);
        sale('s1', [{ name: 'Jean slim', product: 'jean', variant: 'j38', qty: 2, price: 4000 }, { name: 'Ceinture', product: 'belt', qty: 3, price: 900 }], (t) => [{ method: 'cash', amount: t }]);
        sale('s2', [{ name: 'Jean slim', product: 'jean', variant: 'j38', qty: 1, price: 4000 }], (t) => [{ method: 'cash', amount: 1000 }, { method: 'credit', amount: t - 1000 }],
            { customer_id: 'amina', credit: { customer_id: 'amina' } });
        expect(api.get("SELECT credit_balance FROM customers WHERE id = 'amina'").credit_balance).toBe(3000);
        expect(api.get("SELECT stock_quantity FROM product_variants WHERE id = 'j38'").stock_quantity).toBe(3);
    });

    it('kridi payment: never more than owed nor 0; a right one lowers the debt', () => {
        const cs = api.get("SELECT id FROM credit_sales WHERE sale_id = 's2'");
        expect(() => call('db:creditPayments:create', { credit_sale_id: cs.id, amount: 3500, payment_method: 'cash' })).toThrow(/CREDIT_PAYMENT_AMOUNT/);
        expect(() => call('db:creditPayments:create', { credit_sale_id: cs.id, amount: 0, payment_method: 'cash' })).toThrow(/CREDIT_PAYMENT_AMOUNT/);
        call('db:creditPayments:create', { credit_sale_id: cs.id, amount: 1200.004, payment_method: 'cash' });
        expect(api.get('SELECT amount_paid, status FROM credit_sales WHERE id = ?', [cs.id])).toEqual({ amount_paid: 1200, status: 'partial' });
        expect(api.get("SELECT credit_balance FROM customers WHERE id = 'amina'").credit_balance).toBe(1800);
    });

    it('a return puts the piece back and lowers the kridi first', () => {
        call('db:returns:create', { id: 'r1', sale_id: 's2', return_number: 'R-1', total_refund: 4000, items: [{ sale_item_id: 's2-0', quantity: 1, refund_amount: 4000, condition: 'sellable' }] });
        expect(api.get("SELECT stock_quantity FROM product_variants WHERE id = 'j38'").stock_quantity).toBe(4);
        expect(api.get("SELECT credit_balance FROM customers WHERE id = 'amina'").credit_balance).toBe(0);
    });

    it('packs: an article with sizes is refused; a pre-packed pack takes its pieces out with their history', () => {
        expect(() => call('db:bundles:create', { bundle: { id: 'b0', name: 'Pack jean', bundle_price: 5000, is_active: 1, deduct_component_stock: 0, stock_quantity: 0 }, items: [{ product_id: 'jean', quantity: 1 }] })).toThrow(/BUNDLE_VARIANT_PRODUCT/);
        call('db:bundles:create', { bundle: { id: 'b1', name: 'Pack 2 ceintures', bundle_price: 1500, is_active: 1, deduct_component_stock: 0, stock_quantity: 2 }, items: [{ product_id: 'belt', quantity: 2 }] });
        expect(api.get("SELECT stock_quantity FROM products WHERE id = 'belt'").stock_quantity).toBe(3); // 10 − 3 sold − 2 × 2
        expect(api.get("SELECT quantity_change, quantity_after FROM inventory_logs WHERE product_id = 'belt' AND type = 'assembly'")).toEqual({ quantity_change: -4, quantity_after: 3 });
        expect(() => call('db:bundles:assemble', { id: 'b1', quantity: 5 })).toThrow(/STOCK_INSUFFICIENT/);
        expect(() => sale('s3', [{ name: 'Pack 2 ceintures', product: 'b1', qty: 3, price: 1500 }], (t) => [{ method: 'cash', amount: t }])).toThrow(/STOCK_INSUFFICIENT/);
        sale('s4', [{ name: 'Pack 2 ceintures', product: 'b1', qty: 1, price: 1500 }], (t) => [{ method: 'cash', amount: t }]);
        expect(api.get("SELECT stock_quantity FROM bundles WHERE id = 'b1'").stock_quantity).toBe(1);
        // A pack that takes its pieces from the articles when sold: its type is kept, the belts leave the stock
        call('db:bundles:create', { bundle: { id: 'b2', name: 'Duo ceintures', bundle_price: 1600, is_active: 1, deduct_component_stock: 1 }, items: [{ product_id: 'belt', quantity: 2 }] });
        expect(api.get("SELECT deduct_component_stock, stock_quantity FROM bundles WHERE id = 'b2'")).toEqual({ deduct_component_stock: 1, stock_quantity: 0 });
        sale('s5', [{ name: 'Duo ceintures', product: 'b2', qty: 1, price: 1600 }], (t) => [{ method: 'cash', amount: t }]);
        expect(api.get("SELECT stock_quantity FROM products WHERE id = 'belt'").stock_quantity).toBe(1);
        expect(api.get("SELECT product_id, bundle_id FROM sale_items WHERE sale_id = 's5'")).toEqual({ product_id: null, bundle_id: 'b2' });
        expect(() => sale('s6', [{ name: 'Duo ceintures', product: 'b2', qty: 1, price: 1600 }], (t) => [{ method: 'cash', amount: t }])).toThrow(/STOCK_INSUFFICIENT/);
    });

    it('"Check the figures" finds nothing wrong', () => {
        const report = require('../electron/services/integrityService').check(api);
        expect(report.checks.filter(c => !c.ok)).toEqual([]);
        expect(report.ok).toBe(true);
    });

    it('stock value = quantity × the purchase / sale price of each size, the same as the home screen', () => {
        const stock = require('../electron/services/stockService');
        const lines = stock.stockLines(api);
        // size 38: its own cost 2100, the jean's price 4000; size 40: nothing in stock; belt 333.33 / 900
        expect(lines.find(l => l.variant_id === 'j38')).toMatchObject({ name: 'Jean slim', size: '38', qr: 'Q-J38', quantity: 4, unit_cost: 2100, unit_price: 4000, cost_value: 8400, retail_value: 16000 });
        expect(lines.find(l => l.variant_id === 'j40')).toMatchObject({ quantity: 0, unit_price: 4500, cost_value: 0 });
        expect(lines.find(l => l.product_id === 'belt')).toMatchObject({ quantity: 1, cost_value: 333.33, retail_value: 900 });
        const totals = stock.stockTotals(lines);
        expect(totals).toMatchObject({ pieces: 5, cost: 8733.33, retail: 16900, margin: 8166.67 });
        const home = require('../electron/services/dashboardService').stockValue(api);
        expect([home.cost, home.retail, home.units]).toEqual([8733.33, 16900, 5]);
        expect(stock.byArticle(lines).jean).toEqual({ pieces: 4, cost: 8400, retail: 16000 });
    });
});

describe('a ticket adds up, checked by the main process', () => {
    const guard = require('../electron/services/guard');
    const BOSS = { id: 'boss', role: 'admin' };
    const ticket = (extra = {}) => ({
        items: [{ id: 'x', product_id: 'belt', quantity: 2, unit_price: 900, discount: 0, total: 1800 }],
        subtotal: 1800, discount_amount: 0, tax_amount: 0, service_charge: 0, total: 1800,
        payments: [{ method: 'cash', amount: 1800 }], ...extra,
    });
    it('the right ticket passes; prices without TVA: lines + TVA', () => {
        expect(() => guard.checkSale(api, BOSS, ticket())).not.toThrow();
        expect(() => guard.checkSale(api, BOSS, ticket({ tax_amount: 342, total: 2142, payments: [{ method: 'cash', amount: 2142 }] }))).not.toThrow();
    });
    it('a total with something added, a line that does not add up, a payment short or negative: refused', () => {
        expect(() => guard.checkSale(api, BOSS, ticket({ total: 2500, payments: [{ method: 'cash', amount: 2500 }] }))).toThrow(/SALE_TOTAL_MISMATCH/);
        expect(() => guard.checkSale(api, BOSS, ticket({ items: [{ id: 'x', product_id: 'belt', quantity: 2, unit_price: 900, discount: 0, total: 1700 }] }))).toThrow(/SALE_TOTAL_MISMATCH/);
        expect(() => guard.checkSale(api, BOSS, ticket({ payments: [{ method: 'cash', amount: 1000 }] }))).toThrow(/SALE_PAYMENT_MISMATCH/);
        expect(() => guard.checkSale(api, BOSS, ticket({ payments: [{ method: 'cash', amount: 2800 }, { method: 'card', amount: -1000 }] }))).toThrow(/SALE_PAYMENT_MISMATCH/);
    });
    it('split payments add up to the total', () => {
        expect(() => guard.checkSale(api, BOSS, ticket({ payments: [{ method: 'cash', amount: 800 }, { method: 'card', amount: 1000 }] }))).not.toThrow();
    });
});
