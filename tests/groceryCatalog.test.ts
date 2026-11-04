// Saving a grocery article: unit, carton (pieces, price, barcode), scale
// number (PLU) and official price, with the checks that keep codes unique.
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { createShop } from './helpers/shop';

const require = createRequire(import.meta.url);
const catalog = require('../electron/services/catalogService');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let api: any;

const codeOf = (fn: () => unknown): string | null => { try { fn(); } catch (e) { return (e as { code?: string }).code ?? null; } return null; };
const save = (product: Record<string, unknown>, isNew = true) => catalog.saveProduct(api, product, [], { isNew });

beforeEach(async () => {
    ({ api } = await createShop());
});

describe('grocery article fields', () => {
    it('unit, carton, scale number and official price are kept; the carton barcode is the carton\'s', () => {
        save({ id: 'milk', name: 'Lait sachet', barcode: '6130000000011', price: 25, cost: 22, stock_quantity: 100,
            carton_qty: 24, carton_price: 570, carton_barcode: '6130000000028', capped_price: 25 });
        save({ id: 'tomato', name: 'Tomates', price: 120, stock_quantity: 5000, unit: 'kg', plu: 42 });
        expect(api.get("SELECT unit, carton_qty, carton_price, capped_price, plu FROM products WHERE id = 'milk'"))
            .toEqual({ unit: 'piece', carton_qty: 24, carton_price: 570, capped_price: 25, plu: null });
        expect(api.get("SELECT unit, plu, stock_quantity FROM products WHERE id = 'tomato'")).toEqual({ unit: 'kg', plu: 42, stock_quantity: 5000 });
        expect(api.all("SELECT barcode, kind FROM product_barcodes WHERE product_id = 'milk'")).toEqual([{ barcode: '6130000000028', kind: 'carton' }]);
        expect(catalog.lookupCode(api, '6130000000028').carton).toBe(true);
    });

    it('a new carton barcode replaces the old one; an empty one removes it; no carton price without a carton', () => {
        save({ id: 'milk', name: 'Lait', price: 25, carton_qty: 24, carton_barcode: '6130000000028' });
        save({ id: 'milk', name: 'Lait', price: 25, carton_qty: 24, carton_barcode: '6130000000035' }, false);
        expect(api.all("SELECT barcode FROM product_barcodes WHERE product_id = 'milk'")).toEqual([{ barcode: '6130000000035' }]);
        save({ id: 'milk', name: 'Lait', price: 25, carton_qty: '', carton_price: 570, carton_barcode: '' }, false);
        expect(api.all("SELECT barcode FROM product_barcodes WHERE product_id = 'milk'")).toEqual([]);
        expect(api.get("SELECT carton_qty, carton_price FROM products WHERE id = 'milk'")).toEqual({ carton_qty: null, carton_price: null });
    });

    it('two articles cannot have the same scale number', () => {
        save({ id: 'tomato', name: 'Tomates', price: 120, unit: 'kg', plu: 42 });
        expect(codeOf(() => save({ id: 'onion', name: 'Oignons', price: 80, unit: 'kg', plu: 42 }))).toBe('ID_TAKEN');
    });

    it('a carton barcode cannot be another article\'s code, and another article cannot take it', () => {
        save({ id: 'milk', name: 'Lait', price: 25, carton_qty: 24, carton_barcode: '6130000000028' });
        expect(codeOf(() => save({ id: 'oil', name: 'Huile', price: 650, carton_qty: 6, carton_barcode: 'CEIN-1' }))).toBe(null);
        expect(codeOf(() => save({ id: 'sugar', name: 'Sucre', price: 90, barcode: '6130000000028' }))).toBe('ID_TAKEN');
        save({ id: 'belt2', name: 'X', price: 1, barcode: '6130000000042' });
        expect(codeOf(() => save({ id: 'coffee', name: 'Café', price: 300, carton_qty: 12, carton_barcode: '6130000000042' }))).toBe('ID_TAKEN');
    });

    it('a capped price lower than the selling price is refused when saving', () => {
        expect(codeOf(() => save({ id: 'bread', name: 'Pain', price: 10, capped_price: 7.5 }))).toBe('PRICE_ABOVE_CAP');
        save({ id: 'bread', name: 'Pain', price: 7.5, capped_price: 7.5 });
        expect(api.get("SELECT price, capped_price FROM products WHERE id = 'bread'")).toEqual({ price: 7.5, capped_price: 7.5 });
    });
});
