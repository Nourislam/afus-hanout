// The main process handlers live in electron/ipc, one file per topic: each file
// registers its channels with what main.js hands it, and no channel twice.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const DIR = path.join(__dirname, '../electron/ipc');

describe('IPC files', () => {
    it('every file registers its channels once, and main.js loads every file', () => {
        const Module = require('module');
        const load = Module._load;
        const stub = () => new Proxy(function () {}, { get: (f, k) => (k === Symbol.toPrimitive ? () => '' : f), apply: () => undefined, construct: () => ({}) });
        Module._load = function (request, ...rest) { return request === 'electron' ? new Proxy({}, { get: stub }) : load.call(this, request, ...rest); };
        const channels = [];
        const ipcMain = { handle: (c) => channels.push(c), on: (c) => channels.push(c) };
        const ctx = new Proxy({ ipcMain }, { get: (t, k) => (k in t ? t[k] : stub()) });
        const files = fs.readdirSync(DIR);
        try {
            for (const f of files) require(path.join(DIR, f))(ctx);
        } finally { Module._load = load; }
        // Afus Hanout has no website, online store, shops link or e-mail channels
        expect(channels.length).toBeGreaterThan(250);
        expect(channels.filter((c, i) => channels.indexOf(c) !== i)).toEqual([]);
        const main = fs.readFileSync(path.join(DIR, '../main.js'), 'utf8');
        for (const f of files) expect(main, f).toContain(`require('./ipc/${f.replace(/\.js$/, '')}')(ipcContext);`);
    });
});
