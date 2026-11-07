// The label scale's articles (phase 7): what is sold by weight with its
// number in the scale (PLU) and its price per kg, as a file for the scale's
// program and as a sheet to type them in by hand. The scale prints the price
// the till charges: a price changed in the program and not in the scale is
// shown until the owner says the scale is up to date.
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { createShop } from './helpers/shop';

const require = createRequire(import.meta.url);
const plu = require('../electron/services/scalePluService');
const { translator } = require('../electron/i18n');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let api: any;

const add = (id: string, name: string, { unit = 'kg', price = 120, plu: n = null as number | null, active = 1 } = {}) =>
    api.run('INSERT INTO products (id, name, price, cost, stock_quantity, unit, plu, is_active) VALUES (?, ?, ?, 0, 5000, ?, ?, ?)', [id, name, price, unit, n, active]);

beforeEach(async () => {
    ({ api } = await createShop());
    add('tomato', 'طماطم', { price: 120, plu: 2 });
    add('onion', 'بصل', { price: 80, plu: 1 });
    add('olives', 'زيتون', { price: 650.5 });
    add('old', 'Old', { price: 10, plu: 9, active: 0 });
    add('milk', 'Lait', { unit: 'piece', price: 25 });
});

describe('the scale\'s articles', () => {
    it('active articles sold by weight with a PLU, by number; the ones without a number apart', () => {
        const list = plu.pluList(api);
        expect(list.rows.map((r: { plu: number; name: string; price: number }) => [r.plu, r.name, r.price])).toEqual([[1, 'بصل', 80], [2, 'طماطم', 120]]);
        expect(list.missing.map((m: { name: string }) => m.name)).toEqual(['زيتون']);
    });

    it('gives the next free numbers to the articles sold by weight that have none', () => {
        expect(plu.assignNumbers(api)).toBe(1);
        expect(api.get("SELECT plu FROM products WHERE id = 'olives'").plu).toBe(10); // after the highest, even an inactive one's
        expect(plu.pluList(api).missing).toEqual([]);
        expect(plu.assignNumbers(api)).toBe(0);
    });
});

describe('what the scale does not know yet', () => {
    it('before the first update: every article is new to the scale', () => {
        const list = plu.pluList(api);
        expect(list.sentAt).toBeNull();
        expect(list.rows.every((r: { change: string }) => r.change === 'new')).toBe(true);
    });

    it('once updated: nothing; then a new price, a new name, a new article, one gone', () => {
        plu.markSent(api, new Date('2026-11-07T10:00:00'));
        let list = plu.pluList(api);
        expect(list.sentAt).toBe(new Date('2026-11-07T10:00:00').toISOString());
        expect(list.rows.map((r: { change: string | null }) => r.change)).toEqual([null, null]);
        expect(list.changed).toBe(0);

        api.run("UPDATE products SET price = 140 WHERE id = 'tomato'");
        api.run("UPDATE products SET name = 'بصل أحمر' WHERE id = 'onion'");
        api.run("UPDATE products SET plu = 3 WHERE id = 'olives'");
        api.run("UPDATE products SET is_active = 0 WHERE id = 'onion'");
        list = plu.pluList(api);
        expect(list.rows.map((r: { plu: number; change: string | null; before?: number }) => [r.plu, r.change, r.before ?? null]))
            .toEqual([[2, 'price', 120], [3, 'new', null]]);
        // The onion left the scale's list: its number is to be emptied in the scale
        expect(list.gone).toEqual([{ plu: 1, name: 'بصل' }]);
        expect(list.changed).toBe(3);
    });
});

describe('the file and the sheet', () => {
    it('a CSV the scale programs read: number, name, price per kg, UTF-8 with its mark', () => {
        const csv = plu.pluCsv(plu.pluList(api).rows, { decimals: 2 });
        expect(csv.startsWith('﻿')).toBe(true);
        expect(csv.slice(1).split('\r\n')).toEqual(['PLU;Name;Price;Unit', '1;بصل;80.00;kg', '2;طماطم;120.00;kg', '']);
        // A name with the separator or quotes stays one field
        expect(plu.pluCsv([{ plu: 4, name: 'Olives "noires"; grosses', price: 650.5 }], { decimals: 0 }).split('\r\n')[1]).toBe('4;"Olives ""noires""; grosses";651;kg');
    });

    it('the sheet to type in by hand: the numbers, names and prices, the changes marked', () => {
        plu.markSent(api);
        api.run("UPDATE products SET price = 140 WHERE id = 'tomato'");
        const T = translator('ar');
        const html = plu.pluSheetHtml(plu.pluList(api), { shop: { businessName: 'حانوت <النور>' }, T, lang: 'ar' });
        expect(html).toContain('dir="rtl"');
        expect(html).toContain('حانوت &lt;النور&gt;');
        expect(html).toContain(T('plu.title'));
        expect(html).toMatch(/<td[^>]*>1<\/td>/);
        expect(html).toContain('طماطم');
        expect(html).toContain('class="changed"');
        // Only the changes, to update the scale quickly
        const only = plu.pluSheetHtml(plu.pluList(api), { shop: {}, T, lang: 'ar', onlyChanged: true });
        expect(only).toContain('طماطم');
        expect(only).not.toContain('بصل');
    });
});
