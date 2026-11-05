// Counting the shelves of a grocery: an article sold by weight is counted in
// kg (kept in grams), and its value is kg × price, never grams × price.
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { createShop } from './helpers/shop';

const require = createRequire(import.meta.url);
const counts = require('../electron/services/stockCountService');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let api: any;

beforeEach(async () => {
    ({ api } = await createShop());
    api.run("INSERT INTO products (id, name, barcode, price, cost, stock_quantity, unit) VALUES ('tomato', 'Tomates', '2000000000008', 120, 80, 5000, 'kg')");
    api.run("INSERT INTO products (id, name, barcode, price, cost, stock_quantity) VALUES ('milk', 'Lait', '6130000000011', 25, 22, 10)");
});

describe('stock count with articles sold by weight', () => {
    it('scanning a weighed article opens its line without adding a gram; its weight is typed in kg', () => {
        const count = counts.startCount(api, {});
        counts.scan(api, count.id, '2000000000008');
        const line = counts.scan(api, count.id, '2000000000008');
        expect(line).toMatchObject({ product_id: 'tomato', unit: 'kg', counted: 0 });
        expect(counts.setCounted(api, count.id, line.id, '4.5')).toMatchObject({ counted: 4500, expected: 5000, difference: -500 });
        expect(counts.setCounted(api, count.id, line.id, '4,25').counted).toBe(4250);
        expect(() => counts.setCounted(api, count.id, line.id, 'abc')).toThrow(/COUNT_QUANTITY/);
    });

    it('the summary: 500 g missing at 80 DA/kg is 40 DA; kilograms are not pieces', () => {
        const count = counts.startCount(api, {});
        const tomato = counts.scan(api, count.id, '2000000000008');
        counts.setCounted(api, count.id, tomato.id, '4.5');
        counts.scan(api, count.id, '6130000000011');
        const sum = counts.summary(api, count.id);
        expect(sum).toMatchObject({ pieces_counted: 1, grams_counted: 4500, shortage_pieces: 9, shortage_grams: 500 });
        expect(sum.shortage_value).toBe(9 * 22 + 40);
        counts.confirmCount(api, count.id, { reason: 'inventaire' });
        expect(api.get("SELECT stock_quantity FROM products WHERE id = 'tomato'").stock_quantity).toBe(4500);
    });
});
