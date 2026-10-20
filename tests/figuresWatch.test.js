// "Check the figures" on its own once a week: due after 7 days only, the result
// kept in the settings, a wrong ticket raises the owner's bar until a new check
// (weekly or by hand) finds everything right again; never on the demo shop.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
let api; const saved = {}; const h = {};
const store = { getSetting: (k) => saved[k] ?? null, saveSetting: (k, v) => { saved[k] = v; } };
const DAY = 86400000;

beforeAll(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afus-watch-'));
    const ep = require.resolve('electron');
    require.cache[ep] = { id: ep, filename: ep, loaded: true, exports: { app: { getPath: () => dir, isPackaged: false } } };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await require('../electron/database/init').initDatabase();
    api = require('../electron/database/api');
});

describe('the weekly figures check', () => {
    const watch = () => require('../electron/services/figuresWatch');

    it('due when never checked, then only 7 days later', () => {
        const now = Date.UTC(2026, 9, 20, 10);
        expect(watch().due(null, now)).toBe(true);
        expect(watch().due({ at: new Date(now - 6 * DAY).toISOString() }, now)).toBe(false);
        expect(watch().due({ at: new Date(now - 7 * DAY).toISOString() }, now)).toBe(true);
        // A clock set back to before the last check: checked again
        expect(watch().due({ at: new Date(now + 3 * DAY).toISOString() }, now)).toBe(true);
    });

    it('a right shop: checked once, kept, not checked again the same week', () => {
        const now = Date.UTC(2026, 9, 20, 10);
        const first = watch().runIfDue(api, { ...store, now });
        expect(first).toMatchObject({ ok: true, failed: [] });
        expect(saved.figures_watch.at).toBe(new Date(now).toISOString());
        const again = watch().runIfDue(api, { ...store, now: now + 2 * DAY });
        expect(again.at).toBe(first.at);
    });

    it('a ticket whose total does not add up: the next weekly check raises the bar, a check by hand after the fix clears it', () => {
        api.run("INSERT INTO sales (id, receipt_number, subtotal, tax_amount, discount_amount, total, status, created_at) VALUES ('bad', 'T-BAD', 1000, 0, 0, 1500, 'completed', ?)", [new Date().toISOString()]);
        api.run("INSERT INTO sale_items (id, sale_id, product_name, quantity, unit_price, total) VALUES ('bad-1', 'bad', 'Robe', 1, 1000, 1000)");
        const later = Date.UTC(2026, 9, 28, 10);
        const result = watch().runIfDue(api, { ...store, now: later });
        expect(result.ok).toBe(false);
        expect(result.failed.map(f => f.id)).toContain('sale_total');
        // The owner fixes it; "Check now" in Settings keeps the new result
        api.run("UPDATE sales SET total = 1000 WHERE id = 'bad'");
        api.run("INSERT INTO payments (id, sale_id, method, amount) VALUES ('bad-p', 'bad', 'cash', 1000)");
        const report = require('../electron/services/integrityService').check(api);
        expect(report.ok, JSON.stringify(report.checks.filter(c => !c.ok))).toBe(true);
        expect(watch().remember(report, { ...store, now: later + DAY }).ok).toBe(true);
        expect(saved.figures_watch.ok).toBe(true);
    });

    it('through the handlers: the bar is the owner\'s, nothing for the demo shop', () => {
        let demo = false;
        require('../electron/ipc/figures')({ dbApi: api, ipcMain: { handle: (n, f) => { h[n] = f; } }, isDemo: () => demo, getSettingValue: store.getSetting, saveSettingValue: store.saveSetting });
        expect(h['figures:last']()).toMatchObject({ ok: true });
        demo = true;
        expect(h['figures:last']()).toBe(null);
        const guard = require('../electron/services/ipcGuard');
        expect(guard.RULES['figures:last']).toBe('admin');
    });
});
