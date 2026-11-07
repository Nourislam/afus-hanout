// The karni statement sent on WhatsApp: polite, the debts with their dates,
// what is left, and thanks. The owner sends it himself.
import { describe, it, expect } from 'vitest';
import { statementText } from '../src/lib/whatsapp';

const lines = [
    { date: '2026-11-02 10:00:00', left: 1250 },
    { date: '2026-11-04 18:00:00', left: 340 },
];

describe('karni statement on WhatsApp', () => {
    it('Arabic: greeting, each debt with its date, what is left, thanks', () => {
        const text = statementText({ name: 'أمين', shop: 'حانوت النور', lines, owed: 1590, lang: 'ar' });
        expect(text.split('\n')[0]).toBe('السلام عليكم أمين، نتمنى أنكم بخير.');
        expect(text).toContain('حانوت النور');
        expect(text).toMatch(/02\/11\/2026[^\n]*1[\s\u202f\u00a0]?250/);
        expect(text).toMatch(/04\/11\/2026[^\n]*340/);
        expect(text).toMatch(/الباقي[^\n]*1[\s\u202f\u00a0]?590/);
        expect(text.trim().split('\n').pop()).toContain('شكراً');
    });

    it('French, and at most 10 lines then «and N more»', () => {
        const many = Array.from({ length: 13 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')} 10:00:00`, left: 100 }));
        const text = statementText({ name: 'Amine', shop: 'Hanout En-Nour', lines: many, owed: 1300, lang: 'fr' });
        expect(text.startsWith('Bonjour Amine')).toBe(true);
        expect(text.split('\n').filter(l => l.startsWith('• '))).toHaveLength(10);
        expect(text).toContain('3 autres');
    });
});
