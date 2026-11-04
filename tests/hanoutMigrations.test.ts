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
