// The sales screen's cart with grocery articles: cartons and weighed lines.
import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore } from '../src/stores/cartStore';

const milk = { id: 'milk', name: 'Lait sachet', price: 25, stock_quantity: 60, carton_qty: 24, carton_price: 570 };
const tomato = { id: 'tomato', name: 'Tomates', price: 120, stock_quantity: 2000, unit: 'kg' };
const cart = () => useCartStore.getState();

describe('cart with cartons and weighed lines', () => {
    beforeEach(() => {
        useCartStore.setState({ promotions: [], coupon: '', taxType: 'inclusive', globalTaxRate: 0, taxExempt: false, serviceCharge: 0 });
        cart().clearCart();
    });

    it('a carton is one line of its pieces at the carton price; a second carton joins it', () => {
        expect(cart().addCarton(milk).success).toBe(true);
        expect(cart().items[0]).toMatchObject({ product_id: 'milk', sold_as: 'carton', cartons: 1, quantity: 24, unit_price: 25, discount: 30, total: 570 });
        cart().addCarton(milk);
        expect(cart().items).toHaveLength(1);
        expect(cart().items[0]).toMatchObject({ cartons: 2, quantity: 48, discount: 60, total: 1140 });
    });

    it('pieces and cartons of the same article are two lines, and together they cannot pass the stock', () => {
        const fewMilk = { ...milk, stock_quantity: 40 };
        cart().addItem(fewMilk, 10);
        cart().addCarton(fewMilk);
        expect(cart().items).toHaveLength(2);
        // 10 pieces + 2 cartons = 58 > 40; 40 pieces + 1 carton = 64 > 40
        expect(cart().addCarton(fewMilk).success).toBe(false);
        expect(cart().addItem(fewMilk, 30).success).toBe(false);
        expect(cart().getItemCount()).toBe(34);
    });

    it('+ and − on a carton line add or take one carton', () => {
        cart().addCarton(milk);
        const id = cart().items[0].id;
        cart().updateItemQuantity(id, 25);
        expect(cart().items[0]).toMatchObject({ cartons: 2, quantity: 48, total: 1140 });
        cart().updateItemQuantity(id, 47);
        expect(cart().items[0]).toMatchObject({ cartons: 1, quantity: 24, total: 570 });
    });

    it('an article without a carton cannot be sold by the carton', () => {
        expect(cart().addCarton({ id: 'x', name: 'X', price: 10, stock_quantity: 50 }).success).toBe(false);
    });

    it('a weighed line: its weight, its price for that weight, quantity 1; each weighing is its own line', () => {
        expect(cart().addWeighed(tomato, 750).success).toBe(true);
        cart().addWeighed(tomato, 500);
        expect(cart().items).toHaveLength(2);
        expect(cart().items[0]).toMatchObject({ sold_as: 'weight', weight_grams: 750, quantity: 1, unit_price: 90, total: 90 });
        expect(cart().getTotal()).toBe(150);
    });

    it('a weighed line keeps the price read on a scale label', () => {
        cart().addWeighed(tomato, 1000, 118.5);
        expect(cart().items[0]).toMatchObject({ weight_grams: 1000, unit_price: 118.5, total: 118.5 });
    });

    it('the weights of an article cannot pass its stock; the quantity of a weighed line stays 1', () => {
        cart().addWeighed(tomato, 1500);
        expect(cart().addWeighed(tomato, 600).success).toBe(false);
        expect(cart().updateItemQuantity(cart().items[0].id, 2).success).toBe(false);
    });

    it('an article sold by weight is not added as a piece', () => {
        const result = cart().addItem(tomato);
        expect(result.success).toBe(false);
        expect(result.needsWeight).toBe(true);
        expect(cart().items).toHaveLength(0);
    });

    it('a weighed line follows the customer: wholesale price per kg, and back to retail when the customer leaves', () => {
        const veg = { ...tomato, wholesale_price: 100 };
        cart().setCustomer({ id: 'w', name: 'Grossiste', is_wholesale: 1 });
        cart().addWeighed(veg, 2000);
        expect(cart().items[0]).toMatchObject({ unit_price: 200, price_per_kg: 100 });
        cart().setCustomer(null);
        expect(cart().items[0]).toMatchObject({ unit_price: 240, price_per_kg: 120, total: 240 });
        cart().setCustomer({ id: 'w', name: 'Grossiste', is_wholesale: 1 });
        expect(cart().items[0]).toMatchObject({ unit_price: 200, total: 200 });
    });

    it('a scale label\'s price stays whoever the customer is', () => {
        cart().addWeighed({ ...tomato, wholesale_price: 100 }, 1250, 150);
        cart().setCustomer({ id: 'w', name: 'Grossiste', is_wholesale: 1 });
        expect(cart().items[0]).toMatchObject({ unit_price: 150, total: 150 });
    });

    it('a carton for a wholesale customer: never dearer than its pieces at the wholesale price', () => {
        const wMilk = { ...milk, wholesale_price: 22 };
        cart().setCustomer({ id: 'w', name: 'Grossiste', is_wholesale: 1 });
        cart().addCarton(wMilk);
        expect(cart().items[0]).toMatchObject({ unit_price: 22, discount: 0, total: 528 });
        cart().setCustomer(null);
        expect(cart().items[0]).toMatchObject({ unit_price: 25, discount: 30, total: 570 });
    });

    it('a price agreed on a carton line keeps the carton price as a ceiling, and + / − keep it right', () => {
        cart().addCarton(milk);
        const id = cart().items[0].id;
        cart().setLinePrice(id, 24);
        expect(cart().items[0]).toMatchObject({ unit_price: 24, discount: 6, total: 570 });
        cart().setLinePrice(id, 20);
        expect(cart().items[0]).toMatchObject({ discount: 0, total: 480 });
        cart().updateItemQuantity(id, 48);
        expect(cart().items[0]).toMatchObject({ cartons: 2, quantity: 48, discount: 0, total: 960 });
    });

    it('undo: a cleared ticket comes back as it was (lines, customer, discount)', () => {
        cart().addCarton(milk);
        cart().addWeighed(tomato, 500);
        cart().setCustomer({ id: 'c1', name: 'Amine' });
        cart().setDiscount(10, 'fixed');
        const before = cart().snapshot();
        cart().clearCart();
        expect(cart().items).toHaveLength(0);
        cart().restore(before, cart().items);
        expect(cart().items.map((i: { sold_as?: string }) => i.sold_as)).toEqual(['carton', 'weight']);
        expect(cart().customer).toMatchObject({ id: 'c1' });
        expect(cart().discount).toBe(10);
    });

    it('undo only puts back the ticket it removed: not after a new scan, a sale or a hold', () => {
        cart().addCarton(milk);
        const before = cart().snapshot();
        cart().clearCart();
        const after = cart().items;
        // Something happened since (a scan): «تراجع» does nothing, the new line stays
        cart().addWeighed(tomato, 500);
        expect(cart().restore(before, after)).toBe(false);
        expect(cart().items.map((i: { sold_as?: string }) => i.sold_as)).toEqual(['weight']);
        // Nothing happened since: the ticket comes back
        const again = cart().snapshot();
        cart().clearCart();
        expect(cart().restore(again, cart().items)).toBe(true);
        expect(cart().items).toHaveLength(1);
    });
});
