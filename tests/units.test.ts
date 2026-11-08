// Stock and prices of an article sold by weight read in kg on the screens, never in grams.
import { describe, it, expect } from 'vitest';
import { stockLabel, perUnit, weightLabel } from '../src/lib/units';
import { t } from '../src/i18n';

describe('units on the screens', () => {
    const kg = t('pos.kg');
    const g = t('pos.g');

    it('an article sold by weight: its stock in kg, its price per kg', () => {
        expect(stockLabel({ unit: 'kg', stock_quantity: 32000 })).toBe(`32 ${kg}`);
        expect(stockLabel({ unit: 'kg', stock_quantity: 12500 })).toBe(`12.5 ${kg}`);
        expect(stockLabel({ unit: 'kg', stock_quantity: 750 })).toBe(`750 ${g}`);
        expect(perUnit({ unit: 'kg' })).toBe(`/${kg}`);
    });

    it('an article sold by the piece: its number of pieces, no unit after the price', () => {
        expect(stockLabel({ unit: 'piece', stock_quantity: 24 })).toBe('24');
        expect(stockLabel({ stock_quantity: 3 })).toBe('3');
        expect(perUnit({ unit: 'piece' })).toBe('');
    });

    it('weights to the gram', () => {
        expect(weightLabel(1234)).toBe(`1.234 ${kg}`);
        expect(weightLabel(0)).toBe(`0 ${g}`);
    });
});

describe('a quantity typed for the stock', () => {
    it('kg become grams for an article sold by weight; pieces are whole', async () => {
        const { stockInput } = await import('../src/lib/units');
        expect(stockInput('2', 'kg')).toBe(2000);
        expect(stockInput('2,5', 'kg')).toBe(2500);
        expect(stockInput('0.25', 'kg')).toBe(250);
        expect(stockInput('3', 'piece')).toBe(3);
        expect(stockInput('2.5', 'piece')).toBeNull();
        expect(stockInput('0', 'kg')).toBeNull();
        expect(stockInput('abc')).toBeNull();
        expect(stockInput('-1')).toBeNull();
    });
});
