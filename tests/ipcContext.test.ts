// Each file of electron/ipc takes its tools from the context main.js hands it
// (`const { a, b } = ctx;`). A name main.js no longer passes is undefined at run
// time: the handler only fails when a shop uses it (restoring a backup, opening
// the demo...). This test reads both sides so it fails first.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');

/** The names of `const ipcContext = { ... };` in main.js (plain, shorthand, getters and setters). */
function contextNames(): Set<string> {
    const main = read('electron/main.js');
    const start = main.indexOf('const ipcContext = {');
    const body = main.slice(start, main.indexOf('\n};', start));
    const names = new Set<string>();
    for (const m of body.matchAll(/^\s+(?:get |set )?([A-Za-z_$][\w$]*)\s*(?:[,:(])/gm)) names.add(m[1]);
    return names;
}

/** The names a handler file takes out of ctx. */
function namesTaken(file: string): string[] {
    const text = read(file);
    const taken: string[] = [];
    for (const m of text.matchAll(/const\s*\{([^}]*)\}\s*=\s*ctx\s*;/g)) {
        for (const part of m[1].split(',')) {
            const name = part.trim().split(/[\s:=]/)[0];
            if (name) taken.push(name);
        }
    }
    return taken;
}

describe('IPC context', () => {
    it('main.js passes every name each handler file takes', () => {
        const given = contextNames();
        expect(given.size).toBeGreaterThan(40);
        const missing = fs.readdirSync(path.join(ROOT, 'electron/ipc'))
            .flatMap(f => namesTaken(`electron/ipc/${f}`).filter(n => !given.has(n)).map(n => `${f}: ${n}`));
        expect(missing).toEqual([]);
    });
});
