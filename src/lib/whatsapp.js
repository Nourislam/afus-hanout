// Credit reminder sent through WhatsApp, the way shops already do it by hand:
// the program only opens WhatsApp (app or web) on the customer's number with
// a ready message; the cashier presses Send. No account, no server, no API.
import { t, translate } from '../i18n';
import { formatMoney, formatDate } from '../i18n/format';

/**
 * International number for wa.me (digits only), or null when it cannot be one.
 * Algerian numbers typed as 0555 12 34 56 become 213555123456.
 */
export function whatsappNumber(phone) {
    let digits = String(phone || '').replace(/[^\d+]/g, '');
    if (digits.startsWith('+')) digits = digits.slice(1);
    else if (digits.startsWith('00')) digits = digits.slice(2);
    else if (/^0[5-7]\d{8}$/.test(digits)) digits = `213${digits.slice(1)}`;
    digits = digits.replace(/\D/g, '');
    return /^\d{8,15}$/.test(digits) ? digits : null;
}

/** The ready-made message: customer, amount still owed, shop, due date when set. */
export function reminderMessage({ customerName, amount, shopName, dueDate }) {
    const due = dueDate ? t('whatsapp.due', { date: formatDate(dueDate) }) : '';
    return t('whatsapp.message', { name: customerName || '', amount: formatMoney(amount), shop: shopName || '', due }).replace(/\s+([.،,])/g, '$1').trim();
}

/** https://wa.me link that opens the chat with the message typed. */
export function whatsappLink(phone, text) {
    const number = whatsappNumber(phone);
    return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
}

/** At most this many debts written in a statement; the rest are counted. */
const STATEMENT_LINES = 10;

/**
 * @param {{ name: string, shop: string, lines?: { date: string, left: number }[], owed: number, lang: string }} input
 * The karni statement, polite and ready to send: greeting, each open debt
 * with its date (the oldest first), what is left, thanks. The owner sends it
 * himself: no automatic reminder, to keep the relationship.
 */
export function statementText({ name, shop, lines = [], owed, lang }) {
    const tr = (key, params) => translate(lang, key, params);
    const money = (n) => formatMoney(n, { lang });
    const shown = lines.slice(0, STATEMENT_LINES).map(l => `• ${formatDate(l.date, 'date', { lang })}: ${money(l.left)}`);
    const more = lines.length > STATEMENT_LINES ? [tr('karni.statement.more', { n: lines.length - STATEMENT_LINES })] : [];
    return [
        tr('karni.statement.hello', { name: name || '' }),
        tr('karni.statement.intro', { shop: shop || '' }),
        ...shown,
        ...more,
        tr('karni.statement.left', { amount: money(owed) }),
        tr('karni.statement.thanks'),
    ].join('\n');
}

/**
 * The order for a distributor, ready to send: greeting, one line per article
 * (cartons, kg or pieces), thanks and the shop's name.
 * @param {{ supplier: string, shop: string, lang: string, lines: { name: string, quantity: number, cartons?: number, unit: string }[] }} input
 */
export function orderText({ supplier, shop, lang, lines = [] }) {
    const tr = (key, params) => translate(lang, key, params);
    const amount = (l) => {
        if (l.cartons) return tr('order.cartons', { n: l.cartons });
        if (l.unit === 'kg') return tr('order.kg', { n: Math.round(l.quantity / 100) / 10 });
        return String(l.quantity);
    };
    return [
        tr('order.hello', { name: supplier || '' }),
        ...lines.map(l => `• ${l.name}: ${amount(l)}`),
        tr('order.thanks', { shop: shop || '' }),
    ].join('\n');
}

/**
 * The day's closing in three lines, for the owner: sold, earned about (only
 * when the summary carries it: the owner's figure), the karni grew or shrank.
 * @param {{ shop: string, lang: string, date: string, summary: { sales: number, profit?: number, karniChange: number, tickets: number } }} input
 */
export function closingText({ shop, lang, date, summary }) {
    const tr = (key, params) => translate(lang, key, params);
    const money = (n) => formatMoney(n, { lang });
    const karni = summary.karniChange > 0 ? tr('closing.karniUp', { amount: money(summary.karniChange) })
        : summary.karniChange < 0 ? tr('closing.karniDown', { amount: money(-summary.karniChange) })
            : tr('closing.karniSame');
    return [
        tr('closing.title', { shop: shop || '', date }),
        `• ${tr('closing.sold', { amount: money(summary.sales), n: summary.tickets })}`,
        ...(summary.profit !== undefined && summary.profit !== null ? [`• ${tr('closing.profit', { amount: money(summary.profit) })}`] : []),
        `• ${karni}`,
    ].join('\n');
}

/** A wa.me link with the text only: WhatsApp asks who to send it to. */
export function whatsappShare(text) {
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
