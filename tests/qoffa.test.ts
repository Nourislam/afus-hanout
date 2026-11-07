// قفة رمضان for an association: N baskets of the same pack, what they take
// from the shelves and what they cost, on a sheet to hand over.
import { describe, it, expect } from 'vitest';
import { qoffaOrder, qoffaSheetHtml } from '../src/lib/qoffa';

const qoffa = { name: 'قفة رمضان', bundle_price: 2500, items: [{ product_name: 'سكر 1 كغ', quantity: 2 }, { product_name: 'زيت <1 لتر>', quantity: 2 }, { product_name: 'عجائن', quantity: 3 }] };

describe('the Ramadan basket for an association', () => {
    it('what N baskets take from the shelves, and their price', () => {
        expect(qoffaOrder(qoffa, 40)).toEqual({
            count: 40,
            lines: [{ name: 'سكر 1 كغ', each: 2, total: 80 }, { name: 'زيت <1 لتر>', each: 2, total: 80 }, { name: 'عجائن', each: 3, total: 120 }],
            total: 100000,
        });
        expect(qoffaOrder(qoffa, 0).count).toBe(1);
    });

    it('the sheet: right to left, names escaped, the totals', () => {
        const html = qoffaSheetHtml(qoffa, 40, { shop: 'حانوت النور', lang: 'ar', date: '07/11/2026' });
        expect(html).toContain('dir="rtl"');
        expect(html).toContain('زيت &lt;1 لتر&gt;');
        expect(html).toContain('<b>120</b>');
        expect(html).toContain('قفة رمضان × 40');
        expect(html).toMatch(/class="total">40\s?قفة × .*2.500.*= .*100.000/);
    });
});
