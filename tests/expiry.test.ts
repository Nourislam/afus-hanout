// «بِعها قبل ما تفسد»: the batches that expire soon, with what is probably
// left of each (the oldest ones are sold first, so the stock left belongs to
// the newest batches).
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { createShop } from './helpers/shop';

const require = createRequire(import.meta.url);
const expiry = require('../electron/services/expiryService');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let api: any;
const TODAY = new Date(2026, 10, 7, 9);

beforeEach(async () => {
    ({ api } = await createShop());
    api.run("INSERT INTO products (id, name, price, cost, stock_quantity) VALUES ('yogurt', 'Yaourt', 25, 20, 30)");
    api.run("INSERT INTO products (id, name, price, cost, stock_quantity) VALUES ('cheese', 'Fromage', 60, 45, 0)");
    // Yogurt: 24 received long ago (expires in 2 days), 24 last week (in 20 days); 30 left
    api.run("INSERT INTO product_batches (id, product_id, expiry_date, quantity, created_at) VALUES ('b1', 'yogurt', '2026-11-09', 24, '2026-10-20 10:00:00')");
    api.run("INSERT INTO product_batches (id, product_id, expiry_date, quantity, created_at) VALUES ('b2', 'yogurt', '2026-11-27', 24, '2026-10-31 10:00:00')");
    // Cheese expiring tomorrow, but none left
    api.run("INSERT INTO product_batches (id, product_id, expiry_date, quantity, created_at) VALUES ('b3', 'cheese', '2026-11-08', 10, '2026-10-25 10:00:00')");
});

describe('sell before it goes off', () => {
    it('6 yogurts of the old batch are probably left, expiring in 2 days; the new batch is not due', () => {
        expect(expiry.sellSoon(api, { days: 7, today: TODAY })).toEqual([
            { product_id: 'yogurt', name: 'Yaourt', expiry_date: '2026-11-09', left: 6, days_left: 2, unit: 'piece' },
        ]);
    });

    it('an expired batch with stock left is shown first, with a negative number of days', () => {
        api.run("UPDATE product_batches SET expiry_date = '2026-11-05' WHERE id = 'b1'");
        expect(expiry.sellSoon(api, { days: 7, today: TODAY })[0]).toMatchObject({ product_id: 'yogurt', left: 6, days_left: -2 });
    });
});
