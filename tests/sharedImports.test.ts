// The screens and the main process import helpers from electron/shared/*.ts.
// A name that is not exported is undefined at run time and breaks `vite
// build` (Rollup refuses it), while lint and the tests may not notice.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

function files(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) return e.name === 'node_modules' ? [] : files(full);
        return /\.(jsx?|tsx?|cjs|mjs)$/.test(e.name) ? [full] : [];
    });
}

describe('imports from electron/shared', () => {
    it('every name imported from a shared module is exported by it', async () => {
        const missing: string[] = [];
        const sources = [...files(path.join(ROOT, 'src')), ...files(path.join(ROOT, 'electron'))];
        const pattern = /(?:import\s*\{([^}]*)\}\s*from|const\s*\{([^}]*)\}\s*=\s*require\()\s*['"]([^'"]*shared\/[\w.-]+\.ts)['"]/g;
        for (const file of sources) {
            const text = fs.readFileSync(file, 'utf8');
            for (const m of text.matchAll(pattern)) {
                const target = path.resolve(path.dirname(file), m[3]);
                const exported = await import(target);
                for (const part of (m[1] ?? m[2]).split(',')) {
                    const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+|\s*:\s*/)[0];
                    if (name && !(name in exported) && !/^[A-Z]\w*$/.test(name)) missing.push(`${path.relative(ROOT, file)}: ${name}`);
                }
            }
        }
        expect(missing).toEqual([]);
    });
});
