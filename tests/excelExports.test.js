// The shop's Excel files, built on the demo shop (3 months of sales) and read
// back: the shop at the top, the title, the columns asked for (name, QR, unit
// prices, totals), real SUBTOTAL formulas whose saved value is the program's
// own figure, Arabic right to left, codes kept as text.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');
let api; let build; let session;
const OUT = process.env.AFUS_XL_OUT || null; // a folder to keep the files (checked with LibreOffice by hand)

beforeAll(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afus-xl-'));
    const ep = require.resolve('electron');
    require.cache[ep] = { id: ep, filename: ep, loaded: true, exports: { app: { getPath: () => dir, isPackaged: false } } };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await require('../electron/database/init').initDatabase();
    api = require('../electron/database/api');
    api.run("INSERT INTO settings (key, value) VALUES ('setup_completed', '\"true\"') ON CONFLICT(key) DO UPDATE SET value = excluded.value");
    await require('../electron/services/demoService').enter({ lang: 'ar' });
    session = require('../electron/services/session');
    session.setEmployee({ id: 'boss', name: 'Patron', role: 'admin' });
    const shop = () => {
        const settings = {};
        for (const row of api.all('SELECT key, value FROM settings')) { try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = row.value; } }
        return { ...settings, ...(settings.store_config || {}), businessRc: '16/00-1234567B22', businessTaxId: '000216123456789', shopLogoDataUri: null };
    };
    const handlers = {};
    ({ build } = require('../electron/ipc/exports')({ dbApi: api, ipcMain: { handle: (n, f) => { handlers[n] = f; } }, session, getShopSettingsForPrint: shop, logSystemAction: () => {}, fs, dialog: {} }));
}, 120000);

async function open(kind, args = {}) {
    const file = await build(kind, { lang: 'ar', ...args });
    if (OUT) fs.writeFileSync(path.join(OUT, `${kind}.xlsx`), file.buffer);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer);
    return { wb, file };
}

/** The table of a sheet: its header row number, labels and data rows. */
function table(ws, firstLabel) {
    let header = 0;
    ws.eachRow((row, n) => { if (!header && row.getCell(1).value === firstLabel) header = n; });
    const labels = ws.getRow(header).values.slice(1);
    return { header, labels, cell: (row, label) => ws.getRow(row).getCell(labels.indexOf(label) + 1) };
}

