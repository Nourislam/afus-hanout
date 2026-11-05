// Afus Hanout's own migrations, added at the end of electron/database/migrations.js.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { createLegacyDb } from './helpers/testDb';

const require = createRequire(import.meta.url);
const { applyMigrations } = require('../electron/database/migrations') as {
    applyMigrations: (db: SqlDb) => string[];
};

interface SqlDb {
    run: (sql: string, params?: unknown[]) => void;
    exec: (sql: string) => { values: unknown[][] }[];
}

const tables = (db: SqlDb): string[] =>
    (db.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")[0]?.values || []).map(r => String(r[0]));

describe('Hanout migrations', () => {
    it('removes the online store tables an older database may hold (Afus Hanout has no online store)', async () => {
        const db = (await createLegacyDb()) as SqlDb;
        db.run('CREATE TABLE ecommerce_connections (id TEXT PRIMARY KEY)');
        db.run('CREATE TABLE ecommerce_product_mappings (id TEXT PRIMARY KEY)');
        db.run('CREATE TABLE ecommerce_sync_logs (id TEXT PRIMARY KEY)');
        const applied = applyMigrations(db);
        expect(applied).toContain('2026_11_hanout_no_online_store');
        expect(tables(db).filter(t => t.startsWith('ecommerce_'))).toEqual([]);
    });
});

describe('grocery migration (2026_11_hanout_grocery)', () => {
    const columns = (db: SqlDb, table: string): string[] =>
        (db.exec(`PRAGMA table_info(${table})`)[0]?.values || []).map(r => String(r[1]));

    async function upgraded(): Promise<SqlDb> {
        const db = (await createLegacyDb()) as SqlDb;
        expect(applyMigrations(db)).toContain('2026_11_hanout_grocery');
        return db;
    }

    it('articles know their unit, carton, scale number (PLU) and capped price', async () => {
        const db = await upgraded();
        expect(columns(db, 'products')).toEqual(expect.arrayContaining(['unit', 'carton_qty', 'carton_price', 'plu', 'capped_price']));
        db.run("INSERT INTO products (id, name, price) VALUES ('milk', 'Lait', 25)");
        const row = db.exec("SELECT unit, carton_qty, plu, capped_price FROM products WHERE id = 'milk'")[0].values[0];
        expect(row).toEqual(['piece', null, null, null]);
    });

    it('a sale line and a returned line keep the weight of a weighed article', async () => {
        const db = await upgraded();
        expect(columns(db, 'sale_items')).toEqual(expect.arrayContaining(['weight_grams', 'sold_as']));
        expect(columns(db, 'return_items')).toEqual(expect.arrayContaining(['weight_grams']));
    });

    it('two articles cannot share a scale number; articles without one are many', async () => {
        const db = await upgraded();
        db.run("INSERT INTO products (id, name, price, plu) VALUES ('a', 'Tomates', 120, 42)");
        db.run("INSERT INTO products (id, name, price) VALUES ('b', 'Pain', 10), ('c', 'Sucre', 90)");
        expect(() => db.run("INSERT INTO products (id, name, price, plu) VALUES ('d', 'Oignons', 80, 42)")).toThrow();
    });

    it('new tables: barcodes per article (piece or carton), suppliers per article, supplier names, batches, visit days', async () => {
        const db = await upgraded();
        expect(tables(db)).toEqual(expect.arrayContaining(['product_barcodes', 'product_suppliers', 'supplier_item_names', 'product_batches', 'supplier_visits']));
        db.run("INSERT INTO products (id, name, price) VALUES ('milk', 'Lait', 25)");
        db.run("INSERT INTO product_barcodes (barcode, product_id, kind) VALUES ('6130000000011', 'milk', 'carton')");
        expect(() => db.run("INSERT INTO product_barcodes (barcode, product_id, kind) VALUES ('6130000000011', 'milk', 'piece')")).toThrow();
        expect(() => db.run("INSERT INTO product_barcodes (barcode, product_id, kind) VALUES ('6130000000028', 'milk', 'box')")).toThrow();
    });
});

describe('no clothing brands (2026_11_hanout_no_clothing_brands)', () => {
    it('a new shop starts without the clothing brands of the old seed; a brand an article uses stays', async () => {
        const clothing = require('../electron/shared/clothing.json') as { brands: string[] };
        const db = (await createLegacyDb()) as SqlDb;
        // An older database whose articles already name a brand of the seed
        db.run('ALTER TABLE products ADD COLUMN brand TEXT');
        db.run("INSERT INTO products (id, name, price, brand) VALUES ('p1', 'Chaussettes', 100, 'Nike')");
        const applied = applyMigrations(db);
        expect(applied).toContain('2026_11_hanout_no_clothing_brands');
        const left = (db.exec('SELECT name FROM brands ORDER BY name')[0]?.values || []).map(r => String(r[0]));
        expect(left).toEqual(['Nike']);
        expect(clothing.brands.length).toBeGreaterThan(5);
    });
});
