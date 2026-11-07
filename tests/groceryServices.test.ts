// Flexy and other services: the amount is typed at the till, the shop earns
// its margin, there is no stock. Sold on a ticket so the drawer matches.
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { createShop } from './helpers/shop';
import { useCartStore } from '../src/stores/cartStore';
import { serviceCost } from '../electron/shared/grocery';

const require = createRequire(import.meta.url);
const catalog = require('../electron/services/catalogService');
const stock = require('../electron/services/stockService');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let api: any;

beforeEach(async () => {
    ({ api } = await createShop());
});

describe('services (flexy)', () => {
    it('an article «service» keeps its margin, has no stock, and is not in the stock list', () => {
        catalog.saveProduct(api, { id: 'flexy', name: 'Flexy Mobilis', price: 0, unit: 'service', service_margin: 5 }, [], { isNew: true });
        expect(api.get("SELECT unit, service_margin, stock_quantity FROM products WHERE id = 'flexy'")).toEqual({ unit: 'service', service_margin: 5, stock_quantity: 0 });
        expect(stock.stockLines(api).find((l: { product_id: string }) => l.product_id === 'flexy')).toBeUndefined();
        // Never «out of stock» nor «to order»
        expect(catalog.getLowStock(api).find((l: { product_id: string }) => l.product_id === 'flexy')).toBeUndefined();
    });

    it('its cost is the amount less the margin', () => {
        expect(serviceCost(100, 5)).toBe(95);
        expect(serviceCost(1000, 3.5)).toBe(965);
        expect(serviceCost(200, 0)).toBe(200);
    });

    it('at the till: one line of the amount typed, quantity 1', () => {
        const cart = useCartStore.getState();
        cart.clearCart();
        const flexy = { id: 'flexy', name: 'Flexy Mobilis', price: 0, unit: 'service', service_margin: 5, stock_quantity: 0 };
        expect(cart.addItem(flexy).needsAmount).toBe(true);
        expect(useCartStore.getState().addService(flexy, 500).success).toBe(true);
        expect(useCartStore.getState().items[0]).toMatchObject({ sold_as: 'service', quantity: 1, unit_price: 500, total: 500 });
    });
});