describe('the stock file', () => {
    it('the shop at the top, the title, right to left, header frozen with filters', async () => {
        const { wb, file } = await open('stock');
        expect(file.fileName).toMatch(/^المخزون - .+ - \d{4}-\d{2}-\d{2}\.xlsx$/);
        const ws = wb.getWorksheet('المخزون');
        expect(ws.views[0].rightToLeft).toBe(true);
        const top = [1, 2, 3, 4, 5, 6, 7].map(n => String(ws.getRow(n).getCell(1).value ?? ws.getRow(n).getCell(2).value ?? '')).join(' | ');
        expect(top).toContain(api.get("SELECT value FROM settings WHERE key = 'store_config'") ? JSON.parse(api.get("SELECT value FROM settings WHERE key = 'store_config'").value).businessName : '');
        expect(top).toContain('س.ت: \u202A16/00-1234567B22\u202C');
        expect(top).toContain('المخزون سلعة بسلعة مع قيمته');
        const { header } = table(ws, 'الرقم');
        expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: header });
        expect(ws.autoFilter).toBeTruthy();
    });

    it('each article: name, codes, pieces or kg, purchase and sale price, totals as formulas = the program figures', async () => {
        const { wb } = await open('stock');
        const ws = wb.getWorksheet('المخزون');
        const { header, labels, cell } = table(ws, 'الرقم');
        // A grocery: no brand, colour, size or QR; pieces and kilograms in their own columns
        expect(labels).toEqual(['الرقم', 'الصنف', 'السلعة', 'المرجع (SKU)', 'الباركود', 'PLU', 'القطع', 'الوزن (كغ)',
            'سعر الشراء للوحدة', 'سعر البيع للوحدة', 'المجموع بسعر الشراء', 'المجموع بسعر البيع', 'الربح المتوقع']);
        const stock = require('../electron/services/stockService');
        const lines = stock.stockLines(api);
        const totals = stock.stockTotals(lines);
        // First data row = the first stock line, value = quantity × its purchase price, as a formula
        const first = header + 1;
        expect(cell(first, 'السلعة').value).toBe(lines[0].name);
        expect(cell(first, 'الباركود').value).toBe(String(lines[0].barcode));
        const value = cell(first, 'المجموع بسعر الشراء').value;
        expect(value.formula).toMatch(/^MAX\(0,G\d+\+H\d+\)\*I\d+$/);
        expect(value.result).toBe(lines[0].cost_value);
        // Totals row: SUBTOTAL formulas, saved value = the program's total
        const totalRow = header + lines.length + 1;
        expect(cell(totalRow, 'الرقم').value).toBe(`المجموع (${lines.length})`);
        expect(cell(totalRow, 'القطع').value).toMatchObject({ formula: `SUBTOTAL(109,G${first}:G${totalRow - 1})`, result: totals.pieces });
        expect(cell(totalRow, 'الوزن (كغ)').value).toMatchObject({ formula: `SUBTOTAL(109,H${first}:H${totalRow - 1})`, result: totals.kg });
        expect(totals.kg).toBeGreaterThan(0);
        expect(cell(totalRow, 'المجموع بسعر الشراء').value.result).toBe(totals.cost);
        expect(cell(totalRow, 'المجموع بسعر البيع').value.result).toBe(totals.retail);
        expect(cell(totalRow, 'الربح المتوقع').value.result).toBe(totals.margin);
        // The home screen shows the same stock value
        const home = require('../electron/services/dashboardService').stockValue(api);
        expect([home.cost, home.retail, home.units]).toEqual([totals.cost, totals.retail, totals.pieces]);
        // Money in dinars, zero as "-"
        expect(cell(first, 'سعر البيع للوحدة').numFmt).toMatch(/"د.ج";.*"-"$/);
    });

    it('an article sold by weight: its stock in kg, valued kg × price per kg', async () => {
        const { wb } = await open('stock');
        const ws = wb.getWorksheet('المخزون');
        const { header, cell } = table(ws, 'الرقم');
        const stock = require('../electron/services/stockService');
        const lines = stock.stockLines(api);
        const at = lines.findIndex(l => l.unit === 'kg' && l.quantity > 0);
        expect(at).toBeGreaterThanOrEqual(0);
        const row = header + 1 + at;
        expect(cell(row, 'السلعة').value).toBe(lines[at].name);
        expect(cell(row, 'الوزن (كغ)').value).toBe(lines[at].quantity / 1000);
        expect(cell(row, 'الوزن (كغ)').numFmt).toMatch(/^#,##0\.000/);
        expect(cell(row, 'القطع').value).toBeNull();
        expect(cell(row, 'المجموع بسعر الشراء').value.result).toBe(lines[at].cost_value);
    });

    it('a second sheet per category adds up to the same totals', async () => {
        const { wb } = await open('stock');
        const ws = wb.getWorksheet('حسب الصنف');
        const { header, labels, cell } = table(ws, 'الصنف');
        let n = header + 1;
        while (cell(n, 'الصنف').value && !String(cell(n, 'الصنف').value).startsWith('المجموع')) n += 1;
        const total = cell(n, 'المجموع بسعر الشراء').value.result;
        const stock = require('../electron/services/stockService');
        expect(total).toBe(stock.stockTotals(stock.stockLines(api)).cost);
        expect(labels).toContain('نسبة الربح');
    });
});

