// The demo shop is tried on the Afus website: the installed program no longer
// offers it (no button, and the main process refuses it), the web demo does.
import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const trialService = require('../electron/services/trialService');
const catalog = require('../electron/services/catalogService');

function handlers() {
    const map = {};
    require('../electron/ipc/app')({
        ipcMain: { handle: (name, fn) => { map[name] = fn; }, on: () => {} },
        app: { getVersion: () => '0', getPath: () => '/tmp', isPackaged: false, on: () => {} },
        BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
        nativeTheme: {}, shell: {}, session: { clear: () => {}, getEmployee: () => null },
        fs: require('fs'), path: require('path'), catalog, trialService,
        isDemo: () => false, getSettingValue: () => ({}), refreshTrial: () => {},
        trialClock: { installedAt: Date.now(), now: Date.now() },
    });
    return map;
}

describe('demo shop offered only in the web demo', () => {
    afterEach(() => { delete globalThis.__AFUS_WEB_DEMO__; });

    it('the installed program: not offered, and opening it is refused', async () => {
        const h = handlers();
        expect(h['trial:status']().demo.available).toBe(false);
        await expect(h['demo:enter'](null, { lang: 'ar' })).rejects.toMatchObject({ message: expect.stringContaining('TRIAL_DEMO_ENDED') });
    });

    it('the web demo (Afus website): offered', () => {
        globalThis.__AFUS_WEB_DEMO__ = { shops: 'shops/' };
        expect(handlers()['trial:status']().demo.available).toBe(true);
    });
});
