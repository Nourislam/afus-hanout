// Stock value of a grocery shop: an article sold by weight keeps its stock in
// grams and its prices per kg, so its value is kg × price, never grams × price.
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { createShop } from './helpers/shop';

const require = createRequire(import.meta.url);
const stock = require('../electron/services/stockService');
const dashboard = require('../electron/services/dashboardService');
const insights = require('../electron/services/insightsService');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let api: any;

beforeEach(async () => {
    ({ api } = await createShop());
    // Only two simple articles in this shop: the clothing ones are made inactive
    api.run('UPDATE products SET is_active = 0');
    api.run("INSERT INTO products (id, name, price, cost, stock_quantity, unit) VALUES ('tomato', 'Tomates', 120, 80, 5000, 'kg')");
    api.run("INSERT INTO products (id, name, price, cost, stock_quantity) VALUES ('milk', 'Lait', 25, 22, 100)");
});

describe('stock value with articles sold by weight', () => {
    it('the stock list values 5 kg of tomatoes at 400 DA bought, 600 DA sold', () => {
        const tomato = stock.stockLines(api).find((l: { product_id: string }) => l.product_id === 'tomato');
        expect(tomato).toMatchObject({ quantity: 5000, cost_value: 400, retail_value: 600, margin_value: 200 });
    });

    it('home screen and stock list give the same totals; kilograms are not counted as pieces', () => {
        const totals = stock.stockTotals(stock.stockLines(api));
        const home = dashboard.stockValue(api);
        expect(home.cost).toBe(400 + 2200);
        expect(home.retail).toBe(600 + 2500);
        expect(totals.cost).toBe(home.cost);
        expect(totals.retail).toBe(home.retail);
        expect(home.units).toBe(100);
        expect(totals.pieces).toBe(100);
    });

    it('the stock worth (decisions) values them the same way', () => {
        const worth = insights.stockWorth(api, {});
        expect(worth.cost ?? worth.total?.cost).toBe(2600);
    });
});