describe('the other files', () => {
    const range = { startDate: '2000-01-01 00:00:00', endDate: '2100-01-01 00:00:00' };

    it('sales journal: every money column totalled (not only HT / TVA / TTC)', async () => {
        const { wb } = await open('journal', { range });
        const ws = wb.worksheets[0];
        const { header, labels, cell } = table(ws, 'التاريخ');
        const journal = require('../electron/services/accountingService').salesJournal(api, range);
        const totalRow = header + journal.rows.length + 1;
        for (const label of ['المبلغ مع الرسم', 'نقدًا', 'بطاقة (CIB / الذهبية)', 'كريدي']) {
            expect(cell(totalRow, label).value.formula, label).toMatch(/^SUBTOTAL\(109,/);
        }
        expect(cell(totalRow, 'المبلغ مع الرسم').value.result).toBe(journal.totals.amount_ttc);
        // Paid in every way = the TTC total
        const paid = ['نقدًا', 'بطاقة (CIB / الذهبية)', 'تحويل / بريدي موب', 'كريدي', 'بطاقة هدية / رصيد', 'أخرى'].reduce((s, l) => s + (cell(totalRow, l).value.result ?? 0), 0); // a 0 is read back as nothing
        expect(Math.abs(paid - journal.totals.amount_ttc)).toBeLessThan(0.05);
        expect(labels).toContain('البائع');
    });

    it('sales line by line: line total = quantity × price − discount, profit after the cost', async () => {
        const { wb } = await open('salesLines', { range });
        const ws = wb.worksheets[0];
        const { header, cell } = table(ws, 'التاريخ');
        const line = cell(header + 1, 'مجموع السطر').value;
        expect(line.formula).toMatch(/^H\d+\*I\d+-J\d+$/);
        const sold = api.get(`SELECT ROUND(SUM(si.total), 2) AS t FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE COALESCE(s.status, 'completed') NOT IN ('voided', 'cancelled')`).t;
        let n = header + 1;
        while (!String(cell(n, 'التاريخ').value ?? '').startsWith('المجموع')) n += 1;
        expect(cell(n, 'مجموع السطر').value.result).toBeCloseTo(sold, 2);
    });

    it('customers, kridi and suppliers: the debts are the same as on their pages', async () => {
        const owed = require('../electron/services/partnersService').customersOverview(api).reduce((s, c) => s + c.owed, 0);
        const { wb: k } = await open('kridi');
        const ws = k.worksheets[0];
        const kpis = [];
        ws.eachRow((row) => { if (row.getCell(1).value === 'مجموع ما على الزبائن') kpis.push(row.getCell(row.cellCount > 6 ? 7 : 6).value ?? row.values.filter(v => typeof v === 'number')[0]); });
        expect(Math.round(kpis[0])).toBe(Math.round(owed));
        const { wb: c } = await open('customers');
        expect(c.worksheets[0].name).toBe('الزبائن');
        const { wb: s } = await open('suppliers');
        const sup = s.worksheets[0];
        const { labels } = table(sup, 'الرقم');
        expect(labels).toEqual(['الرقم', 'المورد', 'الشخص المسؤول', 'الهاتف', 'الطلبيات', 'السلع المستلمة', 'المدفوع', 'المرجع للمورد', 'الباقي له', 'آخر استلام']);
    });

    it('a cashier gets the files without purchase prices', async () => {
        session.setEmployee({ id: 'c', name: 'Caissier', role: 'cashier' });
        const { wb } = await open('salesLines', { range });
        const { labels } = table(wb.worksheets[0], 'التاريخ');
        expect(labels).not.toContain('تكلفة الشراء');
        expect(labels).not.toContain('الربح');
        session.setEmployee({ id: 'boss', name: 'Patron', role: 'admin' });
    });

    it('French: left to right, DA', async () => {
        const file = await build('stock', { lang: 'fr' });
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(file.buffer);
        const ws = wb.getWorksheet('Stock');
        expect(ws.views[0].rightToLeft).toBe(false);
        const { cell, header } = table(ws, 'N°');
        expect(cell(header + 1, "Prix d'achat (unité)").numFmt).toMatch(/"DA"/);
    });
});

describe('the accountant file and the customer statement', () => {
    const exportsOf = require('../electron/services/exportService');
    const month = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

    it('the month in one file: summary, journal, kridi paid in, stock — each summary line is the total of its sheet', async () => {
        const { wb, file } = await open('accountant', { month: month() });
        expect(file.fileName).toMatch(/^ملف المحاسب - .+ \d{4} - /);
        expect(wb.worksheets.map(w => w.name)).toEqual(['ملخص الشهر', 'السجل', 'دفعات الكريدي', 'المخزون', 'حسب الصنف']);
        const range = exportsOf.monthRange(month(), 'ar');
        const { salesJournal } = require('../electron/services/accountingService');
        const journal = salesJournal(api, range);
        expect(journal.rows.length).toBeGreaterThan(0);
        const sum = (rows, k) => Math.round(rows.reduce((t, r) => t + (Number(r[k]) || 0), 0) * 100) / 100;
        const ws = wb.getWorksheet('ملخص الشهر');
        const { header, cell } = table(ws, 'البند');
        const value = (label) => { for (let r = header + 1; r < header + 20; r++) if (cell(r, 'البند').value === label) return cell(r, 'المبلغ').value; return undefined; };
        const sales = journal.rows.filter(r => r.type === 'sale');
        expect(value('المبيعات (بالرسم)')).toBeCloseTo(sum(sales, 'amount_ttc'), 2);
        expect(value('صافي المبيعات (بالرسم)')).toBeCloseTo(journal.totals.amount_ttc, 2);
        expect(value('المبيعات (بالرسم)') + value('المرتجعات (بالرسم)')).toBeCloseTo(value('صافي المبيعات (بالرسم)'), 2);
        expect(value('صافي المبيعات دون رسم (HT)') + value('الرسم (TVA)')).toBeCloseTo(value('صافي المبيعات (بالرسم)'), 2);
        // Every way of paying adds up to the net sales
        const ways = ['مدفوع نقدًا', 'مدفوع بالبطاقة', 'مدفوع بالتحويل', 'مبيع بالكريدي (دَين على الزبائن)', 'مدفوع ببطاقة هدية / رصيد', 'أخرى'];
        expect(ways.reduce((t, w) => t + (value(w) || 0), 0)).toBeCloseTo(journal.totals.amount_ttc, 1);
        // Kridi paid in = its sheet = the database
        const paidIn = api.get('SELECT ROUND(COALESCE(SUM(amount), 0), 2) AS n FROM credit_payments WHERE datetime(created_at) BETWEEN datetime(?) AND datetime(?)', [range.startDate, range.endDate]).n;
        expect(value('دفعات الكريدي المقبوضة هذا الشهر') ?? 0).toBeCloseTo(paidIn, 2);
        const stock = require('../electron/services/stockService');
        expect(value('المخزون بسعر الشراء (اليوم)')).toBeCloseTo(stock.stockTotals(stock.stockLines(api)).cost, 2);
        // The journal sheet holds the month's tickets only
        const j = table(wb.getWorksheet('السجل'), 'التاريخ');
        let lines = 0; wb.getWorksheet('السجل').eachRow((row, n) => { if (n > j.header && row.getCell(2).value && !String(row.getCell(1).value || '').startsWith('المجموع')) lines += 1; });
        expect(lines).toBe(journal.rows.length);
    });

    it('a month with nothing sold gives an empty but well made file', async () => {
        const { wb } = await open('accountant', { month: '2001-02' });
        expect(wb.worksheets.length).toBe(5);
        const sheets = exportsOf.accountantSheets(api, require('../electron/i18n').translator('ar'), { month: '2001-02' });
        expect(sheets[0].rows.find(r => r.item === 'صافي المبيعات (بالرسم)').amount).toBe(0);
        expect(sheets[2].rows).toEqual([]);
    });

    it('a customer statement: each kridi, return and payment, the last balance = what the customer owes on the screens', async () => {
        const partners = require('../electron/services/partnersService');
        const T = require('../electron/i18n').translator('ar');
        const withKridi = api.all('SELECT DISTINCT customer_id AS id FROM credit_sales WHERE customer_id IS NOT NULL');
        expect(withKridi.length).toBeGreaterThan(0);
        for (const { id } of withKridi) {
            const [sheet] = exportsOf.customerStatementSheets(api, T, { customerId: id });
            const history = partners.customerHistory(api, id);
            expect(sheet.balance, sheet.customer.name).toBeCloseTo(history.owed, 2);
            const debit = sheet.rows.reduce((t, r) => t + r.debit, 0);
            const credit = sheet.rows.reduce((t, r) => t + r.credit, 0);
            expect(debit - credit).toBeCloseTo(sheet.balance, 2);
            // One line per kridi and per payment
            expect(sheet.rows.filter(r => r.debit > 0).length).toBe(history.credits.length);
            expect(sheet.rows.filter(r => r.what.startsWith('دفعة')).length).toBe(history.payments.length);
        }
        const { wb, file } = await open('customerStatement', { customerId: withKridi[0].id });
        expect(file.fileName).toMatch(/^كشف حساب /);
        expect(wb.worksheets[0].name).toBe('كشف الحساب');
    });
});

describe('importing back', () => {
    const excel = require('../electron/services/excelService');

    it('the templates, in Arabic and French, are read back by the import: every column found', async () => {
        for (const [type, lang] of [['products', 'ar'], ['products', 'fr'], ['customers', 'ar'], ['suppliers', 'ar'], ['employees', 'fr']]) {
            const buffer = await excel.generateTemplateFile(type, lang);
            const parsed = excel.parseBuffer(buffer);
            const first = parsed.sheets[parsed.sheetNames[0]];
            const found = excel.detectColumnMappings(first.headers, type);
            const fields = excel.getFieldMappings(type);
            expect(found.missingRequired, `${type} ${lang}`).toEqual([]);
            expect(Object.keys(found.mappings).sort(), `${type} ${lang}`).toEqual([...fields.required, ...fields.optional].sort());
            // Nothing under the titles: the example sits on the second sheet (what to write), in the file's language
            expect(first.rows, `${type} ${lang}`).toEqual([]);
            expect(parsed.sheetNames.length).toBe(2);
            const how = parsed.sheets[parsed.sheetNames[1]];
            const flat = [how.headers, ...how.rows].flat().map(String).join(' ');
            if (lang === 'ar') expect(flat, type).toMatch(/مثال \(لا يُستورد\)/);
            const exampleAt = how.rows.findIndex(r => String(r[0]).startsWith(lang === 'ar' ? 'مثال' : 'Exemple'));
            const sample = how.rows.slice(exampleAt + 2).filter(r => r.some(v => v !== '' && v != null));
            const fromExample = excel.validateAndTransform(sample, found.mappings, type);
            expect(fromExample.errors, `${type} ${lang}`).toEqual([]);
            expect(fromExample.valid.length, `${type} ${lang}`).toBe(sample.length);
            if (type === 'products' && lang === 'ar') expect(fromExample.valid[0].name).toBe('سميد 1 كغ');
        }
    });

    it('a counted file made by hand: totals row and empty quantities left out, a line without code named, a 0 kept as 0', () => {
        const XLSX = require('xlsx');
        const sheet = XLSX.utils.aoa_to_sheet([
            ['Comptage du rayon'],
            ['Article', 'Code-barres', 'Quantité'],
            ['Robe', 6131234567890, 4],
            ['Jupe', 'JUP-01', 0],
            ['Écharpe', '', 2],
            ['Veste', 'VES-02', ''],
            ['Total (4)', '', 6],
        ]);
        const book = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(book, sheet, 'Feuil1');
        const read = excel.readCountedSheet(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }));
        expect(read.rows).toEqual([
            { row: 3, code: '6131234567890', quantity: '4' },
            { row: 4, code: 'JUP-01', quantity: '0' },
            { row: 5, code: '', quantity: '2' },
        ]);
    });

    it('the stock file, counted and sent back: the count gets the new quantity, the stock waits for the confirmation', async () => {
        const counts = require('../electron/services/stockCountService');
        const file = await build('stock', { lang: 'ar' });
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(file.buffer);
        const ws = wb.getWorksheet('المخزون');
        const { header, cell } = table(ws, 'الرقم');
        const stock = require('../electron/services/stockService');
        const lines = stock.stockLines(api);
        const piece = lines.findIndex(l => l.unit === 'piece' && l.quantity > 0 && l.barcode);
        const weighed = lines.findIndex(l => l.unit === 'kg' && l.plu && !l.barcode);
        const code = cell(header + 1 + piece, 'الباركود').value;
        const before = cell(header + 1 + piece, 'القطع').value;
        cell(header + 1 + piece, 'القطع').value = before + 3; // three more on the shelf than the program thinks
        // Sold by weight: counted in kg in the file, kept in grams
        // No barcode on loose tomatoes: the file names them by their PLU
        const weighedPlu = cell(header + 1 + weighed, 'PLU').value;
        expect(weighedPlu).toBe(lines[weighed].plu);
        const weighedBefore = lines[weighed].quantity;
        cell(header + 1 + weighed, 'الوزن (كغ)').value = (weighedBefore + 1500) / 1000;
        const sheet = excel.readCountedSheet(Buffer.from(await wb.xlsx.writeBuffer()));
        expect(sheet.found).toBe(true);
        expect(sheet.rows.length).toBe(lines.length); // every line, the totals row is not one
        const withoutCode = lines.filter(l => !(l.qr || l.sku || l.barcode || l.plu)).length;
        const open = counts.currentCount(api) || counts.startCount(api, {});
        const result = counts.importCounted(api, open.id, [...sheet.rows, { row: 999, code: 'NO-SUCH-CODE', quantity: '2' }]);
        expect(result.set).toBe(lines.length - withoutCode);
        // A line without a code is named, not dropped in silence
        expect(result.problems.filter(p => p.error === 'COUNT_NO_CODE').length).toBe(withoutCode);
        expect(result.problems.filter(p => p.error !== 'COUNT_NO_CODE')).toEqual([{ row: 999, code: 'NO-SUCH-CODE', error: 'COUNT_CODE_UNKNOWN', params: { code: 'NO-SUCH-CODE' } }]);
        const of = (productId) => counts.countLines(api, open.id).find(l => l.product_id === productId);
        expect(of(lines.find(x => x.barcode === code).product_id)?.counted).toBe(before + 3);
        expect(of(lines[weighed].product_id)?.counted).toBe(weighedBefore + 1500);
        const changed = counts.countLines(api, open.id).filter(l => l.counted !== l.expected);
        expect(changed.map(l => l.counted - l.expected).sort((a, b) => a - b)).toEqual([3, 1500]);
        counts.cancelCount(api, open.id);
    });
});
