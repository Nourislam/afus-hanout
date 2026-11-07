/**
 * Official prices (الأسعار المسقّفة) and the scarcity limit (حد الندرة).
 *
 * Milk in bags, bread, oil, sugar, semolina and flour have prices set by the
 * State (some with half dinars). The program does not know today's official
 * price: it lists the shop's articles that look subsidised and have none
 * yet, for the owner to enter it (the sale is then refused above it). When an
 * article runs short, the owner can set how many one customer may take on a
 * ticket (products.max_per_customer), checked by the cart and the main process.
 * `api` is the { all, get, run } adapter.
 */

// Words of the subsidised goods' names, in Arabic, French and English
const SUBSIDISED = /حليب\s*(?:كيس|أكياس)|كيس\s*حليب|lait\s*(?:en\s*)?sachet|milk\s*bag|خبز|baguette|\bpain\b|bread|زيت|huile|\boil\b|سكر|sucre|sugar|سميد|semoule|semolina|فرينة|دقيق|farine|flour/i;

/** Articles with an official price, and subsidised-looking ones without. */
function review(api) {
    const all = api.all(`SELECT id, name, price, capped_price, max_per_customer FROM products
                         WHERE is_active = 1 AND COALESCE(unit, 'piece') <> 'service' ORDER BY name`);
    return {
        capped: all.filter(p => Number(p.capped_price) > 0),
        suggested: all.filter(p => !(Number(p.capped_price) > 0) && SUBSIDISED.test(p.name)),
    };
}

/** How many one customer may take on a ticket (0 or empty: no limit). */
function setLimit(api, productId, max) {
    const n = Math.floor(Number(max) || 0);
    api.run('UPDATE products SET max_per_customer = ? WHERE id = ?', [n > 0 ? n : null, productId]);
    return n > 0 ? n : null;
}

module.exports = { review, setLimit, SUBSIDISED };
