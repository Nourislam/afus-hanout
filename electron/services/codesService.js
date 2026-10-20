/**
 * Stock lines that cannot be scanned: no QR, no reference (SKU), no barcode.
 * Before a count they are found here and each one gets a reference made by the
 * program (catalogService.generateSkus, the same rule as the article form);
 * the QR of a size is its reference, so its label can be printed at once.
 * `api` is the { all, get, run } database adapter.
 */
const { stockLines } = require('./stockService');
const catalog = require('./catalogService');

/** The lines without any code (article and size), with their pieces. */
function linesWithoutCode(api) {
    return stockLines(api).filter(l => !(l.qr || l.sku || l.barcode))
        .map(l => ({ product_id: l.product_id, variant_id: l.variant_id, name: l.name, color: l.color, color_code: l.color_code, size: l.size, quantity: l.quantity }));
}

/** Give a reference to every line without a code; returns the codes made. */
function createMissingCodes(api, settings = {}) {
    const missing = linesWithoutCode(api);
    const made = [];
    const taken = new Set();
    const byProduct = new Map();
    for (const line of missing) {
        if (!byProduct.has(line.product_id)) byProduct.set(line.product_id, []);
        byProduct.get(line.product_id).push(line);
    }
    const now = new Date().toISOString();
    for (const [productId, lines] of byProduct) {
        const product = api.get('SELECT id, name, sku FROM products WHERE id = ?', [productId]);
        if (!product) continue;
        const variants = lines.filter(l => l.variant_id).map(l => ({ id: l.variant_id, color: l.color, color_code: l.color_code, size: l.size }));
        if (variants.length) {
            const codes = catalog.generateSkus(api, product, variants, settings, taken);
            variants.forEach((v, i) => {
                // Its QR is its reference when it has none (labels and scanner)
                api.run("UPDATE product_variants SET sku = ?, qr_code = CASE WHEN COALESCE(qr_code, '') = '' THEN ? ELSE qr_code END, updated_at = ? WHERE id = ?", [codes[i], codes[i], now, v.id]);
                taken.add(codes[i]);
                made.push({ product_id: productId, variant_id: v.id, name: product.name, color: v.color, size: v.size, sku: codes[i] });
            });
        }
        if (lines.some(l => !l.variant_id)) {
            const [code] = catalog.generateSkus(api, { name: product.name }, [{}], settings, taken);
            api.run('UPDATE products SET sku = ?, updated_at = ? WHERE id = ?', [code, now, productId]);
            taken.add(code);
            made.push({ product_id: productId, variant_id: null, name: product.name, sku: code });
        }
    }
    return made;
}

module.exports = { linesWithoutCode, createMissingCodes };
