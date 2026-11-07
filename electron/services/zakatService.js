/**
 * The shop's figures for the zakat estimate (shared/zakat.ts does the sum):
 * the goods at purchase price and at sale price, what customers owe on the
 * karni, what the shop owes its suppliers, and the cash expected in the
 * drawers still open. Nothing is decided here: the merchant chooses what to
 * count. `api` is the { all, get } adapter.
 */
const { stockValue } = require('./dashboardService');
const { suppliersOverview } = require('./partnersService');

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100 + 0;

/** @param {{ drawers?: number }} extra the cash expected in the open drawers (shiftService) */
function zakatFigures(api, { drawers = 0 } = {}) {
    const stock = stockValue(api);
    const receivables = api.get(`SELECT COALESCE(SUM(amount_due - COALESCE(amount_paid, 0)), 0) AS n FROM credit_sales
                                 WHERE ROUND(amount_due - COALESCE(amount_paid, 0), 2) > 0`).n;
    const payables = suppliersOverview(api).reduce((s, x) => s + (Number(x.owed) || 0), 0);
    return {
        goodsCost: r2(stock.cost), goodsRetail: r2(stock.retail),
        receivables: r2(receivables), payables: r2(payables), drawers: r2(drawers),
    };
}

module.exports = { zakatFigures };
