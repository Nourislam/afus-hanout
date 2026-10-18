/**
 * The shop's catalogue as one package, to copy it to another shop of the
 * same owner (shops link, phase 1). Only what describes the articles goes:
 * categories, brands, the shop's own colours and sizes, articles and their
 * colour/size variants with prices and codes. Never stock, sales, customers,
 * suppliers, cash or staff: each shop keeps its own.
 *
 *   exportCatalog(api, getSetting)          -> package { version, at, ... }
 *   importCatalog(api, pkg, deps)           -> counts of what was added
 *
 * Import adds what the shop does not have yet and changes nothing it has:
 *   categories / brands  matched by name (any letter case)
 *   articles             matched by id, then by any of their codes (SKU,
 *                        barcode, QR): found = left as it is (skipped)
 *   new articles         keep the main shop's ids and codes (the same label
 *                        scans in every shop), stock 0
 *   a code already used by another article here: that article is not added
 *                        (counted in conflicts), the rest goes on
 * Pictures stay in the main shop (phase 1).
 */
const catalog = require('../services/catalogService');

const VERSION = 1;
const PRODUCT_FIELDS = ['id', 'sku', 'barcode', 'name', 'description', 'category_id', 'price', 'cost', 'min_stock_level', 'tax_rate',
    'is_active', 'brand', 'gender', 'season', 'collection', 'has_variants', 'has_colors', 'has_sizes', 'wholesale_price', 'show_on_website'];
const VARIANT_FIELDS = ['id', 'product_id', 'color', 'color_code', 'size', 'sku', 'barcode', 'qr_code', 'price', 'cost', 'min_stock_level', 'is_active', 'sort_order'];

const columnsOf = (api, table) => new Set(api.all(`PRAGMA table_info(${table})`).map(c => c.name));
const key = (text) => String(text || '').trim().toLowerCase();

function exportCatalog(api, getSetting = () => null, now = () => new Date()) {
    const pcols = columnsOf(api, 'products');
    const vcols = columnsOf(api, 'product_variants');
    const fields = PRODUCT_FIELDS.filter(f => pcols.has(f));
    const vfields = VARIANT_FIELDS.filter(f => vcols.has(f));
    const products = api.all(`SELECT ${fields.join(', ')} FROM products ORDER BY created_at, id`);
    const variants = api.all(`SELECT ${vfields.join(', ')} FROM product_variants WHERE is_active = 1 ORDER BY product_id, sort_order`);
    const byProduct = new Map();
    for (const v of variants) {
        if (!byProduct.has(v.product_id)) byProduct.set(v.product_id, []);
        const { product_id: _p, ...rest } = v;
        byProduct.get(v.product_id).push(rest);
    }
    return {
        version: VERSION,
        at: now().toISOString(),
        categories: api.all('SELECT id, name, color, icon FROM categories ORDER BY name'),
        brands: api.all('SELECT id, name, sort_order FROM brands WHERE is_active = 1 ORDER BY sort_order, name'),
        custom: getSetting('catalog_custom') || null,
        products: products.map(p => ({ ...p, variants: byProduct.get(p.id) || [] })),
    };
}

/** A package as sent by another shop: its shape is checked before anything is written. */
function checkPackage(pkg) {
    const ok = pkg && typeof pkg === 'object' && pkg.version === VERSION
        && Array.isArray(pkg.categories) && Array.isArray(pkg.brands) && Array.isArray(pkg.products)
        && pkg.products.every(p => p && typeof p.id === 'string' && p.id && typeof p.name === 'string' && (!p.variants || Array.isArray(p.variants)));
    if (!ok) throw Object.assign(new Error('bad catalogue package'), { reason: 'bad_package' });
    return pkg;
}

/** The codes of an article and its variants, normalised as the catalogue stores them. */
function codesOf(product) {
    const out = [product.sku, product.barcode];
    for (const v of product.variants || []) out.push(v.sku, v.barcode, v.qr_code);
    return out.map(c => catalog.normalizeCode(c)).filter(Boolean);
}

