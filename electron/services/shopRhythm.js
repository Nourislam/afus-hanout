/**
 * The shop's own rhythm, learnt from its sales: the busy hours and days, the
 * occasions of the Algerian year (religious feasts by the Hijri calendar,
 * Yennayer, back to school, the summer and wedding season, and the shop's own
 * dates) and, before each one, what sold last time and what to buy now.
 * Read-only on the sales; the shop's own dates are kept in shop_events.
 * `api` is the { all, get, run } adapter. sales.created_at is UTC; hours and
 * days are those of the computer (the shop's clock).
 */
const { countedSale } = require('./saleStatus');
const { NET_SALE_ITEMS, PRODUCT_STOCK } = require('./dashboardService');

const DAY = 86400000;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100 + 0;
const toDb = (date) => new Date(date).toISOString().replace('T', ' ').slice(0, 19);
const fromDb = (s) => new Date(String(s).replace(' ', 'T') + (String(s).endsWith('Z') ? '' : 'Z'));
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const atMidnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Busy hours and days: a 7 x 24 grid (day of the week x hour) of tickets and
 * money taken over the last weeks, and what stands out.
 */
function rhythm(api, { now = Date.now(), weeks = 12 } = {}) {
    const since = toDb(now - weeks * 7 * DAY);
    const sales = api.all(`
        SELECT s.created_at, s.total FROM sales s
        WHERE ${countedSale('s')} AND s.created_at >= ?
    `, [since]);
    const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ tickets: 0, amount: 0 })));
    const days = new Set();
    for (const s of sales) {
        const d = fromDb(s.created_at);
        if (Number.isNaN(d.getTime())) continue;
        const cell = grid[d.getDay()][d.getHours()];
        cell.tickets += 1;
        cell.amount += Number(s.total) || 0;
        days.add(dayKey(d));
    }
    // Per day of the week: the money of an average such day (days really worked count)
    const workedByWeekday = Array(7).fill(0);
    for (const k of days) workedByWeekday[new Date(`${k}T12:00:00`).getDay()] += 1;
    const byDay = grid.map((hours, day) => {
        const amount = hours.reduce((a, c) => a + c.amount, 0);
        const tickets = hours.reduce((a, c) => a + c.tickets, 0);
        const worked = workedByWeekday[day];
        return { day, tickets, amount: r2(amount), perDay: worked ? r2(amount / worked) : 0, worked };
    });
    const byHour = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        tickets: grid.reduce((a, d) => a + d[hour].tickets, 0),
        amount: r2(grid.reduce((a, d) => a + d[hour].amount, 0)),
    }));
    const open = byHour.filter(h => h.tickets > 0);
    const busiestHour = open.length ? open.reduce((a, b) => (b.tickets > a.tickets ? b : a)) : null;
    const quietHour = open.length > 2 ? open.reduce((a, b) => (b.tickets < a.tickets ? b : a)) : null;
    const workedDays = byDay.filter(d => d.worked > 0);
    const busiestDay = workedDays.length ? workedDays.reduce((a, b) => (b.perDay > a.perDay ? b : a)) : null;
    const quietDay = workedDays.length > 1 ? workedDays.reduce((a, b) => (b.perDay < a.perDay ? b : a)) : null;
    // The busiest stretch of 3 hours (to have everyone in the shop then)
    let peak = null;
    for (let h = 0; h < 22; h++) {
        const t = byHour[h].tickets + byHour[h + 1].tickets + byHour[h + 2].tickets;
        if (t > 0 && (!peak || t > peak.tickets)) peak = { from: h, to: h + 3, tickets: t };
    }
    return {
        weeks, tickets: sales.length, daysWorked: days.size,
        grid: grid.map(hours => hours.map(c => ({ tickets: c.tickets, amount: r2(c.amount) }))),
        byDay, byHour, busiestHour, quietHour, busiestDay, quietDay, peak,
        // Under two weeks of sales the figures say little yet
        enough: days.size >= 10,
    };
}

