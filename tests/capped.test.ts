// Official prices: the subsidised goods (milk bag, bread, oil, sugar, semolina,
// flour) to review, and a limit per customer when one runs short.
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { createShop } from './helpers/shop';
import { useCartStore } from '../src/stores/cartStore';

const require = createRequire(import.meta.url);
const capped = require('../electron/services/cappedService');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let api: any;

beforeEach(async () => {
    ({ api } = await createShop());
    api.run("INSERT INTO products (id, name, price, stock_quantity, capped_price) VALUES ('milk', 'Lait sachet 1 L', 25, 100, 25)");
    api.run("INSERT INTO products (id, name, price, stock_quantity) VALUES ('oil', 'زيت 5 لتر', 650, 20)");
    api.run("INSERT INTO products (id, name, price, stock_quantity) VALUES ('semolina', 'Semoule 10 kg', 1100, 20)");
    api.run("INSERT INTO products (id, name, price, stock_quantity) VALUES ('soda', 'Soda 2 L', 120, 20)");
});

describe('official prices', () => {
    it('lists the articles with an official price, and the subsidised ones still without one', () => {
        const review = capped.review(api);
        expect(review.capped.map((p: { id: string }) => p.id)).toEqual(['milk']);
        expect(review.suggested.map((p: { id: string }) => p.id).sort()).toEqual(['oil', 'semolina']);
    });
});

describe('a limit per customer when an article runs short', () => {
    it('is saved on the article and refused beyond it in the cart', () => {
        capped.setLimit(api, 'oil', 2);
        expect(api.get("SELECT max_per_customer FROM products WHERE id = 'oil'").max_per_customer).toBe(2);
        capped.setLimit(api, 'oil', 0);
        expect(api.get("SELECT max_per_customer FROM products WHERE id = 'oil'").max_per_customer).toBeNull();

        const cart = useCartStore.getState();
        cart.clearCart();
        const oil = { id: 'oil', name: 'Huile', price: 650, stock_quantity: 20, max_per_customer: 2 };
        expect(cart.addItem(oil, 1).success).toBe(true);
        expect(useCartStore.getState().addItem(oil, 1).success).toBe(true);
        const third = useCartStore.getState().addItem(oil, 1);
        expect(third.success).toBe(false);
        expect(useCartStore.getState().items[0].quantity).toBe(2);
    });
});
