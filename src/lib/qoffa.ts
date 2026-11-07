// قفة رمضان for an association: N baskets of the same pack. The sheet lists
// what one basket holds and what N of them take from the shelves, with the
// price, to hand to the association with its order.
import { translate } from '../i18n';
import { formatMoney } from '../i18n/format';

export interface QoffaItem { product_name: string; quantity: number; product_price?: number }
export interface Qoffa { name: string; bundle_price: number; items: QoffaItem[] }

const esc = (text: unknown) => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** The lines for N baskets: per basket, for all, and the total to pay. */
export function qoffaOrder(qoffa: Qoffa, count: number) {
    const n = Math.max(1, Math.floor(Number(count) || 1));
    return {
        count: n,
        lines: qoffa.items.map(i => ({ name: i.product_name, each: Number(i.quantity) || 0, total: (Number(i.quantity) || 0) * n })),
        total: Math.round(qoffa.bundle_price * n * 100) / 100,
    };
}

/** The A4 sheet for the association (right to left in Arabic). */
export function qoffaSheetHtml(qoffa: Qoffa, count: number, { shop = '', lang = 'ar', date = '' }: { shop?: string; lang?: string; date?: string } = {}) {
    const tr = (key: string, params?: Record<string, unknown>) => translate(lang, key, params);
    const order = qoffaOrder(qoffa, count);
    const rows = order.lines.map(l => `<tr><td>${esc(l.name)}</td><td class="n">${l.each}</td><td class="n"><b>${l.total}</b></td><td class="box"></td></tr>`).join('');
    return `<!doctype html><html lang="${esc(lang)}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${esc(qoffa.name)}</title>
<style>@page{size:A4;margin:14mm}body{font-family:Tahoma,Arial,sans-serif;color:#111;font-size:12pt}h1{font-size:18pt;margin:0 0 2mm}.sub{color:#555;margin-bottom:6mm}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:2.5mm 3mm;text-align:start}th{background:#eee}td.n{text-align:center;font-size:13pt}td.box{width:12mm}
.total{margin-top:6mm;font-size:14pt;font-weight:bold}</style></head><body>
<h1>${esc(tr('qoffa.sheetTitle', { name: qoffa.name, n: order.count }))}</h1>
<div class="sub">${esc(shop)}${date ? ` · ${esc(date)}` : ''}</div>
<table><thead><tr><th>${esc(tr('qoffa.col.article'))}</th><th>${esc(tr('qoffa.col.each'))}</th><th>${esc(tr('qoffa.col.all', { n: order.count }))}</th><th>✓</th></tr></thead><tbody>${rows}</tbody></table>
<div class="total">${esc(tr('qoffa.total', { n: order.count, price: formatMoney(qoffa.bundle_price, { lang }), total: formatMoney(order.total, { lang }) }))}</div>
</body></html>`;
}
