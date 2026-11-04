// Afus Hanout speaks to a grocery shop: no other product's name, no website
// and no clothes (garments, colours and sizes) anywhere in the interface or in
// the documents it prints.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { MESSAGES } from '../src/i18n/messages';

const require = createRequire(import.meta.url);
const main = require('../electron/i18n') as { MESSAGES: Record<string, string[]> };

const FORBIDDEN = /Boutique|بوتيك|الموقع/;
// A label's size (مقاس الملصق) is not clothing: only garments and colour/size of an article
const CLOTHING = new RegExp([
    'ملابس', 'تيشيرت', 'سروال', 'سراويل', 'جينز', 'فستان', 'فساتين', 'قميص', 'أحذية', 'نسيج', 'مقاسات', 'المقاسات',
    'لون ?/ ?مقاس', 'اللون ?/ ?المقاس', 'ألوان(?:ها)? ?و ?مقاسات', 'مقاسًا بمقاس', 'مقاس ?/ ?لون', 'المقاس ?/ ?اللون',
    'T-shirt', '\\bjeans?\\b', 'vêtements?', 'clothes', 'clothing', 'chaussures?', '\\bshoes?\\b', '\\brobes?\\b', 'chemise', 'textile',
    'colou?rs? ?(?:and|/) ?sizes?', 'sizes? ?(?:and|/) ?colou?rs?', 'couleurs? ?(?:et|/) ?tailles?', 'tailles? ?(?:et|/) ?couleurs?',
    'size by size', 'taille par taille',
].join('|'), 'i');

function offending(messages: Record<string, unknown>, rule = FORBIDDEN): string[] {
    return Object.entries(messages)
        .filter(([, texts]) => (Array.isArray(texts) ? texts : [texts]).some(t => rule.test(String(t))))
        .map(([key]) => key);
}

describe('the shop\'s words', () => {
    it('no "Boutique" and no website (الموقع) in the interface texts', () => {
        expect(offending(MESSAGES as Record<string, unknown>)).toEqual([]);
    });

    it('nor in the tickets, documents and Excel files of the main process', () => {
        expect(offending(main.MESSAGES)).toEqual([]);
    });

    it('no clothes: no garments, no colour or size of an article, in the interface or the documents', () => {
        expect(offending(MESSAGES as Record<string, unknown>, CLOTHING)).toEqual([]);
        expect(offending(main.MESSAGES, CLOTHING)).toEqual([]);
    });
});

describe('a new shop\'s ready-made categories', () => {
    it('are grocery categories, in the three languages, without clothes', () => {
        const grocery = require('../electron/shared/groceryCatalog.json') as { categories: Record<string, string>[]; defaultCategories: string[] };
        expect(grocery.defaultCategories.length).toBeGreaterThanOrEqual(6);
        for (const code of grocery.defaultCategories) {
            const entry = grocery.categories.find(c => c.code === code);
            expect(entry, code).toBeTruthy();
            for (const lang of ['ar', 'fr', 'en']) {
                expect(entry?.[lang], `${code} ${lang}`).toBeTruthy();
                expect(CLOTHING.test(String(entry?.[lang])), `${code} ${lang}`).toBe(false);
            }
        }
    });
});
