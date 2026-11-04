// Afus Hanout speaks to a grocery shop: no other product's name and no
// website anywhere in the interface or in the documents it prints.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { MESSAGES } from '../src/i18n/messages';

const require = createRequire(import.meta.url);
const main = require('../electron/i18n') as { MESSAGES: Record<string, string[]> };

const FORBIDDEN = /Boutique|بوتيك|الموقع/;

function offending(messages: Record<string, unknown>): string[] {
    return Object.entries(messages)
        .filter(([, texts]) => (Array.isArray(texts) ? texts : [texts]).some(t => FORBIDDEN.test(String(t))))
        .map(([key]) => key);
}

describe('the shop\'s words', () => {
    it('no "Boutique" and no website (الموقع) in the interface texts', () => {
        expect(offending(MESSAGES as Record<string, unknown>)).toEqual([]);
    });

    it('nor in the tickets, documents and Excel files of the main process', () => {
        expect(offending(main.MESSAGES)).toEqual([]);
    });
});
