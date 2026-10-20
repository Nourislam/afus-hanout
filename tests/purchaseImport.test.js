// A purchase order from the supplier's own Excel file: his titles (French,
// Arabic), his prices written his way, lines matched by code or by name +
// colour + size, the same size twice made one line, and what cannot be
// matched named with its row, never guessed.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
let api; let XLSX; let read;
const file = (rows, name = 'Facture') => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name);
    return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
};

beforeAll(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afus-poimport-'));
    const ep = require.resolve('electron');
    require.cache[ep] = { id: ep, filename: ep, loaded: true, exports: { app: { getPath: () => dir, isPackaged: false } } };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await require('../electron/database/init').initDatabase();
    api = require('../electron/database/api');
    XLSX = require('xlsx');
    read = require('../electron/services/purchaseImport').readSupplierFile;
    api.run("INSERT INTO products (id, name, sku, price, cost, stock_quantity, has_variants) VALUES ('belt', 'Ceinture cuir', 'CEIN-001', 800, 300, 4, 0)");
    api.run("INSERT INTO products (id, name, price, cost, has_variants) VALUES ('robe', 'Robe soirée', 5000, 2500, 1)");
    for (const [id, color, size, sku] of [['rn-m', 'Noir', 'M', 'ROB-NR-M'], ['rn-l', 'Noir', 'L', 'ROB-NR-L'], ['rr-m', 'Rouge', 'M', 'ROB-RG-M']]) {
        api.run('INSERT INTO product_variants (id, product_id, color, size, sku, qr_code, cost, stock_quantity) VALUES (?, ?, ?, ?, ?, ?, NULL, 1)', [id, 'robe', color, size, sku, sku]);
    }
});

describe('a purchase order from the supplier\'s file', () => {
    it('his own layout in French: a title above, then Désignation / Couleur / Taille / Qté / P.U / Montant', () => {
        const result = read(api, file([
            ['SARL Textile Oran — Facture N° 2026/118'],
            [],
            ['Désignation', 'Couleur', 'Taille', 'Qté', 'P.U', 'Montant'],
            ['Robe soirée', 'Noir', 'M', 5, 2400, 12000],
            ['Robe soirée', 'Noir', 'L', 3, '2 400,00 DA', 7200],
            ['Robe soirée', 'Noir', 'M', 2, 2400, 4800],
            ['Robe soirée', 'Black', 'XL', 1, 2400, 2400],
            ['Pull hiver', 'Gris', 'L', 4, 1800, 7200],
            ['Robe soirée', 'Rouge', 'M', 0, 2400, 0],
            ['TOTAL', '', '', 15, '', 33600],
        ]));
        expect(result.found).toBe(true);
        expect(result.lines.map(l => [l.variant_id, l.quantity, l.unit_cost, l.total_cost])).toEqual([
            ['rn-m', 7, 2400, 16800], // the same size twice: one line
            ['rn-l', 3, 2400, 7200],
        ]);
        expect(result.lines[0]).toMatchObject({ product_id: 'robe', product_name: 'Robe soirée', variant_label: 'Noir / M', sku: 'ROB-NR-M' });
        expect(result.problems).toEqual([
            { row: 7, text: 'Robe soirée · Black · XL', error: 'PO_LINE_NO_SIZE' },
            { row: 8, text: 'Pull hiver · Gris · L', error: 'PO_LINE_UNKNOWN' },
            { row: 9, text: 'Robe soirée · Rouge · M', error: 'PO_LINE_QUANTITY' },
        ]);
    });

    it('in Arabic, by code: no price in the file = the article\'s purchase price; a colour in another language still matches', () => {
        const result = read(api, file([
            ['المرجع', 'السلعة', 'اللون', 'المقاس', 'الكمية'],
            ['CEIN-001', '', '', '', 10],
            ['', 'Robe soirée', 'أحمر', 'M', 2],
            ['', 'Robe soirée', '', '', 1],
        ], 'طلبية'));
        expect(result.lines.map(l => [l.key, l.quantity, l.unit_cost])).toEqual([['belt', 10, 300], ['rr-m', 2, 2500]]);
        // Three sizes fit "Robe soirée" without colour or size: asked, not guessed
        expect(result.problems).toEqual([{ row: 4, text: 'Robe soirée', error: 'PO_LINE_NEEDS_SIZE' }]);
    });

    it('a file without quantity or article columns is not read', () => {
        const result = read(api, file([['Nom', 'Téléphone'], ['Karim', '0555']]));
        expect(result).toEqual({ found: false, lines: [], problems: [] });
    });

    it('the lines it gives are saved by the purchase order as they are', () => {
        const { lines } = read(api, file([['Code', 'Qté', 'Prix'], ['ROB-NR-L', 4, 2600]]));
        const math = require('../electron/services/purchaseMath');
        expect(math.poTotals({ items: lines }).subtotal).toBe(10400);
    });
});