/* ---------- The occasions of the year ---------- */

const HIJRI = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' });
function hijriOf(date) {
    const parts = Object.fromEntries(HIJRI.formatToParts(date).map(p => [p.type, p.value]));
    return { day: Number(parts.day), month: Number(parts.month), year: Number(parts.year) };
}
/** Gregorian dates (local midnight) of a Hijri day, between two dates. */
function hijriDates(month, day, from, to) {
    const out = [];
    for (let d = atMidnight(from); d <= to; d = new Date(d.getTime() + DAY)) {
        const h = hijriOf(d);
        if (h.month === month && h.day === day) out.push(new Date(d));
    }
    return out;
}

// Built-in occasions: how to find them, and how many days before they the shop sells for them
const OCCASIONS = [
    { id: 'ramadan', kind: 'hijri', month: 9, day: 1, before: 14 },
    { id: 'eidFitr', kind: 'hijri', month: 10, day: 1, before: 21 },
    { id: 'eidAdha', kind: 'hijri', month: 12, day: 10, before: 14 },
    { id: 'mawlid', kind: 'hijri', month: 3, day: 12, before: 7 },
    { id: 'yennayer', kind: 'fixed', month: 1, day: 12, before: 7 },
    { id: 'newYear', kind: 'fixed', month: 1, day: 1, before: 10 },
    { id: 'backToSchool', kind: 'fixed', month: 9, day: 21, before: 21 },
    { id: 'summer', kind: 'fixed', month: 6, day: 20, before: 21 },
    { id: 'weddings', kind: 'fixed', month: 7, day: 10, before: 21 },
];

function occurrences(o, from, to) {
    if (o.kind === 'hijri') return hijriDates(o.month, o.day, from, to);
    const out = [];
    for (let y = from.getFullYear(); y <= to.getFullYear(); y++) {
        const d = new Date(y, o.month - 1, o.day);
        if (d >= atMidnight(from) && d <= to) out.push(d);
    }
    return out;
}

/** The shop's own dates (shop_events): a name, a day, the days before it it sells for it, every year or once. */
function ownEvents(api) {
    try {
        return api.all('SELECT id, name, date, days_before, yearly FROM shop_events ORDER BY date').map(e => ({
            id: e.id, name: e.name, kind: 'own', date: e.date, before: Number(e.days_before) || 14, yearly: !!e.yearly,
        }));
    } catch {
        return [];
    }
}
function ownOccurrences(e, from, to) {
    const base = new Date(`${e.date}T00:00:00`);
    if (Number.isNaN(base.getTime())) return [];
    if (!e.yearly) return base >= atMidnight(from) && base <= to ? [base] : [];
    const out = [];
    for (let y = from.getFullYear(); y <= to.getFullYear(); y++) {
        const d = new Date(y, base.getMonth(), base.getDate());
        if (d >= atMidnight(from) && d <= to) out.push(d);
    }
    return out;
}

/** Money taken between two local dates (end excluded). */
function takenBetween(api, from, to) {
    return Number(api.get(`SELECT COALESCE(SUM(s.total), 0) AS t FROM sales s WHERE ${countedSale('s')} AND s.created_at >= ? AND s.created_at < ?`, [toDb(from), toDb(to)])?.t) || 0;
}

/** What sold in a window: per article and colour / size, pieces kept, with today's stock. */
function soldBetween(api, from, to, limit = 12) {
    return api.all(`
        SELECT si.product_id, si.variant_id, p.name, c.name AS category, v.color, v.size,
               SUM(si.net_quantity) AS sold,
               CASE WHEN si.variant_id IS NOT NULL THEN COALESCE(v.stock_quantity, 0) ELSE ${PRODUCT_STOCK} END AS stock
        FROM ${NET_SALE_ITEMS} si
        JOIN sales s ON s.id = si.sale_id
        JOIN products p ON p.id = si.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN product_variants v ON v.id = si.variant_id
        WHERE ${countedSale('s')} AND s.created_at >= ? AND s.created_at < ?
        GROUP BY si.product_id, si.variant_id
        HAVING sold > 0
        ORDER BY sold DESC
        LIMIT ?
    `, [toDb(from), toDb(to), limit]).map(r => ({
        productId: r.product_id, variantId: r.variant_id || null, name: r.name, category: r.category || '',
        color: r.color || '', size: r.size || '', sold: Number(r.sold) || 0, stock: Number(r.stock) || 0,
    }));
}

