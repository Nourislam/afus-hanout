// A label scale prints an EAN-13 that starts with 2: prefix, the article's
// number (PLU), then its weight or its price, then the check digit.
import { describe, it, expect } from 'vitest';
import { decodeScaleBarcode, DEFAULT_SCALE_FORMAT, isScalePrefix, type ScaleFormat } from '../electron/shared/scaleBarcode';

/** Builds a valid EAN-13 from its first 12 digits. */
function ean(body: string): string {
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
    return body + ((10 - (sum % 10)) % 10);
}

describe('scale barcodes', () => {
    it('the usual label: prefix 21, PLU 00042, weight 01250 → article 42, 1250 g', () => {
        expect(decodeScaleBarcode(ean('210004201250'), DEFAULT_SCALE_FORMAT)).toEqual({ plu: 42, grams: 1250 });
    });

    it('a scale that prints the price: in dinars, or with 2 decimals (half dinars)', () => {
        const dinars: ScaleFormat = { ...DEFAULT_SCALE_FORMAT, value: 'price', decimals: 0 };
        expect(decodeScaleBarcode(ean('220000700350'), dinars)).toEqual({ plu: 7, price: 350 });
        const cents: ScaleFormat = { ...DEFAULT_SCALE_FORMAT, value: 'price', decimals: 2 };
        expect(decodeScaleBarcode(ean('220000701250'), cents)).toEqual({ plu: 7, price: 12.5 });
    });

    it('a 4-digit PLU leaves 6 digits for the value', () => {
        const four: ScaleFormat = { ...DEFAULT_SCALE_FORMAT, pluDigits: 4 };
        expect(decodeScaleBarcode(ean('210042001250'), four)).toEqual({ plu: 42, grams: 1250 });
    });

    it('not a scale label: wrong check digit, other prefix, not 13 digits, PLU 0', () => {
        const good = ean('210004201250');
        const wrong = good.slice(0, 12) + ((Number(good[12]) + 1) % 10);
        expect(decodeScaleBarcode(wrong, DEFAULT_SCALE_FORMAT)).toBeNull();
        expect(decodeScaleBarcode(ean('613000420125'), DEFAULT_SCALE_FORMAT)).toBeNull();
        expect(decodeScaleBarcode(ean('290004201250'), { ...DEFAULT_SCALE_FORMAT, prefixes: ['21'] })).toBeNull();
        expect(decodeScaleBarcode('21000420125', DEFAULT_SCALE_FORMAT)).toBeNull();
        expect(decodeScaleBarcode(ean('210000001250'), DEFAULT_SCALE_FORMAT)).toBeNull();
        expect(decodeScaleBarcode('', DEFAULT_SCALE_FORMAT)).toBeNull();
    });

    it('spaces around a scanned code are ignored', () => {
        expect(decodeScaleBarcode(` ${ean('210004201250')}\n`, DEFAULT_SCALE_FORMAT)).toEqual({ plu: 42, grams: 1250 });
    });

    it('the program never makes article barcodes in the scale prefixes (21–28 by default)', () => {
        expect(isScalePrefix('2100042012509', DEFAULT_SCALE_FORMAT)).toBe(true);
        expect(isScalePrefix('2012345678901', DEFAULT_SCALE_FORMAT)).toBe(false);
        expect(isScalePrefix('2912345678901', DEFAULT_SCALE_FORMAT)).toBe(false);
    });
});

describe('a scale label at the till', async () => {
    const { createRequire } = await import('node:module');
    const { createShop } = await import('./helpers/shop');
    const require = createRequire(import.meta.url);
    const catalog = require('../electron/services/catalogService');

    async function shop() {
        const { api } = await createShop();
        catalog.saveProduct(api, { id: 'tomato', name: 'Tomates', price: 120, stock_quantity: 9000, unit: 'kg', plu: 42 }, [], { isNew: true });
        catalog.saveProduct(api, { id: 'bread', name: 'Pain', price: 10, stock_quantity: 50, barcode: '2012345678906' }, [], { isNew: true });
        return api;
    }

    it('a weight label finds the article by its PLU: 1250 g', async () => {
        const api = await shop();
        const found = catalog.lookupScaleLabel(api, ean('210004201250'), DEFAULT_SCALE_FORMAT);
        expect(found).toMatchObject({ type: 'product', product: { id: 'tomato' }, scale: { grams: 1250 } });
        expect(found.scale.price).toBeUndefined();
    });

    it('a price label: the printed price stays, the weight is price ÷ price per kg', async () => {
        const api = await shop();
        const format: ScaleFormat = { ...DEFAULT_SCALE_FORMAT, value: 'price', decimals: 0 };
        expect(catalog.lookupScaleLabel(api, ean('210004200150'), format)).toMatchObject({ product: { id: 'tomato' }, scale: { grams: 1250, price: 150 } });
    });

    it('nothing when the PLU is unknown, or names an article sold by the piece', async () => {
        const api = await shop();
        expect(catalog.lookupScaleLabel(api, ean('210009901250'), DEFAULT_SCALE_FORMAT)).toBeNull();
        api.run("UPDATE products SET unit = 'piece' WHERE id = 'tomato'");
        expect(catalog.lookupScaleLabel(api, ean('210004201250'), DEFAULT_SCALE_FORMAT)).toBeNull();
    });
});
