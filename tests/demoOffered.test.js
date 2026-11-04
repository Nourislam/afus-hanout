// Afus Hanout has no website: the installed program offers its demo shop for
// the first 3 months after it is installed (trialService), then refuses it.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const trialService = require('../electron/services/trialService');
const catalog = require('../electron/services/catalogService');

function handlers(installedAt = Date.now()) {
    const map = {};
    require('../electron/ipc/app')({
        ipcMain: { handle: (name, fn) => { map[name] = fn; }, on: () => {} },
        app: { getVersion: () => '0', getPath: () => '/tmp', isPackaged: false, on: () => {} },
        BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
        nativeTheme: {}, shell: {}, session: { clear: () => {}, getEmployee: () => null },
        fs: require('fs'), path: require('path'), catalog, trialService,
        isDemo: () => false, getSettingValue: () => ({}), refreshTrial: () => {},
        trialClock: { installedAt, now: Date.now() },
    });
    return map;
}

describe('demo shop of the installed program', () => {
    it('offered in the first 3 months after the install', () => {
        expect(handlers()['trial:status']().demo.available).toBe(true);
    });

    it('after 4 months: not offered, and opening it is refused', async () => {
        const h = handlers(Date.now() - 125 * 86400000);
        expect(h['trial:status']().demo.available).toBe(false);
        await expect(h['demo:enter'](null, { lang: 'ar' })).rejects.toMatchObject({ message: expect.stringContaining('TRIAL_DEMO_ENDED') });
    });
});
