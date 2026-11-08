// A supplier raises his price: the program suggests a new sale price that
// keeps the margin, rounded like a shop writes it, never above the official
// price. One press («طبّق») changes it at the till (and so on the price checker
// and the scale's list) and puts the article in «ملصقات للطباعة».
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { createShop } from './helpers/shop';

const require = createRequire(import.meta.url);
const prices = require('../electron/services/priceService');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let api: any;

beforeEach(async () => {
    ({ api } = await createShop());
    // The activity log comes from init.js on a real installation
    api.run(`CREATE TABLE IF NOT EXISTS system_logs (id TEXT PRIMARY KEY, action_type TEXT NOT NULL, description TEXT NOT NULL,
             details TEXT, employee_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    api.run("INSERT INTO products (id, name, price, cost, stock_quantity) VALUES ('oil5', 'Huile 5 L', 1100, 950, 10)");
    api.run("INSERT INTO products (id, name, price, cost, stock_quantity, capped_price) VALUES ('milk', 'Lait sachet', 25, 22, 100, 25)");
    api.run("INSERT INTO products (id, name, price, cost, stock_quantity, unit) VALUES ('tomato', 'Tomates', 120, 80, 5000, 'kg')");
});

describe('the suggested sale price', () => {
    it('keeps the margin, rounded up to 5 DA from 100 DA, to 1 DA under, to 0.5 DA under 20 DA', () => {
        // 950 → 990: 1100 × 990 / 950 = 1146.3 → 1150
        expect(prices.suggestedPrice({ price: 1100, before: 950, now: 990 })).toEqual({ price: 1150, capped: false });
        expect(prices.suggestedPrice({ price: 60, before: 40, now: 45 })).toEqual({ price: 68, capped: false });
        expect(prices.suggestedPrice({ price: 10, before: 8, now: 8.6 })).toEqual({ price: 11, capped: false });
        expect(prices.suggestedPrice({ price: 7.5, before: 6, now: 6.3 })).toEqual({ price: 8, capped: false });
    });

    it('never above the official price; nothing when the price already keeps the margin', () => {
        expect(prices.suggestedPrice({ price: 25, before: 22, now: 23, capped: 25 })).toBeNull();
        expect(prices.suggestedPrice({ price: 24, before: 22, now: 23, capped: 25 })).toEqual({ price: 25, capped: true });
        expect(prices.suggestedPrice({ price: 1100, before: 950, now: 940 })).toBeNull(); // cheaper: nothing to do
        expect(prices.suggestedPrice({ price: 100, before: 0, now: 90 })).toBeNull();
    });
});

describe('«طبّق»', () => {
    it('changes the price at the till and puts the article in «ملصقات للطباعة» once', () => {
        prices.applyPrice(api, { productId: 'oil5', price: 1150 });
        prices.applyPrice(api, { productId: 'tomato', price: 130 });
        prices.applyPrice(api, { productId: 'oil5', price: 1160 });
        expect(api.get("SELECT price FROM products WHERE id = 'oil5'").price).toBe(1160);
        expect(prices.labelsToPrint(api).map((p: { id: string }) => p.id)).toEqual(['oil5', 'tomato']);
        // A price change is kept in the article's history
        expect(api.get("SELECT COUNT(*) AS n FROM system_logs WHERE action_type = 'price_changed'").n).toBe(3);
    });

    it('refuses a price above the official one, or not a price', () => {
        expect(() => prices.applyPrice(api, { productId: 'milk', price: 26 })).toThrow(/PRICE_ABOVE_CAP/);
        expect(() => prices.applyPrice(api, { productId: 'oil5', price: 0 })).toThrow(/PRICE_INVALID/);
        expect(() => prices.applyPrice(api, { productId: 'nope', price: 10 })).toThrow(/PRODUCT_NOT_FOUND/);
        expect(prices.labelsToPrint(api)).toEqual([]);
    });

    it('a price changed in the article\'s form also puts its label to print; another change does not', () => {
        const catalog = require('../electron/services/catalogService');
        catalog.saveProduct(api, { id: 'oil5', name: 'Huile 5 L', price: 1150, cost: 950 }, [], { isNew: false });
        catalog.saveProduct(api, { id: 'tomato', name: 'Tomates rouges', price: 120, cost: 80, unit: 'kg' }, [], { isNew: false });
        expect(prices.labelsToPrint(api).map((p: { id: string }) => p.id)).toEqual(['oil5']);
    });

    it('the labels page takes them, then the list is empty', () => {
        prices.applyPrice(api, { productId: 'oil5', price: 1150 });
        prices.clearLabelsToPrint(api, ['oil5']);
        expect(prices.labelsToPrint(api)).toEqual([]);
    });
});
