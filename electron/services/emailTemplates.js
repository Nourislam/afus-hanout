/**
 * The e-mails the shop sends (ticket, kridi payment, purchase order, quotation,
 * gift card): in the shop's language, right to left in Arabic, amounts in
 * dinars, and every name escaped (a customer or article name is never HTML).
 */
const { translator, formatMoney, formatDate } = require('../i18n');

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => Number(v) || 0;

const DOC_KEY = { receipt: 'doc.receipt', credit_payment: 'doc.receipt', purchase_order: 'doc.purchaseOrder', quotation: 'doc.quotation', gift_card: 'gift.title' };
const INTRO = { receipt: 'email.receiptIntro', credit_payment: 'email.creditIntro', purchase_order: 'email.poIntro', quotation: 'email.quoteIntro', gift_card: 'email.giftIntro' };

/**
 * @param {'receipt'|'credit_payment'|'purchase_order'|'quotation'|'gift_card'} kind
 * @param {object} doc { number, date, to, lines:[{name, qty, price, total}], subtotal, discount, tax, total, note, amount }
 * @param {object} shop store settings (businessName, businessPhone, businessEmail, defaultLanguage, receiptFooter)
 * @returns {{ subject: string, html: string }}
 */
function documentEmail(kind, doc = {}, shop = {}) {
    const T = translator(shop.defaultLanguage);
    const money = (v) => formatMoney(num(v), T.lang);
    const shopName = shop.businessName || T('app.name');
    const align = T.dir === 'rtl' ? 'right' : 'left';
    const end = T.dir === 'rtl' ? 'left' : 'right';
    // "TICKET" on paper, "Ticket" in a sentence
    const docName = T(DOC_KEY[kind]).toLowerCase().replace(/^./, (c) => c.toUpperCase());
    const subject = T('email.subject', { doc: docName, number: doc.number || '—', shop: shopName });
    const hello = doc.to ? T('email.hello', { name: escapeHtml(doc.to) }) : T('email.helloAll');
    const intro = T(INTRO[kind], { amount: money(doc.amount) });
    const lines = (doc.lines || []).map((l, i) => `
      <tr style="background:${i % 2 ? '#f8fafc' : '#ffffff'}">
        <td style="padding:10px 12px;text-align:${align}">${escapeHtml(l.name)}</td>
        <td style="padding:10px 12px;text-align:center">${num(l.qty)}</td>
        <td style="padding:10px 12px;text-align:${end};white-space:nowrap">${money(l.price)}</td>
        <td style="padding:10px 12px;text-align:${end};white-space:nowrap;font-weight:600">${money(l.total)}</td>
      </tr>`).join('');
    const row = (label, value, strong) => `<tr><td colspan="3" style="padding:6px 12px;text-align:${end};color:#64748b">${label}</td><td style="padding:6px 12px;text-align:${end};white-space:nowrap;${strong ? 'font-weight:700;font-size:18px;color:#0f172a' : ''}">${value}</td></tr>`;
    const totals = [
        num(doc.discount) > 0 && doc.subtotal !== undefined ? row(T('receipt.subtotal'), money(doc.subtotal)) : '',
        num(doc.discount) > 0 ? row(T('receipt.discount'), `− ${money(doc.discount)}`) : '',
        num(doc.tax) > 0 ? row(T('email.tax'), money(doc.tax)) : '',
        doc.total !== undefined ? row(T('receipt.total'), money(doc.total), true) : '',
    ].join('');
    const table = lines ? `
      <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px">
        <thead><tr style="background:#f1f5f9;color:#475569">
          <th style="padding:10px 12px;text-align:${align}">${T('email.item')}</th>
          <th style="padding:10px 12px">${T('email.qty')}</th>
          <th style="padding:10px 12px;text-align:${end}">${T('email.price')}</th>
          <th style="padding:10px 12px;text-align:${end}">${T('email.amount')}</th>
        </tr></thead>
        <tbody>${lines}</tbody>
        <tfoot>${totals}</tfoot>
      </table>` : '';
    const html = `<!DOCTYPE html>
<html lang="${T.lang}" dir="${T.dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px 0;background:#f1f5f9;font-family:Tahoma,'Segoe UI',Arial,sans-serif;color:#1e293b">
  <div dir="${T.dir}" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;text-align:${align}">
    <div style="background:#1239B0;color:#ffffff;padding:24px 28px">
      <div style="font-size:20px;font-weight:700">${escapeHtml(shopName)}</div>
      <div style="opacity:.9;margin-top:4px">${escapeHtml(docName)} ${doc.number ? `· ${escapeHtml(doc.number)}` : ''}${doc.date ? ` · ${escapeHtml(formatDate(doc.date, T.lang, false))}` : ''}</div>
    </div>
    <div style="padding:24px 28px;line-height:1.7">
      <p style="margin:0 0 8px">${hello}</p>
      <p style="margin:0">${intro}</p>
      ${table}
      ${doc.note ? `<p style="background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:12px;margin:16px 0"><strong>${T('email.note')} :</strong> ${escapeHtml(doc.note)}</p>` : ''}
      <p style="margin:20px 0 0;color:#475569">${escapeHtml(shop.receiptFooter || T('email.thanks'))}</p>
    </div>
    <div style="padding:14px 28px;background:#f8fafc;color:#64748b;font-size:13px">${[shopName, shop.businessPhone, shop.businessEmail].filter(Boolean).map(escapeHtml).join(' · ')}</div>
  </div>
</body></html>`;
    return { subject, html };
}

module.exports = { documentEmail, escapeHtml };
