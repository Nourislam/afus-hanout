/**
 * The shop's Excel files (Stock, Articles, Sales, Customers, Kridi, Suppliers...):
 * one look for all of them, made to be read, printed and given to an accountant.
 *
 * Each sheet:
 *   - the shop at the top: logo, name, address, phone, legal numbers (RC, NIF, NIS, AI);
 *   - the file's title in a band, then the period, when it was made and by whom;
 *   - optional key figures (e.g. "Stock at purchase price");
 *   - the table: a header that stays on screen, filters, alternate rows,
 *     amounts in dinars, zeros shown as "-";
 *   - a totals row with real formulas (SUBTOTAL, so a filter recalculates it),
 *     their value saved too so every viewer shows it;
 *   - right to left in Arabic; A4, fitted to the page width, page numbers.
 *
 * Columns: { key, label, type: 'text' | 'code' | 'int' | 'money' | 'percent' | 'date', width?,
 *            total?: 'sum', formula?: (cell) => 'G9*H9' (cell(key) = this row's address) }
 * Percent values are fractions (0.25 = 25 %).
 */
const ExcelJS = require('exceljs');

const NAVY = 'FF1F3A5F';
const NAVY_TEXT = 'FF1F3A5F';
const BAND_TEXT = 'FFFFFFFF';
const ZEBRA = 'FFF4F6FA';
const TOTAL_FILL = 'FFE3EAF4';
const KPI_FILL = 'FFF7F9FC';
const LINE = 'FFD5DCE6';
const MUTED = 'FF5B6575';
const FONT = 'Arial';

const thin = { style: 'thin', color: { argb: LINE } };
const box = { top: thin, left: thin, bottom: thin, right: thin };

const colLetter = (n) => {
    let s = '';
    for (let i = n; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
    return s;
};

/** Number formats: dinars after the amount, decimals only when a column has some, zero = "-". */
function numberFormat(type, { currency, decimals }) {
    const n = decimals ? '#,##0.00' : '#,##0';
    if (type === 'money') return `${n} "${currency}";-${n} "${currency}";"-"`;
    if (type === 'int') return '#,##0;-#,##0;"-"';
    if (type === 'percent') return '0.0%;-0.0%;"-"';
    if (type === 'date') return 'dd/mm/yyyy hh:mm';
    return '@';
}

/** The shop's lines for the top of each sheet. */
function shopHeader(shop = {}, T) {
    // In Arabic a number like "16/00-1234567B22" or an e-mail is kept left to right (embedding marks)
    const ltr = (v) => (T.lang === 'ar' ? `\u202A${String(v).trim()}\u202C` : String(v).trim());
    const place = [shop.businessAddress, shop.businessCity, shop.businessWilaya].filter(v => v && String(v).trim()).join(' - ');
    const contact = [shop.businessPhone, shop.businessEmail].filter(v => v && String(v).trim()).map(ltr).join('   |   ');
    const legal = [
        ['legal.rc', shop.businessRc], ['legal.nif', shop.businessTaxId], ['legal.nis', shop.businessNis], ['legal.ai', shop.businessAi],
    ].filter(([, v]) => v && String(v).trim()).map(([k, v]) => `${T(k)}: ${ltr(v)}`).join('   |   ');
    return { name: shop.businessName || 'Afus Boutique', lines: [place, contact, legal].filter(Boolean) };
}

/**
 * A date as the shop reads it: SQLite keeps UTC ("2026-10-20 13:05:00"), Excel
 * shows a date's UTC fields, so the local time is moved into them.
 */
function localDate(raw) {
    if (!raw) return null;
    const text = String(raw);
    const d = raw instanceof Date ? raw : new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(text) ? `${text.replace(' ', 'T')}Z` : text);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000);
}

const textLength = (v) => String(v ?? '').split('\n').reduce((m, l) => Math.max(m, l.length), 0);

