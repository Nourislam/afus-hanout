import { describe, it, expect } from 'vitest';
import { isWeighed, weighedPrice, stockUnits, cartonDeal, aboveCap } from '../electron/shared/grocery.ts';

describe('articles sold by weight', () => {
    it('an article whose unit is kg is weighed', () => {
        expect(isWeighed({ unit: 'kg' })).toBe(true);
        expect(isWeighed({ unit: 'piece' })).toBe(false);
        expect(isWeighed({})).toBe(false);
    });

    it('the price of a weighed line is the price per kg times the weight, in dinars and centimes', () => {
        expect(weighedPrice(120, 1250)).toBe(150);
        expect(weighedPrice(85, 330)).toBe(28.05);
        expect(weighedPrice(99.99, 1)).toBe(0.1);
        expect(weighedPrice(120, 0)).toBe(0);
    });

    it('a weighed line moves its grams in stock; any other line its quantity', () => {
        expect(stockUnits({ quantity: 1, weight_grams: 750 })).toBe(750);
        expect(stockUnits({ quantity: 24 })).toBe(24);
        expect(stockUnits({ quantity: 3, weight_grams: null })).toBe(3);
    });
});

describe('cartons', () => {
    const milk = { price: 25, carton_qty: 24, carton_price: 570 };

    it('one carton is its pieces, with the carton price as a discount on the line', () => {
        expect(cartonDeal(milk)).toEqual({ quantity: 24, discount: 30 });
        expect(cartonDeal(milk, 2)).toEqual({ quantity: 48, discount: 60 });
    });

    it('no carton price, or one dearer than its pieces: no discount', () => {
        expect(cartonDeal({ price: 25, carton_qty: 12 })).toEqual({ quantity: 12, discount: 0 });
        expect(cartonDeal({ price: 25, carton_qty: 12, carton_price: 400 })).toEqual({ quantity: 12, discount: 0 });
    });

    it('an article without a carton of 2 pieces or more has no carton', () => {
        expect(cartonDeal({ price: 25 })).toBeNull();
        expect(cartonDeal({ price: 25, carton_qty: 1 })).toBeNull();
    });
});

describe('capped prices (لا يُباع فوق السعر الرسمي)', () => {
    const bread = { capped_price: 7.5 };

    it('a piece price above the official price is refused; at it or under, accepted; half dinars count', () => {
        expect(aboveCap(bread, 8)).toBe(true);
        expect(aboveCap(bread, 7.5)).toBe(false);
        expect(aboveCap(bread, 7)).toBe(false);
    });

    it('for a weighed line the price per kg is compared', () => {
        const semolina = { capped_price: 50 };
        expect(aboveCap(semolina, 25, 500)).toBe(false);
        expect(aboveCap(semolina, 26, 500)).toBe(true);
    });

    it('an article without an official price is never above it', () => {
        expect(aboveCap({}, 1000)).toBe(false);
        expect(aboveCap({ capped_price: null }, 1000)).toBe(false);
    });
});