/**
 * The coming occasions (next 12 months), nearest first: in how many days,
 * when to start preparing, and from the last time (the year before): how
 * much more the shop sold in the days before it than usually, what sold,
 * and what to buy now (sold then, a little more, minus today's stock).
 */
function calendar(api, { now = Date.now(), ahead = 365, limit = 8 } = {}) {
    const today = atMidnight(new Date(now));
    const until = new Date(today.getTime() + ahead * DAY);
    const list = [];
    const all = [...OCCASIONS.map(o => ({ ...o, find: (a, b) => occurrences(o, a, b) })), ...ownEvents(api).map(e => ({ ...e, find: (a, b) => ownOccurrences(e, a, b) }))];
    for (const o of all) {
        const next = o.find(today, until)[0];
        if (!next) continue;
        // The same occasion the year before (a Hijri feast comes about 11 days earlier)
        const last = o.find(new Date(next.getTime() - 400 * DAY), new Date(next.getTime() - 300 * DAY)).pop() || null;
        let history = null;
        if (last) {
            const start = new Date(last.getTime() - o.before * DAY);
            const during = takenBetween(api, start, last);
            // Usually: the average of the same number of days in the 8 weeks before
            const baseStart = new Date(start.getTime() - 56 * DAY);
            const usual = takenBetween(api, baseStart, start) / 56 * o.before;
            const sold = soldBetween(api, start, last);
            history = {
                date: dayKey(last), during: r2(during), usual: r2(usual),
                change: usual > 0 ? Math.round((during / usual - 1) * 100) : null,
                sold,
                // A little more than last time (+10%), less what is in the shop now
                toBuy: sold.map(s => ({ ...s, buy: Math.max(0, Math.ceil(s.sold * 1.1) - s.stock) })).filter(s => s.buy > 0),
            };
            if (!during && !sold.length) history = null;
        }
        const days = Math.round((next - today) / DAY);
        list.push({
            id: o.id, name: o.name || null, kind: o.kind, date: dayKey(next), days,
            prepareFrom: dayKey(new Date(next.getTime() - o.before * DAY)), before: o.before,
            preparing: days <= o.before, history,
        });
    }
    return list.sort((a, b) => a.days - b.days).slice(0, limit);
}

/* ---------- The shop's own dates ---------- */

function addEvent(api, { name, date, daysBefore = 14, yearly = true } = {}, id) {
    const clean = String(name || '').trim().slice(0, 60);
    if (!clean) throw new Error('EVENT_NAME_REQUIRED');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) throw new Error('EVENT_DATE_INVALID');
    const before = Math.min(60, Math.max(1, parseInt(daysBefore, 10) || 14));
    api.run('INSERT INTO shop_events (id, name, date, days_before, yearly) VALUES (?, ?, ?, ?, ?)', [id, clean, date, before, yearly ? 1 : 0]);
    return { id, name: clean, date, daysBefore: before, yearly: !!yearly };
}
function deleteEvent(api, id) {
    api.run('DELETE FROM shop_events WHERE id = ?', [String(id || '')]);
    return { success: true };
}
function listEvents(api) {
    return ownEvents(api).map(e => ({ id: e.id, name: e.name, date: e.date, daysBefore: e.before, yearly: e.yearly }));
}

module.exports = { rhythm, calendar, addEvent, deleteEvent, listEvents, OCCASIONS, hijriOf };