function addTableSheet(workbook, sheet, ctx) {
    const { T, shop, logoId, currency } = ctx;
    const columns = sheet.columns;
    const last = columns.length;
    const ws = workbook.addWorksheet(String(sheet.name || 'Sheet').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31), {
        views: [{ rightToLeft: T.lang === 'ar', showGridLines: false }],
        properties: { defaultRowHeight: 18 },
    });
    // Shop lines start after a logo column when there is a logo
    const textFrom = logoId !== null && last > 2 ? 2 : 1;
    const merge = (row, from = 1) => { if (last > from) ws.mergeCells(row, from, row, last); };
    // Arabic cells read right to left: a phone number or "RC: 16/00-1234567B22" stays in its place
    const rtl = T.lang === 'ar';
    const align = (extra = {}) => ({ readingOrder: rtl ? 'rtl' : 'ltr', ...extra });
    const start = rtl ? 'right' : 'left';

    // 1. The shop
    const head = shopHeader(shop, T);
    let r = 1;
    ws.getCell(r, textFrom).value = head.name;
    ws.getCell(r, textFrom).font = { name: FONT, size: 16, bold: true, color: { argb: NAVY_TEXT } };
    ws.getCell(r, textFrom).alignment = align({ horizontal: start, vertical: 'middle' });
    merge(r, textFrom); ws.getRow(r).height = 26;
    for (const line of head.lines) {
        r += 1;
        ws.getCell(r, textFrom).value = line;
        ws.getCell(r, textFrom).font = { name: FONT, size: 10, color: { argb: MUTED } };
        ws.getCell(r, textFrom).alignment = align({ horizontal: start });
        merge(r, textFrom);
    }
    if (logoId !== null) ws.addImage(logoId, { tl: { col: 0.15, row: 0.15 }, ext: { width: 64, height: 64 }, editAs: 'oneCell' });
    r = Math.max(r, 3) + 2;

    // 2. The file's title, the period, when and by whom
    ws.getCell(r, 1).value = sheet.title;
    ws.getCell(r, 1).font = { name: FONT, size: 13, bold: true, color: { argb: BAND_TEXT } };
    ws.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    ws.getCell(r, 1).alignment = align({ vertical: 'middle', horizontal: 'center' });
    merge(r); ws.getRow(r).height = 24;
    r += 1;
    const meta = [
        sheet.period ? `${T('xl.period')}: ${sheet.period}` : null,
        `${T('xl.madeOn')}: ${ctx.madeOn}`,
        ctx.by ? `${T('xl.by')}: ${ctx.by}` : null,
    ].filter(Boolean).join('     |     ');
    ws.getCell(r, 1).value = meta;
    ws.getCell(r, 1).font = { name: FONT, size: 9, italic: true, color: { argb: MUTED } };
    ws.getCell(r, 1).alignment = align({ horizontal: 'center' });
    merge(r);

    // 3. Key figures (label on the first half, value next to it)
    if (sheet.summary?.length) {
        r += 1;
        // Label on a few columns, its value right next to it
        const split = Math.max(1, Math.min(3, last - 1));
        const valueTo = Math.min(last, split + 2);
        for (const kpi of sheet.summary) {
            r += 1;
            const label = ws.getCell(r, 1);
            label.value = kpi.label;
            label.font = { name: FONT, size: 10, bold: true };
            label.alignment = align({ horizontal: start });
            label.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: KPI_FILL } };
            if (split > 1) ws.mergeCells(r, 1, r, split);
            const value = ws.getCell(r, split + 1);
            value.value = kpi.value;
            value.numFmt = numberFormat(kpi.type || 'money', { currency, decimals: !Number.isInteger(Number(kpi.value)) });
            value.font = { name: FONT, size: 11, bold: true, color: { argb: NAVY_TEXT } };
            value.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: KPI_FILL } };
            value.alignment = align({ horizontal: start });
            if (valueTo > split + 1) ws.mergeCells(r, split + 1, r, valueTo);
            for (let c = 1; c <= valueTo; c++) ws.getCell(r, c).border = box;
        }
    }
    r += 2;

    // 4. The table
    const headerRow = r;
    columns.forEach((col, i) => {
        const cell = ws.getCell(headerRow, i + 1);
        cell.value = col.label;
        cell.font = { name: FONT, size: 10, bold: true, color: { argb: BAND_TEXT } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
        cell.alignment = align({ vertical: 'middle', horizontal: 'center', wrapText: true });
        cell.border = box;
    });
    ws.getRow(headerRow).height = 30;
    const decimals = {};
    for (const col of columns) {
        decimals[col.key] = sheet.rows.some(row => {
            const v = Number(row[col.key]);
            return Number.isFinite(v) && !Number.isInteger(Math.round(v * 1000) / 1000);
        });
    }
    const first = headerRow + 1;
    sheet.rows.forEach((row, n) => {
        const rowNumber = first + n;
        const at = (key) => `${colLetter(columns.findIndex(c => c.key === key) + 1)}${rowNumber}`;
        columns.forEach((col, i) => {
            const cell = ws.getCell(rowNumber, i + 1);
            const raw = row[col.key];
            if (col.formula) cell.value = { formula: col.formula(at), result: raw ?? 0 };
            else if (col.type === 'date') cell.value = localDate(raw);
            else if (['int', 'money', 'percent'].includes(col.type)) cell.value = raw === null || raw === undefined || raw === '' ? null : Number(raw) || 0;
            // Codes stay text: a barcode never turns into 6.13E+12
            else cell.value = raw === null || raw === undefined ? '' : String(raw);
            cell.numFmt = numberFormat(col.type, { currency, decimals: decimals[col.key] });
            cell.font = { name: FONT, size: 10 };
            cell.border = box;
            cell.alignment = align({ vertical: 'middle', wrapText: col.type === 'text', horizontal: col.type === 'code' ? 'center' : undefined });
            if (n % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
        });
    });
    const lastData = first + sheet.rows.length - 1;

    // 5. Totals: formulas over the rows (a filter gives the total of what is shown)
    let totalRow = null;
    if (columns.some(c => c.total) && sheet.rows.length) {
        totalRow = lastData + 1;
        const labelAt = columns.findIndex(c => !c.total);
        columns.forEach((col, i) => {
            const cell = ws.getCell(totalRow, i + 1);
            const letter = colLetter(i + 1);
            if (col.total === 'sum') {
                const result = sheet.rows.reduce((s, row) => s + (Number(row[col.key]) || 0), 0);
                cell.value = { formula: `SUBTOTAL(109,${letter}${first}:${letter}${lastData})`, result: Math.round(result * 100) / 100 };
                cell.numFmt = numberFormat(col.type, { currency, decimals: decimals[col.key] });
            } else if (i === labelAt) {
                cell.value = `${T('xl.total')} (${sheet.rows.length})`;
            }
            cell.font = { name: FONT, size: 10, bold: true, color: { argb: NAVY_TEXT } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } };
            cell.border = { ...box, top: { style: 'medium', color: { argb: NAVY } } };
        });
        ws.getRow(totalRow).height = 22;
    }
    if (!sheet.rows.length) {
        ws.getCell(first, 1).value = T('xl.empty');
        ws.getCell(first, 1).font = { name: FONT, size: 10, italic: true, color: { argb: MUTED } };
        merge(first);
    }

    // 6. Notes under the table
    let after = (totalRow || Math.max(lastData, first)) + 2;
    for (const note of sheet.notes || []) {
        ws.getCell(after, 1).value = note;
        ws.getCell(after, 1).font = { name: FONT, size: 9, italic: true, color: { argb: MUTED } };
        ws.getCell(after, 1).alignment = align({ horizontal: start, wrapText: true });
        merge(after);
        after += 1;
    }

    // Widths from the content, the header and the shop lines stay readable
    columns.forEach((col, i) => {
        const longest = Math.max(textLength(col.label) * 0.9, ...sheet.rows.slice(0, 500).map(row => {
            const v = row[col.key];
            if (['int', 'money', 'percent'].includes(col.type)) return String(Math.round(Number(v) || 0)).length * 1.35 + (col.type === 'money' ? 5 : 1);
            return textLength(v);
        }));
        ws.getColumn(i + 1).width = col.width || Math.min(48, Math.max(col.type === 'code' ? 12 : 9, Math.ceil(longest) + 3));
    });
    if (logoId !== null && textFrom === 2) ws.getColumn(1).width = Math.max(ws.getColumn(1).width || 0, 12);

    // The header stays on screen; filters on the table
    ws.views = [{ rightToLeft: T.lang === 'ar', showGridLines: false, state: 'frozen', ySplit: headerRow, xSplit: 0, topLeftCell: `A${headerRow + 1}`, activeCell: `A${headerRow + 1}` }];
    if (sheet.rows.length) ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: lastData, column: last } };

    // Printing: A4, fitted to the width, header row on every page, page numbers
    ws.pageSetup = {
        paperSize: 9, orientation: last > 7 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.3 },
        printTitlesRow: `${headerRow}:${headerRow}`, horizontalCentered: true,
    };
    ws.headerFooter = { oddFooter: `&L&8${head.name.replace(/&/g, '&&')}&C&8${T('xl.page')} &P / &N&R&8Afus Boutique` };
    return ws;
}

