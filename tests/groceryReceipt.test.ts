// The ticket and the A4 invoice of a grocery sale: a weighed line shows its
// weight and its price per kg, and the piece count leaves the kilograms apart.
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
import { lineCounts } from '../electron/shared/grocery';

const require = createRequire(import.meta.url);
const electronPath = require.resolve('electron');
require.cache[electronPath] = { id: electronPath, filename: electronPath, loaded: true, exports: { BrowserWindow: vi.fn() } } as never;
const ReceiptService = require('../electron/services/receiptService.js');
const service = new ReceiptService();

const SALE = {
    id: 's1', receipt_number: '202611040024', created_at: '2026-11-04 19:35:00',
    subtotal: 405, discount_amount: 0, tax_amount: 0, total: 405, service_charge: 0,
    items: [
        { product_name: 'Thon', quantity: 2, unit_price: 220, total: 440 - 70 },
        { product_name: 'Oignons', quantity: 1, unit_price: 35, total: 35, weight_grams: 500, sold_as: 'weight' },
    ],
    payments: [{ method: 'cash', amount: 405 }],
};

describe('a weighed line on the documents', () => {
    it('counts: pieces apart from kilograms', () => {
        expect(lineCounts(SALE.items)).toEqual({ pieces: 2, grams: 500 });
        expect(lineCounts([])).toEqual({ pieces: 0, grams: 0 });
    });

    it('the ticket: weight × price per kg, and «2 pcs + 0.5 kg»', () => {
        const ar = service.generateHtml(SALE, { defaultLanguage: 'ar' });
        expect(ar).toMatch(/0\.500 كغ × [^<]*70[^<]*\/كغ/);
        expect(ar).toContain('(2 قطعة + 0.5 كغ)');
        expect(ar).not.toContain('1 × ');
        const fr = service.generateHtml(SALE, { defaultLanguage: 'fr' });
        expect(fr).toMatch(/0,500 kg × [^<]*70[^<]*\/kg/);
        expect(fr).toContain('(2 pcs + 0,5 kg)');
    });

    it('the A4 invoice: the weight in the quantity column, the price per kg', () => {
        const html = service.generateHtml(SALE, { defaultLanguage: 'fr', type: 'invoice' });
        expect(html).toMatch(/<td class="item-qty">0,500 kg<\/td>/);
        expect(html).toMatch(/<td class="item-price">[^<]*70[^<]*\/kg<\/td>/);
    });
});
