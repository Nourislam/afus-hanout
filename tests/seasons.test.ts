// Preparing a season: three weeks before Ramadan 1448 (8 February 2027), the
// shop sees what it sold in Ramadan 1447 (18 February → 19 March 2026), minus
// its stock, in whole cartons or kg. Without a year behind it: the general list.
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { createShop } from './helpers/shop';

const require = createRequire(import.meta.url);
const seasons = require('../electron/services/seasonService');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let api: any;
const NOW = new Date(2027, 0, 20, 9);
const db = (y: number, m: number, d: number) => new Date(y, m - 1, d, 11).toISOString().replace('T', ' ').slice(0, 19);

function sale(id: string, when: string, lines: [string, number, number?][]) {
    api.run('INSERT INTO sales (id, receipt_number, total, subtotal, status, created_at) VALUES (?, ?, 0, 0, ?, ?)', [id, `T-${id}`, 'completed', when]);
    lines.forEach(([p, q, grams], i) => api.run('INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, total, weight_grams) VALUES (?, ?, ?, ?, ?, 0, 0, ?)',
        [`${id}-${i}`, id, p, p, q, grams ?? null]));
}

beforeEach(async () => {
    ({ api } = await createShop());
    api.run("INSERT INTO products (id, name, price, cost, stock_quantity, carton_qty) VALUES ('dates', 'تمر دقلة نور', 600, 450, 4, 12)");
    api.run("INSERT INTO products (id, name, price, cost, stock_quantity) VALUES ('milk', 'Lait sachet', 25, 22, 200)");
    api.run("INSERT INTO products (id, name, price, cost, stock_quantity, unit) VALUES ('frik', 'فريك', 300, 220, 1500, 'kg')");
    api.run("INSERT INTO products (id, name, price, cost, stock_quantity) VALUES ('soap', 'Savon', 80, 60, 3)");
});

describe('the list to prepare a season', () => {
    it('Ramadan from last Ramadan (by the Hijri calendar), minus the stock, in cartons and kg', () => {
        sale('r1', db(2026, 2, 20), [['dates', 30], ['milk', 150], ['frik', 1, 4200]]);
        sale('r2', db(2026, 3, 15), [['dates', 10], ['frik', 1, 1100]]);
        sale('before', db(2026, 2, 10), [['soap', 50]]); // before Ramadan: not counted
        sale('after', db(2026, 3, 25), [['dates', 99]]); // after: not counted
        const list = seasons.prepList(api, 'ramadan', { now: NOW });
        expect(list.season).toMatchObject({ id: 'ramadan', start: '2027-02-08', daysLeft: 19 });
        expect(list.last.start).toBe('2026-02-18');
        expect(list.source).toBe('lastYear');
        // Dates: 40 sold, 4 in stock → 36 = 3 cartons of 12; frik: 5.3 kg sold, 1.5 kg → 4 kg; milk: enough
        expect(list.lines).toEqual([
            expect.objectContaining({ product_id: 'frik', sold: 5300, stock: 1500, quantity: 4000, unit: 'kg' }),
            expect.objectContaining({ product_id: 'dates', sold: 40, stock: 4, quantity: 36, cartons: 3, carton_qty: 12 }),
        ]);
        expect(list.general).toEqual([]);
    });

    it('a shop with no year behind it: the general list, with its articles found by their names', () => {
        const list = seasons.prepList(api, 'ramadan', { now: NOW });
        expect(list.source).toBe('general');
        expect(list.lines).toEqual([]);
        const dates = list.general.find((g: { label: { fr: string } }) => g.label.fr === 'Dattes');
        expect(dates.articles.map((a: { id: string }) => a.id)).toEqual(['dates']);
        const milk = list.general.find((g: { label: { fr: string } }) => g.label.fr === 'Lait et lben');
        expect(milk.articles.map((a: { id: string }) => a.id)).toEqual(['milk']);
        // A staple the shop does not sell yet: shown with no article
        expect(list.general.find((g: { label: { fr: string } }) => g.label.fr === 'Pois chiches').articles).toEqual([]);
    });

    it('the seasons coming: Ramadan three weeks before, nothing in December', () => {
        expect(seasons.upcoming(NOW)).toEqual([{ id: 'ramadan', start: '2027-02-08', end: expect.any(String), daysLeft: 19 }]);
        expect(seasons.upcoming(new Date(2026, 11, 1))).toEqual([]);
    });

    it('names match without accents or Arabic letter forms', () => {
        expect(seasons.fold('Concentré')).toBe(seasons.fold('concentre'));
        expect(seasons.fold('أكياس')).toBe(seasons.fold('اكياس'));
    });
});
