/**
 * The label scale's articles (أسعار الميزان).
 *
 * The scale prints the price the till charges, so its list must follow the
 * program: each article sold by weight has a number in the scale (PLU) and a
 * price per kg. Without a scale's protocol (none is bought yet), the program
 * gives that list as a file for the scale's own program and as a sheet to
 * type it in by hand, and keeps what the scale was last given
 * (settings.scale_plu_sent) to show what changed since.
 * `api` is the { all, get, run } adapter.
 */
const { formatMoney, formatDate } = require('../i18n');

const SENT = 'scale_plu_sent';

function readSent(api) {
    const row = api.get('SELECT value FROM settings WHERE key = ?', [SENT]);
    try { return row ? JSON.parse(row.value) : null; } catch { return null; }
}

/**
 * The scale's list now, compared with what it was last given.
 * @returns {{ rows: { id, plu, name, price, change: null|'new'|'price'|'name', before? }[],
 *             missing: { id, name }[], gone: { plu, name }[], changed: number, sentAt: string|null }}
 */
function pluList(api) {
    const sent = readSent(api);
    const known = sent?.items || {};
    const rows = api.all(`SELECT id, plu, name, price FROM products
                          WHERE is_active = 1 AND unit = 'kg' AND plu IS NOT NULL ORDER BY plu`)
        .map(p => {
            const row = { id: p.id, plu: Number(p.plu), name: p.name, price: Number(p.price) || 0 };
            const was = known[row.plu];
            // Before the first update every article is new to the scale
            if (!was || was.id !== row.id) return { ...row, change: 'new' };
            if (Math.abs(was.price - row.price) > 0.004) return { ...row, change: 'price', before: was.price };
            if (was.name !== row.name) return { ...row, change: 'name', beforeName: was.name };
            return { ...row, change: null };
        });
    const now = new Set(rows.map(r => r.plu));
    const gone = Object.entries(known)
        .filter(([n]) => !now.has(Number(n)))
        .map(([n, item]) => ({ plu: Number(n), name: item.name }))
        .sort((a, b) => a.plu - b.plu);
    const missing = api.all(`SELECT id, name FROM products WHERE is_active = 1 AND unit = 'kg' AND plu IS NULL ORDER BY name`);
    return {
        rows, missing, gone,
        changed: rows.filter(r => r.change).length + gone.length,
        sentAt: sent?.at || null,
    };
}

/** Give the next free numbers (after the highest one used) to the articles sold by weight without one. */
function assignNumbers(api) {
    const missing = api.all(`SELECT id FROM products WHERE is_active = 1 AND unit = 'kg' AND plu IS NULL ORDER BY name`);
    let next = (Number(api.get('SELECT MAX(plu) AS n FROM products').n) || 0) + 1;
    for (const p of missing) api.run('UPDATE products SET plu = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [next++, p.id]);
    return missing.length;
}

/** The owner has put the list in the scale: remember it as the scale's. */
function markSent(api, at = new Date()) {
    const items = {};
    for (const r of pluList(api).rows) items[r.plu] = { id: r.id, name: r.name, price: r.price };
    const value = JSON.stringify({ at: at.toISOString(), items });
    if (api.get('SELECT key FROM settings WHERE key = ?', [SENT])) api.run('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?', [value, SENT]);
    else api.run('INSERT INTO settings (key, value) VALUES (?, ?)', [SENT, value]);
    return { at: at.toISOString(), count: Object.keys(items).length };
}

const csvField = (text) => (/[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);

/**
 * The file for the scale's program: PLU;Name;Price;Unit, one article a line,
 * the price per kg with the scale's decimals, UTF-8 with its mark (Excel and
 * the scale programs read the Arabic names).
 */
function pluCsv(rows, { decimals = 2 } = {}) {
    const d = [0, 1, 2].includes(Number(decimals)) ? Number(decimals) : 2;
    const lines = ['PLU;Name;Price;Unit', ...rows.map(r => `${r.plu};${csvField(String(r.name))};${(Number(r.price) || 0).toFixed(d)};kg`)];
    return `\uFEFF${lines.join('\r\n')}\r\n`;
}

const esc = (text) => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** The A4 sheet to type the list into the scale by hand, with a box to tick per line. */
function pluSheetHtml(list, { shop = {}, T, lang = 'ar', onlyChanged = false } = {}) {
    const rows = onlyChanged ? list.rows.filter(r => r.change) : list.rows;
    const gone = onlyChanged || list.sentAt ? list.gone : [];
    const rtl = lang === 'ar';
    const mark = (r) => (r.change === 'new' && list.sentAt ? T('plu.new')
        : r.change === 'price' ? T('plu.was', { price: formatMoney(r.before, lang) })
            : r.change === 'name' ? T('plu.renamed') : '');
    const body = rows.map(r => `<tr${r.change && list.sentAt ? ' class="changed"' : ''}>
<td class="plu">${r.plu}</td><td class="name">${esc(r.name)}</td><td class="price">${esc(formatMoney(r.price, lang))}</td><td class="note">${esc(mark(r))}</td><td class="box"></td></tr>`).join('\n');
    const goneRows = gone.map(g => `<tr class="changed"><td class="plu">${g.plu}</td><td class="name"><s>${esc(g.name)}</s></td><td class="price">—</td><td class="note">${esc(T('plu.gone'))}</td><td class="box"></td></tr>`).join('\n');
    return `<!doctype html>
<html lang="${esc(lang)}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${esc(T('plu.title'))}</title>
<style>
@page { size: A4; margin: 14mm; }
body { font-family: Tahoma, Arial, sans-serif; color: #111; font-size: 12pt; }
h1 { font-size: 18pt; margin: 0 0 2mm; }
.sub { color: #555; margin-bottom: 6mm; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #999; padding: 2.5mm 3mm; text-align: start; }
th { background: #eee; }
td.plu { font-size: 16pt; font-weight: bold; width: 18mm; text-align: center; }
td.price { font-size: 14pt; font-weight: bold; white-space: nowrap; }
td.note { color: #b45309; font-size: 10pt; }
td.box { width: 12mm; }
tr.changed td { background: #fff7e6; }
tr { page-break-inside: avoid; }
</style></head><body>
<h1>${esc(T('plu.title'))}</h1>
<div class="sub">${esc(shop.businessName || '')} · ${esc(formatDate(new Date(), lang))}${list.sentAt ? ` · ${esc(T('plu.lastSent', { date: formatDate(new Date(list.sentAt), lang) }))}` : ''}</div>
<table><thead><tr><th>${esc(T('plu.col.plu'))}</th><th>${esc(T('plu.col.name'))}</th><th>${esc(T('plu.col.price'))}</th><th></th><th>✓</th></tr></thead>
<tbody>
${body}
${goneRows}
</tbody></table>
</body></html>`;
}

module.exports = { pluList, assignNumbers, markSent, pluCsv, pluSheetHtml };
