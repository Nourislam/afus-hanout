/**
 * The seasons (المواسم): three weeks before Ramadan, the Eids and the school
 * start, the list to prepare from what the shop sold in the same season last
 * year (by the Hijri calendar: Ramadan moves 11 days a year), minus what is
 * in stock, rounded to whole cartons or kg. A shop with no year behind it
 * gets the general list of what groceries sell more of then, with its own
 * articles found by their names. `api` is the { all, get } adapter.
 */
const { countedSale } = require('./saleStatus');
const { seasonsAhead, seasonOf, lastYear, hijriOf } = require('../shared/hijri.ts');
const STAPLES = require('../shared/seasonStaples.json');

const toDb = (d) => d.toISOString().replace('T', ' ').slice(0, 19);
const dayAfter = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Accents, case and Arabic letter forms do not matter when finding a word in a name. */
function fold(text) {
    return String(text || '').normalize('NFD').replace(/[̀-ًͯ-ٟ]/g, '')
        .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
}

/** The season with this id that is coming or running (or the next one). */
function seasonFor(id, now) {
    const ahead = seasonsAhead(now).find(s => s.id === id);
    if (ahead) return ahead;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const year = id === 'rentree' ? now.getFullYear() : hijriOf(now).year;
    let season = seasonOf(id, year);
    if (season.end < today) season = seasonOf(id, year + 1);
    return { ...season, daysLeft: Math.max(0, Math.round((season.start - today) / 86400000)) };
}

/** What a shop with no year behind it sells more of in this season, found in its articles. */
function generalList(api, id) {
    const articles = api.all(`SELECT id, name, unit, stock_quantity FROM products
                              WHERE is_active = 1 AND COALESCE(unit, 'piece') <> 'service' ORDER BY name`)
        .map(p => ({ ...p, key: fold(p.name) }));
    return (STAPLES[id] || []).map(item => {
        const words = item.words.map(fold);
        const found = articles.filter(p => words.some(w => p.key.includes(w)));
        return {
            label: { ar: item.ar, fr: item.fr, en: item.en },
            articles: found.map(p => ({ id: p.id, name: p.name, unit: p.unit === 'kg' ? 'kg' : 'piece', stock: Math.max(0, Number(p.stock_quantity) || 0) })),
        };
    });
}

/**
 * The list to prepare for a season.
 * @returns {{ season: { id, start, end, daysLeft }, last: { start, end }, source: 'lastYear'|'general',
 *             lines: { product_id, name, unit, sold, stock, quantity, cartons?, carton_qty?, cost }[], general: object[] }}
 */
function prepList(api, id, { now = new Date() } = {}) {
    const season = seasonFor(id, now);
    const last = lastYear(season);
    const rows = api.all(`
        SELECT p.id, p.name, p.unit, p.stock_quantity, p.carton_qty, p.cost,
               SUM(CASE WHEN COALESCE(si.weight_grams, 0) > 0 THEN si.weight_grams ELSE si.quantity END) AS sold
        FROM sale_items si JOIN sales s ON s.id = si.sale_id JOIN products p ON p.id = si.product_id
        WHERE ${countedSale('s')} AND p.is_active = 1 AND COALESCE(p.unit, 'piece') <> 'service'
          AND datetime(s.created_at) >= datetime(?) AND datetime(s.created_at) < datetime(?)
        GROUP BY p.id ORDER BY sold DESC`, [toDb(last.start), toDb(dayAfter(last.end))]);
    const lines = [];
    for (const p of rows) {
        const sold = Number(p.sold) || 0;
        const stock = Math.max(0, Number(p.stock_quantity) || 0);
        const need = sold - stock;
        if (!(need > 0)) continue;
        const weighed = p.unit === 'kg';
        const cartonQty = !weighed && Number(p.carton_qty) > 1 ? Number(p.carton_qty) : null;
        let quantity = Math.ceil(need);
        let cartons = null;
        if (weighed) quantity = Math.ceil(need / 1000) * 1000;
        else if (cartonQty) { cartons = Math.ceil(need / cartonQty); quantity = cartons * cartonQty; }
        lines.push({
            product_id: p.id, name: p.name, unit: weighed ? 'kg' : 'piece', sold, stock, quantity,
            ...(cartons ? { cartons, carton_qty: cartonQty } : {}), cost: Number(p.cost) || 0,
        });
    }
    const source = rows.length ? 'lastYear' : 'general';
    return {
        season: { id, start: iso(season.start), end: iso(season.end), daysLeft: season.daysLeft },
        last: { start: iso(last.start), end: iso(last.end) },
        source, lines,
        general: source === 'general' ? generalList(api, id) : [],
    };
}

/** The seasons to prepare now (for the home card), nearest first. */
function upcoming(now = new Date()) {
    return seasonsAhead(now).map(s => ({ id: s.id, start: iso(s.start), end: iso(s.end), daysLeft: s.daysLeft }));
}

module.exports = { prepList, upcoming, generalList, fold };
