// The distributor comes on fixed days. On his day the program proposes what
// is missing until his next visit, rounded up to cartons (kg for weighed
// articles), and the order goes on WhatsApp.
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { createShop } from './helpers/shop';

const require = createRequire(import.meta.url);
const orders = require('../electron/services/visitOrderService');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let api: any;
const SUNDAY = new Date(2026, 10, 8, 9, 0); // a Sunday

beforeEach(async () => {
    ({ api } = await createShop());
    api.run("INSERT INTO suppliers (id, name, phone) VALUES ('dist', 'Laiterie', '0550112233')");
    api.run("INSERT INTO supplier_visits (supplier_id, weekdays) VALUES ('dist', '[0, 3]')"); // Sunday and Wednesday
    api.run("INSERT INTO products (id, name, price, cost, stock_quantity, carton_qty, supplier_id) VALUES ('milk', 'Lait', 25, 22, 12, 24, 'dist')");
    api.run("INSERT INTO products (id, name, price, cost, stock_quantity, unit, supplier_id) VALUES ('tomato', 'Tomates', 120, 80, 3000, 'kg', 'dist')");
    api.run("INSERT INTO products (id, name, price, cost, stock_quantity, min_stock_level, supplier_id) VALUES ('yogurt', 'Yaourt', 25, 20, 20, 5, 'dist')");
    api.run("INSERT INTO products (id, name, price, cost, stock_quantity, supplier_id) VALUES ('other', 'Autre', 25, 20, 0, NULL)");
    // 28 days of sales: 280 bags of milk, 56 kg of tomatoes, 28 yogurts
    api.run("INSERT INTO sales (id, receipt_number, total, subtotal, status, created_at) VALUES ('s1', 'T1', 0, 0, 'completed', '2026-10-30 10:00:00')");
    api.run("INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, total) VALUES ('l1', 's1', 'milk', 'Lait', 280, 25, 7000)");
    api.run("INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, total, weight_grams, sold_as) VALUES ('l2', 's1', 'tomato', 'Tomates', 1, 6720, 6720, 56000, 'weight')");
    api.run("INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, total) VALUES ('l3', 's1', 'yogurt', 'Yaourt', 28, 25, 700)");
});

describe('visit days and the suggested order', () => {
    it('the next visit: from Sunday, Wednesday is in 3 days; from Wednesday, Sunday in 4', () => {
        expect(orders.daysToNextVisit([0, 3], SUNDAY)).toBe(3);
        expect(orders.daysToNextVisit([0, 3], new Date(2026, 10, 11))).toBe(4);
        expect(orders.daysToNextVisit([], SUNDAY)).toBe(7);
        expect(orders.visitsToday(api, SUNDAY).map((v: { supplier_id: string }) => v.supplier_id)).toEqual(['dist']);
        expect(orders.visitsToday(api, new Date(2026, 10, 9))).toEqual([]);
    });

    it('what is missing until the next visit (and one day more), in cartons or kg', () => {
        const lines = orders.suggestedOrder(api, 'dist', { today: SUNDAY });
        // Milk: 10 a day × 4 days − 12 left = 28 → 2 cartons of 24
        // Tomatoes: 2 kg a day × 4 days − 3 kg left = 5 kg
        // Yogurt: 1 a day, 20 left: nothing; the article of another supplier: not here
        expect(lines.map((l: Record<string, unknown>) => [l.product_id, l.quantity, l.cartons ?? null])).toEqual([
            ['milk', 48, 2],
            ['tomato', 5000, null],
        ]);
    });

    it('reorder suggestions count a weighed article in grams, not in weighings', () => {
        const reorder = require('../electron/services/reorderService').reorderSuggestions(api, { since30: '2026-10-01 00:00:00' });
        const tomato = reorder.find((r: { product_id: string }) => r.product_id === 'tomato');
        expect(tomato.sold30).toBe(56000);
    });
});
