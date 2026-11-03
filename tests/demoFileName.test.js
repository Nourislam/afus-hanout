import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// A product with another file prefix: the demo shop's file must follow it
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afus-demo-name-'));
const electronPath = require.resolve('electron');
require.cache[electronPath] = { id: electronPath, filename: electronPath, loaded: true, exports: { app: { getPath: () => dir } } };
const brandPath = require.resolve('../electron/brand');
const FAKE = { fileSlug: 'afus-test', databaseFile: 'afus-test.db', dataDirName: 'AfusTest' };
require.cache[brandPath] = {
    id: brandPath, filename: brandPath, loaded: true,
    exports: { BRAND: FAKE, databasePath: (p) => path.join(p, FAKE.databaseFile), dataDirectory: (p) => path.join(p, FAKE.dataDirName) },
};
const init = require('../electron/database/init');

describe('demo shop file name', () => {
    it('uses the product file prefix (brand.json fileSlug)', () => {
        init.setProfile('demo');
        expect(init.getDbPath()).toBe(path.join(dir, 'demo', 'afus-test-demo.db'));
        init.setProfile('real');
        expect(init.getDbPath()).toBe(path.join(dir, 'afus-test.db'));
    });
});
