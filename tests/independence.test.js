import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Afus Hanout is a stand-alone, offline-first product: nothing in it may need
// an account, an activation or a server. It has no website, no online store
// and no e-mail. The only network connection is the update check the shop asks
// for (Settings › About); WhatsApp is only handed a wa.me link. The one server
// is the shop's own, on its WiFi: the phone and the price checker read the
// till computer (off until the owner turns it on; private networks only).
const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

function filesUnder(dir) {
    return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
        const rel = path.join(dir, entry.name);
        if (entry.isDirectory()) return filesUnder(rel);
        return /\.(js|jsx|mjs|cjs|ts|tsx|html)$/.test(entry.name) ? [rel] : [];
    });
}
// The main process: main.js and its IPC handlers (electron/ipc, one file per topic)
const MAIN_FILES = ['electron/main.js', ...fs.readdirSync(path.join(ROOT, 'electron/ipc')).map(f => `electron/ipc/${f}`)];
const readMain = () => MAIN_FILES.map(read).join('\n');
const CODE = [...filesUnder('src'), ...filesUnder('electron'), 'index.html'];

// Where a network connection is allowed, and why
const NETWORK_ALLOWED = {
    // Asked by the shop (Settings › About › check), only when the reseller's
    // installer profile gives an https address; nothing is installed by itself
    'electron/services/updateService.js': 'optional update check, on demand',
    // The price checker page asks the shop's own computer (same address it was loaded from)
    'electron/server/kiosk.html': 'the price checker asks the till computer, on the shop WiFi',
};
// The only file that may listen for connections: the shop's own server
const SERVER_ALLOWED = ['electron/server/localServer.js'];
const NETWORK = /\bfetch\s*\(|node-fetch|nodemailer|axios|XMLHttpRequest|new WebSocket|EventSource|\bhttps?\.(request|get)\s*\(|net\.request|autoUpdater|electron-updater|sendBeacon/;

describe('offline-first core', () => {
    it('opens network connections only in the optional online modules', () => {
        const found = CODE.filter(f => NETWORK.test(read(f)));
        expect(found.filter(f => !NETWORK_ALLOWED[f])).toEqual([]);
    });

    it('the main process opens no network connection (no e-mail, no online store)', () => {
        expect(readMain()).not.toMatch(NETWORK);
    });

    it('no server address is built into the program (only WhatsApp links)', () => {
        const urls = CODE.flatMap(f => [...read(f).matchAll(/https?:\/\/[^\s'"`)]+/g)].map(m => [f, m[0]]))
            .filter(([, url]) => !/^https?:\/\/(localhost|127\.0\.0\.1|www\.w3\.org)/.test(url));
        // wa.me: the credit reminder only hands a WhatsApp link to the system (the program connects to nothing)
        expect(urls.filter(([, url]) => !/^https:\/\/wa\.me\b/.test(url))).toEqual([]);
    });

    it('runs no server but the shop\'s own, on its WiFi (phone and price checker)', () => {
        expect(CODE.filter(f => /createServer\s*\(|\.listen\s*\(/.test(read(f)) && !SERVER_ALLOWED.includes(f))).toEqual([]);
        // That server connects to nothing outside: it only answers
        expect(read('electron/server/localServer.js')).not.toMatch(NETWORK);
    });

    it('needs no account, activation, subscription or plan limit', () => {
        const pattern = /activation_data|licen[cs]e_?key|subscription_?(status|plan)|plan_?limit|max_?(products|employees)|entitlement/i;
        // The one migration that deletes the old activation data is the only allowed mention,
        // with the optional offline licence of a reseller (Settings › About), which only shows a status
        const LICENCE_SCREENS = ['src/components/settings/AboutSettings.jsx', 'src/i18n/messages/about.js'];
        const found = CODE.filter(f => f !== 'electron/database/migrations.js' && !LICENCE_SCREENS.includes(f) && pattern.test(read(f)));
        expect(found).toEqual([]);
    });

    it('the offline licence never blocks anything: no check uses it', () => {
        // Only the About screen reads it; sales, stock, backups and the role checks never do
        for (const f of CODE.filter(f => !MAIN_FILES.includes(f) && f !== 'electron/services/licenseService.js')) {
            expect(read(f), f).not.toMatch(/licenseService|licenseStatus/);
        }
        const main = readMain();
        // Each use sits in the licence function or the two About handlers
        for (const m of main.matchAll(/(?<!function )licenseStatus\(\)|licenseService\.check/g)) {
            const before = main.slice(Math.max(0, m.index - 400), m.index);
            const owner = [...before.matchAll(/ipcMain\.handle\('([^']+)'|function (\w+)/g)].pop();
            expect(owner && (owner[1] || owner[2])).toMatch(/^(about:info|license:set|licenseStatus)$/);
        }
    });

    it('bundles no cloud sync transport: nothing leaves the computer', () => {
        expect(read('electron/sync/SyncManager.js')).toMatch(/const SUPPORTED_PROVIDERS = \[\];/);
    });
});

describe('licence', () => {
    it('keeps the original MIT notice of the source project and its terms', () => {
        const licence = read('LICENSE.txt');
        expect(licence).toMatch(/^MIT License\n/);
        expect(licence).toContain('Copyright (c) 2024 Cirvex Inc.');
        expect(licence).toContain('Permission is hereby granted, free of charge, to any person obtaining a copy');
        expect(licence).toContain('The above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.');
        expect(licence).toContain('THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND');
    });

    it('ships the licence file with the application', () => {
        const pkg = JSON.parse(read('package.json'));
        expect(pkg.license).toBe('MIT');
        expect(pkg.build.files).toContain('LICENSE.txt');
    });
});