/** Custom colours/sizes of the main shop added to this shop's own (none removed). */
function mergeCustom(mine, theirs) {
    if (!theirs || typeof theirs !== 'object') return mine;
    const out = { ...(mine && typeof mine === 'object' ? mine : {}) };
    for (const [k, list] of Object.entries(theirs)) {
        if (!Array.isArray(list)) { if (!(k in out)) out[k] = list; continue; }
        const have = Array.isArray(out[k]) ? [...out[k]] : [];
        const seen = new Set(have.map(x => JSON.stringify(x)));
        for (const item of list) if (!seen.has(JSON.stringify(item))) { have.push(item); seen.add(JSON.stringify(item)); }
        out[k] = have;
    }
    return out;
}

/** Everything in one transaction (written to disk once). */
function importCatalog(api, pkg, deps = {}) {
    checkPackage(pkg);
    return api.transaction(() => importAll(api, pkg, deps));
}

function importAll(api, pkg, { getSetting = () => null, saveSetting = () => {}, employeeId = null }) {
    const counts = { categories: 0, brands: 0, products: 0, variants: 0, skipped: 0, conflicts: 0 };

    // Categories: by name; the main shop's id is kept for a new one when free
    const categoryId = new Map(); // their id -> our id
    const ourCategories = new Map(api.all('SELECT id, name FROM categories').map(c => [key(c.name), c.id]));
    for (const c of pkg.categories) {
        if (!c || !String(c.name || '').trim()) continue;
        let id = ourCategories.get(key(c.name));
        if (!id) {
            id = c.id && !api.get('SELECT 1 FROM categories WHERE id = ?', [c.id]) ? String(c.id) : api.uuid();
            api.run('INSERT INTO categories (id, name, color, icon) VALUES (?, ?, ?, ?)', [id, String(c.name).trim(), c.color || '#6366f1', c.icon || null]);
            ourCategories.set(key(c.name), id);
            counts.categories++;
        }
        if (c.id) categoryId.set(String(c.id), id);
    }

    // Brands: by name
    const ourBrands = new Set(api.all('SELECT name FROM brands').map(b => key(b.name)));
    for (const b of pkg.brands) {
        const name = String(b?.name || '').trim();
        if (!name || ourBrands.has(key(name))) continue;
        api.run('INSERT INTO brands (id, name, is_active, sort_order) VALUES (?, ?, 1, ?)', [api.uuid(), name, Number(b.sort_order) || 0]);
        ourBrands.add(key(name));
        counts.brands++;
    }
    // Brands named on articles only
    for (const p of pkg.products) {
        const name = String(p.brand || '').trim();
        if (name && !ourBrands.has(key(name))) {
            api.run('INSERT INTO brands (id, name, is_active, sort_order) VALUES (?, ?, 1, 0)', [api.uuid(), name]);
            ourBrands.add(key(name));
            counts.brands++;
        }
    }

    if (pkg.custom) saveSetting('catalog_custom', mergeCustom(getSetting('catalog_custom'), pkg.custom));

    for (const p of pkg.products) {
        if (api.get('SELECT 1 FROM products WHERE id = ?', [p.id])) { counts.skipped++; continue; }
        const codes = codesOf(p);
        // The same article already typed here (same code): left as it is
        const owners = codes.map(code => catalog.findIdentifierOwner(api, code)).filter(Boolean);
        if (owners.length) {
            if (owners.some(o => key(o.product_name) === key(p.name))) counts.skipped++; else counts.conflicts++;
            continue;
        }
        const variants = (p.variants || []).map(v => ({ ...v, stock_quantity: 0, id: v.id && !api.get('SELECT 1 FROM product_variants WHERE id = ?', [v.id]) ? v.id : undefined }));
        const product = {
            ...p,
            category_id: p.category_id ? categoryId.get(String(p.category_id)) || null : null,
            supplier_id: null, image_path: null, gallery: null, stock_quantity: 0,
        };
        // One article at a time: one that fails leaves nothing half-written
        api.run('SAVEPOINT shop_article');
        try {
            catalog.saveProduct(api, product, variants, { employeeId, isNew: true });
            api.run('RELEASE shop_article');
            counts.products++;
            counts.variants += variants.length;
        } catch {
            api.run('ROLLBACK TO shop_article');
            api.run('RELEASE shop_article');
            counts.conflicts++;
        }
    }
    return counts;
}

module.exports = { exportCatalog, importCatalog, checkPackage, mergeCustom, VERSION };
