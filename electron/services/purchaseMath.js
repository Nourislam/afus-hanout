/**
 * The money of a purchase order, computed here and not taken from the window:
 * each line = quantity × purchase price, then the order's discount (amount or
 * %), its TVA on what is left, and the transport. Rounded to the cent.
 */
// Half a cent goes up (2 300.555 → 2 300.56), without the binary error of n × 100
const r2 = (n) => Math.round(Number(((Number(n) || 0) * 100).toPrecision(15))) / 100;

function poTotals(po = {}) {
    const items = (po.items || []).map(item => {
        const quantity = Math.max(0, Number(item.quantity) || 0);
        const unitCost = Math.max(0, r2(item.unit_cost));
        return { ...item, quantity, unit_cost: unitCost, total_cost: r2(quantity * unitCost) };
    });
    const subtotal = r2(items.reduce((sum, item) => sum + item.total_cost, 0));
    const value = Math.max(0, Number(po.discount_value) || 0);
    const discount = r2(Math.min(subtotal, po.discount_type === 'percent' ? subtotal * Math.min(100, value) / 100 : value));
    const taxRate = Math.max(0, Number(po.tax_rate) || 0);
    const taxAmount = r2((subtotal - discount) * taxRate / 100);
    const shipping = Math.max(0, r2(po.shipping_cost));
    return { items, subtotal, discount, tax_rate: taxRate, tax_amount: taxAmount, shipping_cost: shipping, total: r2(subtotal - discount + taxAmount + shipping) };
}

module.exports = { poTotals };
