// Shops link, phase 1: the main shop's catalogue copied into a second shop.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { createShop } from './helpers/shop';
import { createLegacyDb, createApi } from './helpers/testDb';

const require = createRequire(import.meta.url);
const { exportCatalog, importCatalog, checkPackage, mergeCustom } = require('../electron/shops/catalogPackage');
const { applyMigrations } = require('../electron/database/migrations');
const catalog = require('../electron/services/catalogService');

async function emptyShop() {
    const db = await createLegacyDb();
    applyMigrations(db);
    const api = createApi(db);
    const settings = {};
    return { api, settings, getSetting: (k) => settings[k] ?? null, saveSetting: (k, v) => { settings[k] = v; } };
}

async function mainShop() {
    const shop = await createShop();
    shop.api.run("INSERT INTO categories (id, name) VALUES ('cat-j', 'Jeans')");
    shop.api.run("UPDATE products SET category_id = 'cat-j', brand = 'Levis' WHERE id = 'jean'");
    shop.api.run("UPDATE products SET sku = 'CEINT-1' WHERE id = 'belt'");
    return shop;
}

describe('catalogue package', () => {
    it('carries articles, variants, codes and prices, never stock', async () => {
        const { api } = await mainShop();
        const pkg = exportCatalog(api, (k) => (k === 'catalog_custom' ? { sizes: ['XS'] } : null));
        expect(pkg.version).toBe(1);
        const jean = pkg.products.find(p => p.id === 'jean');
        expect(jean.variants.map(v => v.sku).sort()).toEqual(['J-B-40', 'J-N-38', 'J-N-40', 'J-N-42', 'J-N-44']);
        expect(jean.variants.find(v => v.sku === 'J-N-44').price).toBe(3500);
        expect(JSON.stringify(pkg)).not.toMatch(/stock_quantity|supplier_id|image_path|"pin"/);
        expect(pkg.custom).toEqual({ sizes: ['XS'] });
        expect(pkg.categories.map(c => c.name)).toContain('Jeans');
    });

    it('a new shop gets every article with stock 0, the same codes and ids', async () => {
        const main = await mainShop();
        const pkg = exportCatalog(main.api);
        const branch = await emptyShop();
        const counts = importCatalog(branch.api, pkg, branch);
        expect(counts).toMatchObject({ products: 2, variants: 5, conflicts: 0, skipped: 0 });
        expect(counts.categories).toBeGreaterThanOrEqual(1);
        const jean = branch.api.get("SELECT * FROM products WHERE id = 'jean'");
        expect(jean.stock_quantity).toBe(0);
        expect(branch.api.get('SELECT name FROM categories WHERE id = ?', [jean.category_id]).name).toBe('Jeans');
        expect(branch.api.get("SELECT COUNT(*) n FROM brands WHERE name = 'Levis'").n).toBe(1);
        // The main shop's label scans here too
        const found = catalog.lookupCode(branch.api, 'J-N-40');
        expect(found.variant.stock_quantity).toBe(0);
        expect(found.product.id).toBe('jean');
        expect(branch.api.get("SELECT SUM(stock_quantity) s FROM product_variants WHERE product_id = 'jean'").s).toBe(0);
    });

    it('importing twice adds nothing the second time', async () => {
        const main = await mainShop();
        const pkg = exportCatalog(main.api);
        const branch = await emptyShop();
        importCatalog(branch.api, pkg, branch);
        const again = importCatalog(branch.api, pkg, branch);
        expect(again).toMatchObject({ products: 0, variants: 0, categories: 0, brands: 0, skipped: 2 });
        expect(branch.api.get('SELECT COUNT(*) n FROM products').n).toBe(2);
    });

    it('keeps what the shop already has and reports a code used by another article', async () => {
        const main = await mainShop();
        const pkg = exportCatalog(main.api);
        const branch = await emptyShop();
        branch.api.run("INSERT INTO categories (id, name) VALUES ('mine', 'JEANS')");
        // The same belt typed here by hand (same code) and a different article holding the jean's code
        catalog.saveProduct(branch.api, { id: 'my-belt', name: 'ceinture', sku: 'ceint-1', price: 900 }, [], { isNew: true });
        catalog.saveProduct(branch.api, { id: 'other', name: 'Chemise', price: 1500 }, [{ color: 'Blanc', size: 'M', sku: 'J-N-38' }], { isNew: true });
        const counts = importCatalog(branch.api, pkg, branch);
        expect(counts.categories).toBe(0);
        expect(counts.products).toBe(0);
        expect(counts.conflicts).toBe(1);
        expect(branch.api.get("SELECT price FROM products WHERE id = 'my-belt'").price).toBe(900);
    });

    it('adds the main shop’s colours and sizes to the shop’s own', () => {
        expect(mergeCustom({ sizes: ['S'], colors: [] }, { sizes: ['S', 'XS'], colors: [{ name: 'Bordeaux' }] }))
            .toEqual({ sizes: ['S', 'XS'], colors: [{ name: 'Bordeaux' }] });
    });

    it('refuses a package of another shape before writing anything', async () => {
        expect(() => checkPackage({ version: 2, products: [] })).toThrow();
        expect(() => checkPackage({ version: 1, categories: [], brands: [], products: [{ name: 'x' }] })).toThrow();
        const branch = await emptyShop();
        expect(() => importCatalog(branch.api, { version: 1, categories: [{ name: 'A' }], brands: [], products: [{}] }, branch)).toThrow();
        expect(branch.api.get('SELECT COUNT(*) n FROM categories').n).toBe(0);
    });
});
