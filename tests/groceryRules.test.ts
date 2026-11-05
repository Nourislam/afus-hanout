// Rules of the main process for grocery lines, found by the phase 1 review:
// the cashier's discount, the official price at small weights, the server
// checking the units, reservations and exchanges, and the carton barcode.
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { createShop } from './helpers/shop';
import { aboveCap, weighedPrice } from '../electron/shared/grocery';

const require = createRequire(import.meta.url);
const guard = require('../electron/services/guard');
const catalog = require('../electron/services/catalogService');
const reservations = require('../electron/services/reservationService');
const exchanges = require('../electron/services/exchangeService');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let api: any;

beforeEach(async () => {
    ({ api } = await createShop());
    api.run("INSERT INTO products (id, name, price, cost, stock_quantity, unit, capped_price) VALUES ('tomato', 'Tomates', 120, 80, 5000, 'kg', 135)");
    api.run("INSERT INTO products (id, name, barcode, price, wholesale_price, cost, stock_quantity, carton_qty, carton_price) VALUES ('milk', 'Lait', '6130000000011', 25, 22, 22, 100, 24, 570)");
    api.run("INSERT INTO customers (id, name) VALUES ('c1', 'Amine')");
});

const line = (fields: Record<string, unknown>) => ({ discount: 0, ...fields });

describe('the discount a cashier gives by hand', () => {
    it('a weighed line at its weight\'s price is no discount; one cut by hand is', () => {
        const fair = guard.manualDiscount(api, { items: [line({ product_id: 'tomato', quantity: 1, unit_price: 30, weight_grams: 250, sold_as: 'weight' })] });
        expect(fair.amount).toBe(0);
        const cut = guard.manualDiscount(api, { items: [line({ product_id: 'tomato', quantity: 1, unit_price: 200, weight_grams: 3000, sold_as: 'weight' })] });
        expect(cut).toMatchObject({ amount: 160, base: 360 });
    });

    it('the carton price is the shop\'s own price, not a discount; more off the carton is', () => {
        const carton = { product_id: 'milk', quantity: 24, unit_price: 25, sold_as: 'carton' };
        expect(guard.manualDiscount(api, { items: [line({ ...carton, discount: 30 })] }).amount).toBe(0);
        expect(guard.manualDiscount(api, { items: [line({ ...carton, discount: 50 })] }).amount).toBe(20);
    });
});

describe('the official price at any weight', () => {
    it('a line at the capped price per kg is never refused because of rounding', () => {
        for (let g = 100; g <= 3000; g += 5) {
            expect(aboveCap({ capped_price: 135 }, weighedPrice(135, g), g), `${g} g`).toBe(false);
            expect(aboveCap({ capped_price: 145.5 }, weighedPrice(145.5, g), g), `${g} g`).toBe(false);
        }
        expect(aboveCap({ capped_price: 135 }, 16.9, 125)).toBe(true);
    });
});

describe('reservations keep the weight and the carton price', () => {
    it('2 kg of tomatoes put aside take 2000 g; a carton keeps its price; cancelling gives them back', () => {
        const saved = reservations.createReservation(api, {
            customer_id: 'c1', deposit: 0, items: [
                { product_id: 'tomato', product_name: 'Tomates', quantity: 1, unit_price: 240, weight_grams: 2000, sold_as: 'weight' },
                { product_id: 'milk', product_name: 'Lait', quantity: 24, unit_price: 25, discount: 30, sold_as: 'carton' },
            ],
        });
        expect(saved.total).toBe(240 + 570);
        expect(api.get("SELECT stock_quantity FROM products WHERE id = 'tomato'").stock_quantity).toBe(3000);
        expect(api.get("SELECT stock_quantity FROM products WHERE id = 'milk'").stock_quantity).toBe(76);
        expect(saved.items.map((i: Record<string, unknown>) => [i.product_id, i.weight_grams, i.sold_as, i.discount]))
            .toEqual(expect.arrayContaining([['tomato', 2000, 'weight', 0], ['milk', null, 'carton', 30]]));
        reservations.cancelReservation(api, saved.id, { refund: 0 });
        expect(api.get("SELECT stock_quantity FROM products WHERE id = 'tomato'").stock_quantity).toBe(5000);
    });

    it('an article sold by weight cannot be put aside without its weight', () => {
        expect(() => reservations.createReservation(api, {
            customer_id: 'c1', items: [{ product_id: 'tomato', product_name: 'Tomates', quantity: 2, unit_price: 120 }],
        })).toThrow(/WEIGHT_REQUIRED/);
    });
});

describe('an exchange does not hand out an article sold by weight', () => {
    it('the new piece of an exchange cannot be weighed there: refused with a clear reason', () => {
        api.run("INSERT INTO sales (id, receipt_number, total, subtotal, status) VALUES ('s1', 'T-1', 25, 25, 'completed')");
        api.run("INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, total) VALUES ('l1', 's1', 'milk', 'Lait', 1, 25, 25)");
        expect(() => exchanges.previewExchange(api, { sale_id: 's1', sale_item_id: 'l1', quantity: 1, new_product_id: 'tomato' })).toThrow(/WEIGHT_REQUIRED/);
    });
});

describe('the carton\'s barcode', () => {
    it('cannot be the article\'s own barcode (the carton could never be scanned)', () => {
        const code = (() => {
            try { catalog.saveProduct(api, { id: 'milk', name: 'Lait', barcode: '6130000000011', price: 25, carton_qty: 24, carton_barcode: '6130000000011' }, [], { isNew: false }); } catch (e) { return (e as { code?: string }).code; }
            return null;
        })();
        expect(code).toBe('ID_TAKEN');
    });
});
