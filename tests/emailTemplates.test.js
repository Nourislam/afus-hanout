// The e-mails the shop sends: in its language (right to left in Arabic),
// amounts in dinars (never "$"), customer and article names escaped.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { documentEmail } = require('../electron/services/emailTemplates');
const KINDS = ['receipt', 'credit_payment', 'purchase_order', 'quotation', 'gift_card'];
const doc = { number: 'T-7', date: '2026-10-19 10:00:00', to: 'Ali <script>', amount: 2000, lines: [{ name: 'Robe <b>', qty: 2, price: 3500, total: 7000 }], subtotal: 7000, discount: 500, total: 6500 };

describe('e-mails', () => {
    it('Arabic: right to left, دينار, escaped names, for every document', () => {
        for (const kind of KINDS) {
            const { subject, html } = documentEmail(kind, doc, { businessName: 'بوتيك إسلام', defaultLanguage: 'ar' });
            expect(subject).toMatch(/بوتيك إسلام/);
            expect(html).toMatch(/dir="rtl"/);
            expect(html).toMatch(/د\.ج/);
            expect(html).not.toMatch(/\$\d|<script>|<b>/);
        }
    });

    it('French: left to right, DA', () => {
        const { subject, html } = documentEmail('receipt', doc, { businessName: 'Boutique Islam', defaultLanguage: 'fr' });
        expect(subject).toBe('Ticket n° T-7 — Boutique Islam');
        expect(html).toMatch(/dir="ltr"/);
        expect(html).toMatch(/6\u00a0500\u00a0DA/);
    });

    it('no e-mail template is left in English with dollars', () => {
        for (const file of ['electron/ipc/email.js', 'electron/services/emailService.js']) {
            const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
            expect(src, file).not.toMatch(/\$\$\{|toFixed\(2\)/);
        }
    });
});
