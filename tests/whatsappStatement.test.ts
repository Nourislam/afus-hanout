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

describe('the order to a distributor on WhatsApp', async () => {
    const { orderText } = await import('../src/lib/whatsapp');
    it('greets him, one line per article in cartons, pieces or kg, and thanks', () => {
        const text = orderText({
            supplier: 'Laiterie', shop: 'حانوت النور', lang: 'ar', lines: [
                { name: 'حليب كيس', quantity: 48, cartons: 2, unit: 'piece' },
                { name: 'طماطم', quantity: 5000, unit: 'kg' },
                { name: 'ياغورت', quantity: 6, unit: 'piece' },
            ],
        });
        const lines = text.split('\n');
        expect(lines[0]).toContain('Laiterie');
        expect(text).toContain('• حليب كيس: 2 كرطونة');
        expect(text).toContain('• طماطم: 5 كغ');
        expect(text).toContain('• ياغورت: 6');
        expect(lines[lines.length - 1]).toContain('حانوت النور');
    });
});

describe('the day\'s closing in three lines', () => {
    it('sold, earned about, the karni grew or shrank', async () => {
        const { closingText, whatsappShare } = await import('../src/lib/whatsapp');
        const text = closingText({ shop: 'حانوت النور', lang: 'ar', date: '07/11/2026', summary: { sales: 12500, profit: 2100, karniChange: 900, tickets: 54 } });
        const lines = text.split('\n');
        expect(lines).toHaveLength(4);
        expect(lines[0]).toBe('حانوت النور — 07/11/2026');
        expect(lines[1]).toMatch(/^• بعت .*12\u202f500\u202fد\.ج.*54/);
        expect(lines[2]).toMatch(/^• ربحت تقريباً .*2\u202f100\u202fد\.ج/);
        expect(lines[3]).toMatch(/^• الكريدي زاد .*900\u202fد\.ج/);
        expect(text).toContain('بعت');
        expect(text).toContain('ربحت تقريباً');
        expect(text).toContain('الكريدي زاد');
        // Without the profit (not the owner): two figures only
        const fr = closingText({ shop: 'Hanout', lang: 'fr', date: '07/11/2026', summary: { sales: 500, karniChange: -200, tickets: 3 } });
        expect(fr.split('\n')).toHaveLength(3);
        expect(fr).toContain('Le karni a baissé de 200');
        expect(fr).not.toContain('Gagné');
        expect(whatsappShare('a b')).toBe('https://wa.me/?text=a%20b');
    });
});
