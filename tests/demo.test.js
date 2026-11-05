import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const BRAND = require('../electron/shared/brand.json');

// The real database module and demo service, on real files in a temporary data folder
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afus-demo-'));
const electronPath = require.resolve('electron');
require.cache[electronPath] = { id: electronPath, filename: electronPath, loaded: true, exports: { app: { getPath: () => dir } } };
const init = require('../electron/database/init');
const api = require('../electron/database/api');
const demo = require('../electron/services/demoService');
const catalog = require('../electron/services/catalogService');
const dashboard = require('../electron/services/dashboardService');
const salesStats = require('../electron/services/salesStatsService');
const pinService = require('../electron/services/pinService');
const ShiftService = require('../electron/services/shiftService');

const REAL_FILE = path.join(dir, BRAND.databaseFile);
const realHash = () => crypto.createHash('sha256').update(fs.readFileSync(REAL_FILE)).digest('hex');
const count = (table, where = '') => api.get(`SELECT COUNT(*) AS n FROM ${table} ${where}`).n;
const RANGE = { startDate: '2000-01-01', endDate: '2999-01-01' };

describe('demo shop: its own database, never the shop\'s', () => {
    let realBefore;
    let demoCounts;

    beforeAll(async () => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        // The real shop with its own article, employee and sale
        await init.initDatabase();
        api.run("INSERT INTO employees (id, name, pin, role) VALUES ('real-admin', 'Amina', 'x', 'admin')");
        catalog.saveProduct(api, { id: 'real-jean', name: 'Jean réel', price: 3000 }, [{ size: '38', sku: 'REAL-38', stock_quantity: 5 }], { isNew: true });
        api.run("INSERT INTO sales (id, receipt_number, subtotal, total, status) VALUES ('real-sale', 'R-1', 3000, 3000, 'completed')");
        api.run("INSERT INTO settings (key, value) VALUES ('setup_completed', '\"true\"') ON CONFLICT(key) DO UPDATE SET value = excluded.value");
        init.saveDatabase();
        realBefore = { hash: realHash(), sales: count('sales'), products: count('products'), employees: count('employees') };
    });
    afterAll(() => { vi.restoreAllMocks(); fs.rmSync(dir, { recursive: true, force: true }); });

    it('entering creates the demo shop in demo/, the real file is not touched', async () => {
        expect(init.isDemo()).toBe(false);
        const result = await demo.enter({ lang: 'fr' });
        expect(result.created).toBe(true);
        expect(init.isDemo()).toBe(true);
        expect(init.getDbPath()).toBe(path.join(dir, 'demo', `${BRAND.fileSlug}-demo.db`));
        expect(init.getDbPath()).not.toBe(REAL_FILE);
        expect(fs.existsSync(init.getDbPath())).toBe(true);
        expect(realHash()).toBe(realBefore.hash);
        // Nothing of the real shop in the demo
        expect(api.get("SELECT id FROM products WHERE id = 'real-jean'")).toBe(null);
        expect(api.get("SELECT id FROM employees WHERE id = 'real-admin'")).toBe(null);
    });

    it('the demo shop is complete: grocery articles, pictures, two months of sales, returns, kridi, staff, drawers, customers, distributors', () => {
        demoCounts = {
            products: count('products'), sales: count('sales'), returns: count('returns'),
            credit: count('credit_sales'), creditPayments: count('credit_payments'), employees: count('employees'),
            customers: count('customers'), suppliers: count('suppliers'), orders: count('purchase_orders'), receivings: count('receivings'),
            closed: count('shifts', 'WHERE end_time IS NOT NULL'), open: count('shifts', 'WHERE end_time IS NULL'), expenses: count('cash_expenses'),
        };
        expect(demoCounts.products).toBe(26);
        expect(count('product_variants')).toBe(0);
        expect(demoCounts.sales).toBeGreaterThan(1000);
        expect(demoCounts.returns).toBeGreaterThan(3);
        expect(demoCounts.credit).toBeGreaterThan(10);
        expect(demoCounts.creditPayments).toBeGreaterThan(3);
        expect(demoCounts.employees).toBe(3);
        expect(demoCounts.customers).toBe(10);
        expect(demoCounts.suppliers).toBe(4);
        expect(demoCounts.receivings).toBe(3);
        expect(demoCounts.closed).toBe(60);
        expect(demoCounts.open).toBe(1);
        expect(demoCounts.expenses).toBeGreaterThan(5);
        // Sales spread over two months
        const span = api.get('SELECT julianday(MAX(created_at)) - julianday(MIN(created_at)) AS days FROM sales').days;
        expect(span).toBeGreaterThan(55);
        // Every article has a local picture, the shop its logo
        const images = api.all('SELECT image_path FROM products');
        expect(images.every(r => r.image_path && fs.existsSync(path.join(dir, 'demo', 'images', r.image_path)))).toBe(true);
        expect(fs.existsSync(path.join(dir, 'images', images[0].image_path))).toBe(false);
        // Stock: some articles sold out or running low, none negative
        expect(count('products', 'WHERE stock_quantity = 0')).toBeGreaterThan(0);
        expect(count('products', 'WHERE stock_quantity < 0')).toBe(0);
        // Every packed article has its barcode; the bread has none (sold from its picture
        // button), the weighed ones a scale number
        expect(api.all("SELECT id FROM products WHERE unit = 'piece' AND (barcode IS NULL OR barcode = '')").map(r => r.id)).toEqual(['demo-prd-bread']);
        expect(count('products', "WHERE unit = 'kg' AND plu IS NULL")).toBe(0);
    });

    it('the owner opens the demo and sells at once: today\'s drawer is the owner\'s', () => {
        // In a hanout the owner is at the counter: logging in as the owner never meets another person's open drawer
        const open = api.all('SELECT employee_id FROM shifts WHERE end_time IS NULL');
        expect(open).toEqual([{ employee_id: 'demo-admin' }]);
    });

    it('the grocery is all there: by weight, by the carton, official prices, distributors\' days, Ramadan basket', () => {
        // Vegetables by weight: stock in grams, lines with their weight
        expect(count('products', "WHERE unit = 'kg'")).toBe(4);
        expect(count('sale_items', "WHERE sold_as = 'weight' AND weight_grams > 0 AND quantity = 1")).toBeGreaterThan(100);
        // Cartons: their own barcode, some sold as cartons at the carton price
        expect(count('product_barcodes', "WHERE kind = 'carton'")).toBe(count('products', 'WHERE carton_qty IS NOT NULL'));
        expect(count('sale_items', "WHERE sold_as = 'carton' AND discount > 0")).toBeGreaterThan(3);
        // Milk, bread, oil, sugar, semolina at their official price, never above it
        expect(count('products', 'WHERE capped_price IS NOT NULL')).toBe(6);
        expect(api.get(`SELECT COUNT(*) AS n FROM sale_items si JOIN products p ON p.id = si.product_id
                        WHERE p.capped_price IS NOT NULL AND si.weight_grams IS NULL AND si.unit_price > p.capped_price`).n).toBe(0);
        // The distributors come on their days
        expect(count('supplier_visits')).toBe(4);
        expect(JSON.parse(api.get("SELECT weekdays FROM supplier_visits WHERE supplier_id = 'demo-sup-1'").weekdays)).toEqual([0, 2, 4]);
        // The Ramadan basket for the associations
        expect(count('bundles')).toBe(1);
        expect(count('bundle_items')).toBe(5);
    });

    it('the demo figures add up like real ones (reports, dashboard, kridi, drawers)', () => {
        const stats = salesStats.salesStats(api, RANGE);
        expect(stats.total_revenue).toBeGreaterThan(200000);
        expect(stats.total_refunds).toBeGreaterThan(0);
        expect(dashboard.bestSellers(api, RANGE).products.length).toBeGreaterThan(3);
        // Kridi: each customer's balance is what is still owed on their tickets
        // Kridi stays under each customer's limit, as the till checks it
        for (const c of api.all('SELECT credit_limit, credit_balance FROM customers WHERE credit_limit > 0')) expect(c.credit_balance).toBeLessThanOrEqual(c.credit_limit);
        for (const c of api.all('SELECT id, credit_balance FROM customers')) {
            const owed = api.get('SELECT COALESCE(SUM(amount_due - amount_paid), 0) AS n FROM credit_sales WHERE customer_id = ?', [c.id]).n;
            expect(Math.round(c.credit_balance)).toBe(Math.round(owed));
        }
        expect(api.get("SELECT COUNT(*) AS n FROM credit_sales WHERE status != 'paid' AND due_date < ?", [new Date().toISOString()]).n).toBeGreaterThan(0);
        // Every closed drawer: counted cash close to what the program expects
        // (the demo computes it while building; checked here with the program's own formula)
        const shifts = new ShiftService();
        const closed = api.all('SELECT id FROM shifts WHERE end_time IS NOT NULL');
        expect(closed.length).toBe(60);
        for (const s of closed) {
            const st = shifts.getShiftStats(s.id);
            const d = st.cash_difference;
            // A drawer never holds less than nothing
            expect(st.expected_cash).toBeGreaterThanOrEqual(0);
            expect(d).toBeGreaterThanOrEqual(-100);
            expect(d, JSON.stringify(st)).toBeLessThanOrEqual(50);
        }
        // Demo staff: an owner and two sellers with the PINs shown on the login screen
        const staff = api.all('SELECT id, role, pin FROM employees ORDER BY role, id');
        expect(staff.map(s => s.role)).toEqual(['admin', 'cashier', 'cashier']);
        expect(pinService.verifyPin(staff.find(s => s.id === 'demo-admin').pin, '1111')).toBe(true);
        expect(pinService.verifyPin(staff.find(s => s.id === 'demo-cashier').pin, '2222')).toBe(true);
        expect(pinService.verifyPin(staff.find(s => s.id === 'demo-seller').pin, '3333')).toBe(true);
    });

    it('every screen has something to show: add-ons, both sellers, loyalty; the figures check finds nothing wrong', () => {
        const features = JSON.parse(api.get("SELECT value FROM settings WHERE key = 'features'").value);
        expect(features).toMatchObject({ charges: true, commissions: true, bundles: true, credit: true });
        // Both sellers sold (the employee of the month compares them), each with a rule and a goal
        const bySeller = api.all("SELECT employee_id, COUNT(*) AS n FROM sales WHERE employee_id IN ('demo-cashier', 'demo-seller') GROUP BY employee_id");
        expect(bySeller.length).toBe(2);
        expect(bySeller.every(r => r.n > 50)).toBe(true);
        expect(count('employee_commissions')).toBe(2);
        expect(count('shop_charges', 'WHERE is_active = 1')).toBe(4);
        // Loyalty: the customers' points are those of their tickets
        expect(api.get('SELECT SUM(loyalty_points) AS n FROM customers').n).toBeGreaterThan(50);
        // And "Check the figures" finds nothing wrong in all of it
        const report = require('../electron/services/integrityService').check(api);
        expect(report.ok, JSON.stringify(report.checks.filter(c => !c.ok))).toBe(true);
    });

    it('selling, kridi and stock changes in the demo stay in the demo file', () => {
        const article = api.get("SELECT * FROM products WHERE stock_quantity > 2 AND unit = 'piece' LIMIT 1");
        api.transaction(() => {
            api.run("INSERT INTO sales (id, receipt_number, subtotal, total, status) VALUES ('demo-test-sale', 'T-1', 1000, 1000, 'completed')");
            catalog.adjustStock(api, { productId: article.id, delta: -1, type: 'sale' });
            api.run("INSERT INTO customers (id, name) VALUES ('demo-test-customer', 'Test')");
        });
        expect(count('sales')).toBe(demoCounts.sales + 1);
        expect(realHash()).toBe(realBefore.hash);
    });

    it('reset gives the demo shop back as at the start, the real file is not touched', async () => {
        await demo.reset({ lang: 'fr' });
        expect(init.isDemo()).toBe(true);
        expect(api.get("SELECT id FROM customers WHERE id = 'demo-test-customer'")).toBe(null);
        expect(api.get("SELECT id FROM sales WHERE id = 'demo-test-sale'")).toBe(null);
        expect(count('products')).toBe(26);
        expect(count('sales')).toBeGreaterThan(400);
        expect(realHash()).toBe(realBefore.hash);
    });

    it('a reset refuses outside the demo, and only ever removes the demo folder', async () => {
        await demo.exit();
        await expect(demo.reset({})).rejects.toThrow(/DEMO_NOT_ACTIVE/);
        expect(fs.existsSync(REAL_FILE)).toBe(true);
    });

    it('leaving the demo opens the shop\'s own data exactly as it was; nothing is copied over', () => {
        expect(init.isDemo()).toBe(false);
        expect(init.getDbPath()).toBe(REAL_FILE);
        expect(count('sales')).toBe(realBefore.sales);
        expect(count('products')).toBe(realBefore.products);
        expect(count('employees')).toBe(realBefore.employees);
        expect(api.get("SELECT id FROM products WHERE id LIKE 'demo-%'")).toBe(null);
        expect(api.get("SELECT key FROM settings WHERE key = 'demo_shop'")).toBe(null);
        expect(realHash()).toBe(realBefore.hash);
    });

    it('a real sale after leaving is saved in the real file; the demo keeps its own data', async () => {
        api.run("INSERT INTO sales (id, receipt_number, subtotal, total, status) VALUES ('real-sale-2', 'R-2', 1000, 1000, 'completed')");
        init.saveDatabase();
        const afterReal = realHash();
        expect(afterReal).not.toBe(realBefore.hash);
        // Back in the demo: opened as it is (not created again), without the real sale
        const again = await demo.enter({ lang: 'fr' });
        expect(again.created).toBe(false);
        expect(api.get("SELECT id FROM sales WHERE id = 'real-sale-2'")).toBe(null);
        expect(count('products')).toBe(26);
        expect(realHash()).toBe(afterReal);
        await demo.exit();
        expect(api.get("SELECT id FROM sales WHERE id = 'real-sale-2'")).not.toBe(null);
    });

    it('a restart always opens the shop\'s own data', async () => {
        await demo.enter({ lang: 'fr' });
        expect(init.isDemo()).toBe(true);
        // What the program does at start: the profile is the shop's
        init.setProfile('real');
        await init.initDatabase();
        expect(init.isDemo()).toBe(false);
        expect(api.get("SELECT id FROM products WHERE id = 'real-jean'")).not.toBe(null);
        expect(fs.existsSync(path.join(dir, 'demo', `${BRAND.fileSlug}-demo.db`))).toBe(true);
    });

    it('the demo file path can never be the shop\'s file', () => {
        init.setProfile('demo');
        expect(path.resolve(init.getDbPath())).not.toBe(path.resolve(init.realDbPath()));
        expect(init.getDataRoot()).toBe(path.join(dir, 'demo'));
        init.setProfile('real');
        expect(init.getDataRoot()).toBe(dir);
        expect(() => init.setProfile('other')).toThrow();
    });
});
