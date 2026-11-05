/**
 * Quick start from an Excel sheet: one row per article.
 *
 *   name         | sold by | quantity | price | cost | sku | barcode | category
 *   Semoule 1 kg |         |    24    |  120  | 100  |     |         | Épicerie
 *   Tomates      |   kg    |   12.5   |  120  |  80  |     |         | Légumes
 *
 * An article sold by weight («kg» in the sold-by column) has its stock in kg
 * in the sheet, kept in grams, and its prices per kg.
 *
 * Each article is saved on its own: an article with a problem (twice in the
 * sheet, code already used, article already in the shop...) is rejected with
 * the reason and its rows, the others are saved. Nothing is rejected
 * silently: the report lists every row that was not imported.
 * Call inside a transaction (savepoints keep each article all-or-nothing).
 */
const catalog = require('./catalogService');

const clean = (v) => (v === undefined || v === null ? '' : String(v).trim());
const key = (v) => clean(v).toLowerCase();
const num = (v) => (clean(v) === '' ? null : Number(String(v).replace(/[^0-9.-]/g, '')));
/** A quantity, 12.5 or 12,5 (French decimal comma). */
const quantityOf = (v) => (clean(v) === '' ? null : Number(clean(v).replace(/\s/g, '').replace(/^(-?\d+),(\d+)$/, '$1.$2')));

// The words of the sold-by column: empty or one of these = by the piece
const BY_WEIGHT = new Set(['kg', 'كغ', 'كلغ', 'كيلو', 'كيلوغرام', 'بالوزن', 'الوزن', 'poids', 'au poids', 'kilo', 'weight', 'by weight']);
const BY_PIECE = new Set(['', 'piece', 'pièce', 'pc', 'pcs', 'u', 'unité', 'unite', 'unit', 'قطعة', 'بالقطعة', 'حبة']);

/** 'kg', 'piece', or null when the sheet says something else. */
function unitOf(value) {
    const word = key(value);
    if (BY_WEIGHT.has(word)) return 'kg';
    if (BY_PIECE.has(word)) return 'piece';
    return null;
}

/** Group the sheet rows by article name. rows: [{ row, name, unit, stock_quantity, price, cost, sku, barcode, category, brand }] */
function groupRows(rows) {
    const groups = new Map();
    for (const r of rows) {
        const k = key(r.name);
        if (!groups.has(k)) groups.set(k, { name: clean(r.name), rows: [] });
        groups.get(k).rows.push(r);
    }
    return [...groups.values()];
}

// Reasons are sent as "CODE|{params}" and shown in the screen's language
const CODES = { noName: 'IMPORT_NO_NAME', exists: 'IMPORT_EXISTS', noPrice: 'IMPORT_NO_PRICE', duplicate: 'IMPORT_DUPLICATE', quantity: 'IMPORT_QUANTITY', unit: 'IMPORT_UNIT' };
const message = (code, params) => catalog.coded(CODES[code], params);

/** First problem of a group before trying to save it, or null. */
function checkGroup(api, group) {
    if (!group.name) return message('noName', {});
    if (api.all('SELECT name FROM products WHERE is_active = 1').some(p => key(p.name) === key(group.name))) {
        return message('exists', { name: group.name });
    }
    if (group.rows.length > 1) return message('duplicate', { name: group.name });
    const [r] = group.rows;
    const price = num(r.price);
    if (price === null || !Number.isFinite(price) || price < 0) return message('noPrice', { name: group.name });
    const unit = unitOf(r.unit);
    if (!unit) return message('unit', { name: group.name, value: clean(r.unit) });
    const qty = quantityOf(r.stock_quantity);
    // Pieces are whole; kilograms may have grams
    if (qty !== null && (!Number.isFinite(qty) || qty < 0 || (unit === 'piece' && !Number.isInteger(qty)))) return message('quantity', { line: r.row });
    return null;
}

// SQLite's LOWER() leaves «É» as it is: the names are compared here
function categoryId(api, name) {
    if (!clean(name)) return null;
    return api.all('SELECT id, name FROM categories').find(c => key(c.name) === key(name))?.id || null;
}

/**
 * @returns {{ imported: ({ name, pieces } | { name, grams })[], rejected: [{ rows: number[], name, reason }] }}
 */
function importProducts(api, rows, { employeeId = null } = {}) {
    const report = { imported: [], rejected: [] };
    groupRows(rows).forEach((group, index) => {
        const rowNumbers = group.rows.map(r => r.row);
        const problem = checkGroup(api, group);
        if (problem) { report.rejected.push({ rows: rowNumbers, name: group.name, reason: problem }); return; }

        const [r] = group.rows;
        const unit = unitOf(r.unit);
        const qty = quantityOf(r.stock_quantity) || 0;
        const product = {
            id: api.uuid(), name: group.name, price: num(r.price), cost: num(r.cost) ?? 0, unit,
            category_id: categoryId(api, r.category), brand: clean(r.brand) || null,
            description: clean(r.description) || null,
            // Sold by weight: the minimum in kg too, kept in grams
            min_stock_level: unit === 'kg' ? Math.round((quantityOf(r.min_stock_level) ?? 2) * 1000) : num(r.min_stock_level) ?? 2,
            tax_rate: num(r.tax_rate) || 0, is_active: true,
            sku: clean(r.sku) || null, barcode: clean(r.barcode) || null,
            // Sold by weight: kept in grams
            stock_quantity: unit === 'kg' ? Math.round(qty * 1000) : qty,
        };

        const savepoint = `import_${index}`;
        api.run(`SAVEPOINT ${savepoint}`);
        try {
            catalog.saveProduct(api, product, [], { employeeId, isNew: true });
            api.run(`RELEASE ${savepoint}`);
            report.imported.push(unit === 'kg' ? { name: group.name, grams: product.stock_quantity } : { name: group.name, pieces: product.stock_quantity });
        } catch (error) {
            api.run(`ROLLBACK TO ${savepoint}`);
            api.run(`RELEASE ${savepoint}`);
            report.rejected.push({ rows: rowNumbers, name: group.name, reason: String(error.message || error) });
        }
    });
    return report;
}

module.exports = { importProducts, groupRows, unitOf };
