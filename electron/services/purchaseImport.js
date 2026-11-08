/**
 * A purchase order from the supplier's own Excel file (his invoice or order
 * form): whatever its layout, the row of titles is found (Arabic, French or
 * English), and each line is matched to one article size of the shop:
 *   1. by its code (QR, reference or barcode), else
 *   2. by this supplier's own name for it, learned from his earlier
 *      deliveries and orders (supplier_item_names), else
 *   3. by the article's name + colour + size.
 * Each line keeps the file's name (invoice_name): saving the order teaches it.
 * The quantity and unit price are the file's (the article's purchase price
 * when the file has none). Nothing is saved here: the lines go into the
 * purchase order form, where the shop checks them before saving.
 * `api` is the { all, get } database adapter.
 */
const XLSX = require('xlsx');
const catalog = require('./catalogService');
const { sizeLabel } = require('../i18n');

const clean = (v) => String(v ?? '').toLowerCase().replace(/[.'’*:()]/g, ' ').replace(/\s+/g, ' ').trim();
const COLUMNS = {
    code: ['code', 'réf', 'ref', 'référence', 'reference', 'référence sku', 'sku', 'code barre', 'code-barres', 'code barres', 'barcode', 'ean', 'qr', 'code qr', 'رمز qr', 'الرمز', 'المرجع', 'المرجع sku', 'الباركود'],
    name: ['désignation', 'designation', 'article', 'produit', 'libellé', 'libelle', 'nom', 'name', 'product', 'item', 'description', 'التسمية', 'المنتج', 'السلعة', 'الاسم', 'البيان'],
    color: ['couleur', 'coloris', 'color', 'colour', 'اللون'],
    size: ['taille', 'pointure', 'size', 'المقاس', 'القياس'],
    quantity: ['qté', 'qte', 'quantité', 'quantite', 'qty', 'quantity', 'nombre', 'الكمية', 'العدد'],
    price: ['pu', 'p u', 'prix unitaire', 'prix', 'prix achat', "prix d achat", 'prix d’achat', 'prix ht', 'pu ht', 'unit price', 'price', 'cost', 'سعر الوحدة', 'السعر', 'سعر الشراء', 'سعر الشراء للوحدة', 'ثمن الوحدة'],
};
const ALIASES = Object.fromEntries(Object.entries(COLUMNS).map(([k, list]) => [k, new Set(list.map(clean))]));

/** "1 200,50 DA" -> 1200.5; '' -> null. */
function amount(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    let s = String(value ?? '').replace(/[\s\u00a0\u202f]/g, '').replace(/(da|dzd|د\.?ج)/gi, '');
    if (!s) return null;
    if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
    else s = s.replace(/,/g, '');
    const n = Number(s.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : null;
}

/** The sheet's row of titles and where each column is. */
function findColumns(data) {
    for (let h = 0; h < Math.min(40, data.length); h++) {
        const at = {};
        (data[h] || []).forEach((v, i) => {
            const label = clean(v);
            for (const [key, names] of Object.entries(ALIASES)) if (at[key] === undefined && names.has(label)) at[key] = i;
        });
        if (at.quantity !== undefined && (at.code !== undefined || at.name !== undefined)) return { header: h, at };
    }
    return null;
}

// The size of a variant (a) against the one in the file (b); none in the file fits any size
const sameSize = (a, b) => {
    const x = String(a || '').trim().toUpperCase();
    const y = String(b || '').trim().toUpperCase();
    if (!y) return true;
    if (!x) return false;
    return x === y || ['ar', 'fr', 'en'].some(l => sizeLabel(a, l).toUpperCase() === y || sizeLabel(b, l).toUpperCase() === x);
};
const sameColor = (variant, color) => {
    if (!color) return true;
    const asked = catalog.paletteCode(color);
    const own = catalog.paletteCode(variant.color, variant.color_code);
    return asked && own ? asked === own : clean(variant.color) === clean(color);
};

/** The article size a line is for, or why none. */
function matchLine(api, { code, name, color, size }, supplierId = null) {
    if (code) {
        const found = catalog.lookupCode(api, code);
        if (found && !found.needsVariant) return { product: found.product, variant: found.type === 'variant' ? found.variant : null };
        if (found?.needsVariant) name = name || found.product.name;
    }
    if (!name) return { error: 'PO_LINE_UNKNOWN' };
    // His own name for an article, learned before
    if (supplierId) {
        const known = require('./receiveService').matchInvoiceName(api, supplierId, name);
        const product = known ? api.get('SELECT * FROM products WHERE id = ? AND COALESCE(is_active, 1) = 1 AND COALESCE(has_variants, 0) = 0', [known]) : null;
        if (product) return { product, variant: null };
    }
    const products = api.all('SELECT * FROM products WHERE COALESCE(is_active, 1) = 1 AND LOWER(TRIM(name)) = ?', [String(name).trim().toLowerCase()]);
    if (!products.length) return { error: 'PO_LINE_UNKNOWN' };
    for (const product of products) {
        if (!product.has_variants) return { product, variant: null };
        const variants = api.all('SELECT * FROM product_variants WHERE product_id = ? AND COALESCE(is_active, 1) = 1', [product.id]);
        const fit = variants.filter(v => sameColor(v, color) && sameSize(v.size, size));
        if (fit.length === 1) return { product, variant: fit[0] };
        if (fit.length > 1) return { error: 'PO_LINE_NEEDS_SIZE', product };
    }
    return { error: 'PO_LINE_NO_SIZE', product: products[0] };
}

/**
 * @returns {{ found: boolean, lines: object[], problems: { row, text, error }[] }}
 *   lines in the shape of the purchase order form (same size twice = one line).
 */
function readSupplierFile(api, buffer, { supplierId = null } = {}) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    for (const sheetName of workbook.SheetNames) {
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: '' });
        const columns = findColumns(data);
        if (!columns) continue;
        const { header, at } = columns;
        const get = (line, key) => (at[key] === undefined ? '' : String(line[at[key]] ?? '').trim());
        const lines = new Map();
        const problems = [];
        for (let r = header + 1; r < data.length; r++) {
            const line = data[r] || [];
            const asked = { code: get(line, 'code'), name: get(line, 'name'), color: get(line, 'color'), size: get(line, 'size') };
            const quantity = amount(at.quantity === undefined ? '' : line[at.quantity]);
            if (!asked.code && !asked.name) continue;
            // The totals row of an invoice
            if (!asked.code && /^(total|totaux|المجموع|montant)/i.test(asked.name)) continue;
            const text = [asked.code, asked.name, asked.color, asked.size].filter(Boolean).join(' · ');
            if (!(quantity > 0) || !Number.isInteger(quantity)) { problems.push({ row: r + 1, text, error: 'PO_LINE_QUANTITY' }); continue; }
            const match = matchLine(api, asked, supplierId);
            if (match.error) { problems.push({ row: r + 1, text, error: match.error }); continue; }
            const { product, variant } = match;
            const filePrice = amount(at.price === undefined ? '' : line[at.price]);
            const unitCost = filePrice !== null && filePrice >= 0 ? filePrice : Number(variant?.cost ?? product.cost) || 0;
            const key = variant ? variant.id : product.id;
            const existing = lines.get(key);
            if (existing) {
                existing.quantity += quantity;
                existing.total_cost = Math.round(existing.quantity * existing.unit_cost * 100) / 100;
                continue;
            }
            lines.set(key, {
                key, product_id: product.id, variant_id: variant ? variant.id : null,
                variant_label: variant ? catalog.variantLabel(variant) : undefined, sku: variant ? variant.sku : product.sku,
                product_name: product.name, quantity, unit_cost: unitCost,
                total_cost: Math.round(quantity * unitCost * 100) / 100, tax_rate: 0,
                from_file_price: filePrice !== null,
                ...(asked.name && !variant ? { invoice_name: asked.name } : {}),
            });
        }
        return { found: true, sheet: sheetName, lines: [...lines.values()], problems };
    }
    return { found: false, lines: [], problems: [] };
}

module.exports = { readSupplierFile, matchLine, amount };
