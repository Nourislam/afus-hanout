// New products and best sellers by AFUS's rules (the sales screen's quick buttons).
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import { createShop, sell } from './helpers/shop';

const require = createRequire(import.meta.url);
const { newProducts, bestSellers } = require('../electron/services/storeRankings');
const productImport = require('../electron/services/productImportService');

const NOW = Date.now();
const DAY = 86400000;
const ago = (days) => new Date(NOW - days * DAY).toISOString().replace('T', ' ').slice(0, 19);
const ids = (list) => list.map(r => r.id);
const soldOf = (api) => Object.fromEntries(bestSellers(api, { now: NOW }).map(r => [r.id, r.sold]));
const at = (api, saleId, days) => api.run('UPDATE sales SET created_at = ? WHERE id = ?', [ago(days), saleId]);
function giveBack(api, saleItemId, qty, n = 1) {
    const rid = `ret-${saleItemId}-${n}`;
    api.run('INSERT INTO returns (id, sale_id, return_number, total_refund) VALUES (?, ?, ?, 0)', [rid, saleItemId.split('-')[0], `RET-${rid}`]);
    api.run('INSERT INTO return_items (id, return_id, sale_item_id, product_id, quantity, refund_amount) VALUES (?, ?, ?, NULL, ?, 0)', [`${rid}-i`, rid, saleItemId, qty]);
}

describe('New products: added to AFUS in the last 7 days', () => {
    let api;
    beforeEach(async () => {
        ({ api } = await createShop());
        api.run("UPDATE products SET created_at = ? WHERE id = 'jean'", [ago(30)]);
        api.run("UPDATE products SET created_at = ? WHERE id = 'belt'", [ago(2)]);
    });

    it('7 days back from now, newest first; older, inactive or future ones are not new', () => {
        const save = (id, name) => require('../electron/services/catalogService').saveProduct(api, { id, name, price: 1000, cost: 400, stock_quantity: 3 }, [], { isNew: true });
        save('shirt', 'Chemise'); save('cap', 'Casquette'); save('old', 'Ancien'); save('off', 'Retiré'); save('soon', 'Bientôt');
        api.run("UPDATE products SET created_at = ? WHERE id = 'shirt'", [ago(7 - 1 / 1440)]); // 7 days less one minute
        api.run("UPDATE products SET created_at = ? WHERE id = 'old'", [ago(7 + 1 / 1440)]); // one minute too old
        api.run("UPDATE products SET created_at = ? WHERE id = 'off'", [ago(1)]);
        api.run("UPDATE products SET is_active = 0 WHERE id = 'off'");
        api.run("UPDATE products SET created_at = ? WHERE id = 'soon'", [ago(-1)]);
        // 'cap' keeps the time SQLite gave it (now)
        expect(ids(newProducts(api, { now: NOW + 1000 }))).toEqual(['cap', 'belt', 'shirt']);
    });

    it('however the article was added (product form, Excel import), and the date format of either', () => {
        const report = api.transaction(() => productImport.importProducts(api, [
            { row: 2, name: 'Café importé', stock_quantity: 6, price: 400, cost: 320 },
        ]));
        expect(report.rejected, JSON.stringify(report.rejected)).toEqual([]);
        const imported = api.get("SELECT id FROM products WHERE name = 'Café importé'");
        expect(imported).toBeTruthy();
        api.run("UPDATE products SET created_at = ? WHERE id = 'belt'", [new Date(NOW - 3 * DAY).toISOString()]); // ISO text
        const list = ids(newProducts(api, { now: NOW + 1000 }));
        expect(list).toContain('belt');
        expect(list).toContain(imported.id);
        expect(list).not.toContain('jean');
    });

    it('not related to sales: a new article without sales is new, an old best seller is not', () => {
        const s = sell(api, 's1', [{ product: 'jean', variant: null, qty: 5, price: 3000 }]);
        at(api, s.id, 1);
        expect(ids(newProducts(api, { now: NOW }))).toEqual(['belt']);
        expect(ids(bestSellers(api, { now: NOW }))).toEqual(['jean']);
    });
});

describe('Best sellers: completed sales of the whole shop, last 7 days', () => {
    let api, v;
    beforeEach(async () => { ({ api, v } = await createShop()); });

    it('till sales of the last 7 days; older ones and pending / voided / cancelled sales do not count', () => {
        at(api, sell(api, 'a', [{ product: 'jean', variant: v['J-N-38'], qty: 2, price: 3000 }]).id, 1);
        at(api, sell(api, 'b', [{ product: 'belt', qty: 3, price: 800, name: 'Ceinture' }]).id, 6.9);
        at(api, sell(api, 'c', [{ product: 'belt', qty: 9, price: 800, name: 'Ceinture' }]).id, 7.1); // too old
        for (const [id, status] of [['d', 'voided'], ['e', 'cancelled'], ['f', 'pending']]) {
            at(api, sell(api, id, [{ product: 'jean', variant: v['J-N-40'], qty: 10, price: 3000 }], { status }).id, 1);
        }
        expect(soldOf(api)).toEqual({ belt: 3, jean: 2 });
        expect(ids(bestSellers(api, { now: NOW }))).toEqual(['belt', 'jean']);
    });

    it('returned pieces are taken off line by line (several returns add up, never below 0): no double counting', () => {
        // One sale with two lines of the same article (two colours), another sale of it
        at(api, sell(api, 'a', [{ product: 'jean', variant: v['J-N-38'], qty: 3, price: 3000 }, { product: 'jean', variant: v['J-B-40'], qty: 2, price: 3000 }]).id, 2);
        at(api, sell(api, 'b', [{ product: 'jean', variant: v['J-N-40'], qty: 1, price: 3000 }]).id, 3);
        giveBack(api, 'a-0', 1, 1);
        giveBack(api, 'a-0', 1, 2); // a second return on the same line
        giveBack(api, 'a-1', 5, 1); // more than sold on that line: 0, not -3
        api.run("UPDATE sales SET status = 'partially_refunded' WHERE id = 'a'");
        expect(soldOf(api)).toEqual({ jean: 1 + 1 });
        // A sale fully given back is no best seller
        at(api, sell(api, 'c', [{ product: 'belt', qty: 2, price: 800, name: 'Ceinture' }]).id, 1);
        giveBack(api, 'c-0', 2);
        api.run("UPDATE sales SET status = 'refunded' WHERE id = 'c'");
        expect(soldOf(api)).toEqual({ jean: 2 });
    });
});
