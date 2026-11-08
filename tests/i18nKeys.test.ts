// Keys built while the program runs (`season.${id}`, a settings tab's hint…)
// and the main process's own texts (tickets, sheets, dialogs): each one exists
// in the three languages. The literal t('…') keys of the window are checked
// in i18n.test.js.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { MESSAGES } from '../src/i18n/messages';

const require = createRequire(import.meta.url);
const main = require('../electron/i18n') as { MESSAGES: Record<string, string[]> };
const ROOT = path.resolve(__dirname, '..');

function files(dir: string, ext: RegExp): string[] {
    return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(e => {
        const rel = path.join(dir, e.name);
        return e.isDirectory() ? files(rel, ext) : ext.test(e.name) ? [rel] : [];
    });
}

describe('keys built while running', () => {
    it('every family of the window\'s texts has all its members', () => {
        const families: [string, (string | number)[]][] = [
            ['season.', ['ramadan', 'eidFitr', 'eidAdha', 'rentree']],
            ['hijri.month.', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]],
            ['devices.role.', ['phone', 'kiosk']],
            ['ask.q.', ['bestThisWeek', 'profitToday', 'whoOwes', 'runningOut', 'notSelling']],
        ];
        const missing = families.flatMap(([prefix, ids]) => ids.map(id => `${prefix}${id}`)).filter(k => !MESSAGES[k as keyof typeof MESSAGES]);
        expect(missing).toEqual([]);
    });

    it('every section of the settings has its title and its hint', () => {
        const page = fs.readFileSync(path.join(ROOT, 'src/pages/SettingsPage.jsx'), 'utf8');
        const block = page.slice(page.indexOf('const tabIds = ['), page.indexOf('];', page.indexOf('const tabIds = [')));
        const ids = [...block.matchAll(/'([a-zA-Z]+)'/g)].map(m => m[1]);
        expect(ids.length).toBeGreaterThan(8);
        const missing = ids.flatMap(id => [`settings.tab.${id}`, `settings.tabHint.${id}`]).filter(k => !MESSAGES[k as keyof typeof MESSAGES]);
        expect(missing).toEqual([]);
    });
});

describe('the main process\'s texts', () => {
    it('every T(\'…\') key used by the main process exists in the three languages', () => {
        const missing = new Set<string>();
        let used = 0;
        for (const file of files('electron', /\.(js|ts|cjs|mjs)$/)) {
            const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
            for (const m of code.matchAll(/\b(?:T|shopT|tr)\(\s*'([a-z][a-zA-Z0-9_.]+)'/g)) {
                used += 1;
                if (!main.MESSAGES[m[1]]) missing.add(`${m[1]} (${file})`);
            }
        }
        expect(used).toBeGreaterThan(100);
        expect([...missing]).toEqual([]);
        const incomplete = Object.entries(main.MESSAGES).filter(([, v]) => !Array.isArray(v) || v.length !== 3 || v.some(s => !String(s).trim())).map(([k]) => k);
        expect(incomplete).toEqual([]);
    });
});
