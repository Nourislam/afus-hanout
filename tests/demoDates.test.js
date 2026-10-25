import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// The real database module on a temporary data folder (as demo.test.js)
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afus-demo-dates-'));
const electronPath = require.resolve('electron');
require.cache[electronPath] = { id: electronPath, filename: electronPath, loaded: true, exports: { app: { getPath: () => dir } } };
const init = require('../electron/database/init');
const api = require('../electron/database/api');
const { seedDemoShop } = require('../electron/services/demoData');
const ShiftService = require('../electron/services/shiftService');

describe('demo shop built on any day', () => {
    it('never has a drawer below 0 nor a counted cash far from the expected', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        init.setProfile('demo');
        try {
            for (const [i, day] of ['2026-10-11', '2026-11-03', '2027-01-01', '2027-02-14', '2026-12-25'].entries()) {
                init.closeDatabase();
                try { fs.rmSync(init.getDbPath()); } catch { /* first one */ }
                await init.initDatabase();
                api.transaction(() => seedDemoShop(api, { lang: 'fr', imagesDir: path.join(dir, `img${i}`), now: new Date(`${day}T18:00:00`) }));
                const shifts = new ShiftService();
                for (const s of api.all('SELECT id FROM shifts WHERE end_time IS NOT NULL')) {
                    const st = shifts.getShiftStats(s.id);
                    expect(st.expected_cash, `${day} ${s.id}`).toBeGreaterThanOrEqual(0);
                    expect(st.cash_difference, `${day} ${s.id}`).toBeGreaterThanOrEqual(-100);
                    expect(st.cash_difference, `${day} ${s.id}`).toBeLessThanOrEqual(50);
                }
            }
        } finally {
            init.closeDatabase();
            init.setProfile('real');
        }
    }, 120000);

    it('passes the figures check whatever the day and the hour (the stock history in order)', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        const integrity = require('../electron/services/integrityService');
        init.setProfile('demo');
        try {
            // 21/10 at 17:29: a return dated before a later sale of the same piece, that day
            for (const [i, when] of ['2026-10-21T17:29:00', '2026-10-21T21:54:00', '2026-11-03T10:15:00', '2027-02-14T13:40:00'].entries()) {
                init.closeDatabase();
                try { fs.rmSync(init.getDbPath()); } catch { /* first one */ }
                await init.initDatabase();
                api.transaction(() => seedDemoShop(api, { lang: 'fr', imagesDir: path.join(dir, `chk${i}`), now: new Date(when) }));
                const failed = integrity.check(api).checks.filter(c => !c.ok);
                expect(failed, when).toEqual([]);
            }
        } finally {
            init.closeDatabase();
            init.setProfile('real');
        }
    }, 180000);
});