/**
 * @param {{ shop, T, by, sheets, logoDataUri?, now? }} options
 *   T: translator(lang) from electron/i18n; sheets: [{ name, title, period?, summary?, columns, rows, notes? }]
 * @returns {Promise<Buffer>}
 */
async function buildWorkbook({ shop = {}, T, by = null, sheets, logoDataUri = null, now = new Date() }) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Afus Boutique';
    workbook.company = shop.businessName || '';
    workbook.title = sheets[0]?.title || '';
    workbook.created = now;
    workbook.modified = now;
    // Excel computes every formula again when the file opens (the saved values are for viewers)
    workbook.calcProperties = { fullCalcOnLoad: true };
    let logoId = null;
    const logo = /^data:image\/(png|jpe?g|gif);base64,(.+)$/i.exec(String(logoDataUri || ''));
    if (logo) logoId = workbook.addImage({ base64: logo[2], extension: logo[1].toLowerCase() === 'jpg' ? 'jpeg' : logo[1].toLowerCase() });
    const currency = T.lang === 'ar' ? 'د.ج' : 'DA';
    const pad = (n) => String(n).padStart(2, '0');
    const madeOn = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    for (const sheet of sheets) addTableSheet(workbook, sheet, { T, shop, logoId, currency, madeOn, by });
    return Buffer.from(await workbook.xlsx.writeBuffer());
}

module.exports = { buildWorkbook, numberFormat, colLetter };
