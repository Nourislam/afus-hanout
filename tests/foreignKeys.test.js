// SQLite checks the links between tables (and stays on after each save), and a
// supplier with history cannot be deleted: with the checks on, deleting it would
// also delete its payments and returns.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
let init;

beforeAll(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afus-fk-'));
    const ep = require.resolve('electron');
    require.cache[ep] = { id: ep, filename: ep, loaded: true, exports: { app: { getPath: () => dir, isPackaged: false } } };
    const quiet = console.log; console.log = () => {};
    init = require('../electron/database/init');
    await init.initDatabase();
    console.log = quiet;
});

const fkOn = () => init.getDatabase().exec('PRAGMA foreign_keys')[0].values[0][0];

describe('links between tables', () => {
    it('are checked, also after the database is saved', () => {
        expect(init.foreignKeysEnabled()).toBe(true);
        expect(fkOn()).toBe(1);
        expect(() => init.runInsert("INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, total) VALUES ('x', 'no-such-sale', NULL, 'Robe', 1, 100, 100)")).toThrow(/FOREIGN KEY/);
        init.saveDatabase();
        expect(fkOn()).toBe(1);
    });

    it('a supplier with payments is kept; one never used can be deleted', () => {
        const handlers = {};
        const ctx = new Proxy({
            ipcMain: { handle: (name, fn) => { handlers[name] = fn; } },
            getOne: init.getOne, runInsert: init.runInsert, runQuery: init.runQuery, runTransaction: init.runTransaction,
            catalog: require('../electron/services/catalogService'),
        }, { get: (t, k) => (k in t ? t[k] : () => {}) });
        require('../electron/ipc/people')(ctx);
        init.runInsert("INSERT INTO suppliers (id, name) VALUES ('s1', 'Tassili'), ('s2', 'New')");
        init.runInsert("INSERT INTO supplier_payments (id, supplier_id, amount, payment_method) VALUES ('p1', 's1', 5000, 'cash')");
        expect(() => handlers['db:suppliers:delete'](null, 's1')).toThrow(/SUPPLIER_HAS_HISTORY/);
        expect(init.getOne("SELECT COUNT(*) AS n FROM supplier_payments WHERE supplier_id = 's1'").n).toBe(1);
        expect(handlers['db:suppliers:delete'](null, 's2')).toBe(true);
        expect(init.getOne("SELECT COUNT(*) AS n FROM suppliers WHERE id = 's2'").n).toBe(0);
    });
});
