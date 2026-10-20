/**
 * What each Excel file of the shop holds (the look is services/excelReport.js).
 * Every figure comes from the same services as the screens: the stock from
 * stockService, the sales journal from accountingService, customers and
 * suppliers from partnersService. `T` is translator(lang) from electron/i18n.
 *
 * Each function returns the sheets for excelReport.buildWorkbook.
 */
const stock = require('./stockService');
const { salesJournal } = require('./accountingService');
const partners = require('./partnersService');
const { countedSale } = require('./saleStatus');
const { colorName, sizeLabel, formatDate } = require('../i18n');

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const day = (value, T) => (value ? formatDate(value, T.lang, false) : '');
const period = (range, T) => (range?.startDate && range?.endDate ? `${day(range.startDate, T)} — ${day(range.endDate, T)}` : '');

/** Stock, size by size: name, QR, codes, quantity, unit prices and totals (owner). */
function stockSheets(api, T) {
    const lines = stock.stockLines(api);
    const totals = stock.stockTotals(lines);
    const rows = lines.map((l, i) => ({
        n: i + 1, category: l.category, name: l.name, brand: l.brand,
        color: colorName({ color: l.color, color_code: l.color_code }, T.lang), size: sizeLabel(l.size, T.lang),
        qr: l.qr, sku: l.sku, barcode: l.barcode, quantity: l.quantity,
        unit_cost: l.unit_cost, unit_price: l.unit_price, cost_value: l.cost_value, retail_value: l.retail_value, margin_value: l.margin_value,
    }));
    const notes = [T('xl.stock.note')];
    if (totals.pieces_without_cost > 0) notes.unshift(T('xl.stock.noCost', { n: totals.pieces_without_cost }));
    const main = {
        name: T('xl.stock.sheet'), title: T('xl.stock.title'), period: T('xl.asOf', { date: day(new Date(), T) }),
        summary: [
            { label: T('xl.stock.kArticles'), value: totals.articles, type: 'int' },
            { label: T('xl.stock.kPieces'), value: totals.pieces, type: 'int' },
            { label: T('xl.stock.kCost'), value: totals.cost },
            { label: T('xl.stock.kRetail'), value: totals.retail },
            { label: T('xl.stock.kMargin'), value: totals.margin },
        ],
        columns: [
            { key: 'n', label: T('xl.col.n'), type: 'int', width: 6 },
            { key: 'category', label: T('xl.col.category'), type: 'text' },
            { key: 'name', label: T('xl.col.article'), type: 'text' },
            { key: 'brand', label: T('xl.col.brand'), type: 'text' },
            { key: 'color', label: T('xl.col.color'), type: 'text' },
            { key: 'size', label: T('xl.col.size'), type: 'text' },
            { key: 'qr', label: T('xl.col.qr'), type: 'code' },
            { key: 'sku', label: T('xl.col.sku'), type: 'code' },
            { key: 'barcode', label: T('xl.col.barcode'), type: 'code' },
            { key: 'quantity', label: T('xl.col.quantity'), type: 'int', total: 'sum' },
            { key: 'unit_cost', label: T('xl.col.unitCost'), type: 'money' },
            { key: 'unit_price', label: T('xl.col.unitPrice'), type: 'money' },
            // Formulas: a quantity changed in the file changes its totals
            { key: 'cost_value', label: T('xl.col.costValue'), type: 'money', total: 'sum', formula: (c) => `MAX(0,${c('quantity')})*${c('unit_cost')}` },
            { key: 'retail_value', label: T('xl.col.retailValue'), type: 'money', total: 'sum', formula: (c) => `MAX(0,${c('quantity')})*${c('unit_price')}` },
            { key: 'margin_value', label: T('xl.col.margin'), type: 'money', total: 'sum', formula: (c) => `${c('retail_value')}-${c('cost_value')}` },
        ],
        rows, notes,
    };
    const byCategory = {
        name: T('xl.stock.byCategory'), title: T('xl.stock.byCategoryTitle'), period: main.period,
        columns: [
            { key: 'category', label: T('xl.col.category'), type: 'text' },
            { key: 'articles', label: T('xl.col.articles'), type: 'int', total: 'sum' },
            { key: 'pieces', label: T('xl.col.pieces'), type: 'int', total: 'sum' },
            { key: 'cost', label: T('xl.col.costValue'), type: 'money', total: 'sum' },
            { key: 'retail', label: T('xl.col.retailValue'), type: 'money', total: 'sum' },
            { key: 'margin', label: T('xl.col.margin'), type: 'money', total: 'sum', formula: (c) => `${c('retail')}-${c('cost')}` },
            { key: 'rate', label: T('xl.col.marginRate'), type: 'percent', formula: (c) => `IF(${c('retail')}>0,${c('margin')}/${c('retail')},0)` },
        ],
        rows: stock.byCategory(lines).map(g => ({ ...g, category: g.category || '—', rate: g.retail > 0 ? r2(g.margin / g.retail * 10000) / 10000 : 0 })),
    };
    return [main, byCategory];
}

/** The articles and their prices (one line per article). */
function productSheets(api, T, { withCost = true } = {}) {
    const rows = api.all(`
        SELECT p.name, c.name AS category, p.brand, p.season, p.sku, p.barcode, p.price, p.cost, p.wholesale_price, p.stock_quantity,
               COALESCE(p.show_on_website, 1) AS online,
               (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id AND COALESCE(v.is_active, 1) = 1) AS sizes
        FROM products p LEFT JOIN categories c ON c.id = p.category_id
        WHERE COALESCE(p.is_active, 1) = 1
        ORDER BY c.name, p.name`).map((p, i) => ({ ...p, n: i + 1, online: p.online ? T('xl.yes') : T('xl.no'), sizes: p.sizes || '' }));
    const columns = [
        { key: 'n', label: T('xl.col.n'), type: 'int', width: 6 },
        { key: 'category', label: T('xl.col.category'), type: 'text' },
        { key: 'name', label: T('xl.col.article'), type: 'text' },
        { key: 'brand', label: T('xl.col.brand'), type: 'text' },
        { key: 'season', label: T('xl.col.season'), type: 'text' },
        { key: 'sku', label: T('xl.col.sku'), type: 'code' },
        { key: 'barcode', label: T('xl.col.barcode'), type: 'code' },
        { key: 'sizes', label: T('xl.col.sizes'), type: 'int' },
        { key: 'stock_quantity', label: T('xl.col.pieces'), type: 'int', total: 'sum' },
        ...(withCost ? [{ key: 'cost', label: T('xl.col.unitCost'), type: 'money' }] : []),
        { key: 'price', label: T('xl.col.unitPrice'), type: 'money' },
        { key: 'wholesale_price', label: T('xl.col.wholesale'), type: 'money' },
        { key: 'online', label: T('xl.col.online'), type: 'text' },
    ];
    return [{ name: T('xl.products.sheet'), title: T('xl.products.title'), period: T('xl.asOf', { date: day(new Date(), T) }), columns, rows }];
}

/** Sales journal for the accountant: every ticket and return, HT / TVA / TTC, each way of paying, all totalled. */
function journalSheets(api, T, range) {
    const journal = salesJournal(api, range || {});
    const money = ['amount_ht', 'tva', 'amount_ttc', 'cash', 'card', 'transfer', 'credit', 'gift_card', 'other'];
    const labels = { amount_ht: 'amountHt', tva: 'tva', amount_ttc: 'amountTtc', cash: 'cash', card: 'card', transfer: 'transfer', credit: 'credit', gift_card: 'giftCard', other: 'other' };
    return [{
        name: T('xl.journal.sheet'), title: T('xl.journal.title'), period: period(range, T),
        columns: [
            { key: 'date', label: T('xl.col.date'), type: 'date' },
            { key: 'type', label: T('xl.col.type'), type: 'text' },
            { key: 'number', label: T('xl.col.ticket'), type: 'code' },
            { key: 'customer', label: T('xl.col.customer'), type: 'text' },
            { key: 'employee', label: T('xl.col.employee'), type: 'text' },
            ...money.map(key => ({ key, label: T(`xl.col.${labels[key]}`), type: 'money', total: 'sum' })),
        ],
        rows: journal.rows.map(row => ({ ...row, type: T(row.type === 'return' ? 'xl.return' : 'xl.sale') })),
    }];
}

/** Every line sold in the period: who, what, how many, at what price, what it cost, what it earned. */
function salesLineSheets(api, T, range, { withCost = true } = {}) {
    const rows = api.all(`
        SELECT s.created_at AS date, s.receipt_number AS ticket, e.name AS employee, c.name AS customer,
               si.product_name AS name, v.color, v.color_code, v.size, si.sku, si.quantity, si.unit_price, COALESCE(si.discount, 0) AS discount,
               si.total, ROUND(si.quantity * COALESCE(si.unit_cost, 0), 2) AS cost
        FROM sale_items si JOIN sales s ON s.id = si.sale_id
        LEFT JOIN product_variants v ON v.id = si.variant_id
        LEFT JOIN employees e ON e.id = s.employee_id
        LEFT JOIN customers c ON c.id = s.customer_id
        WHERE datetime(s.created_at) BETWEEN datetime(?) AND datetime(?) AND ${countedSale('s')}
        ORDER BY s.created_at, s.receipt_number`, [range?.startDate, range?.endDate])
        .map(r => ({ ...r, color: colorName(r, T.lang), size: sizeLabel(r.size, T.lang), profit: r2(r.total - r.cost) }));
    const columns = [
        { key: 'date', label: T('xl.col.date'), type: 'date' },
        { key: 'ticket', label: T('xl.col.ticket'), type: 'code' },
        { key: 'employee', label: T('xl.col.employee'), type: 'text' },
        { key: 'customer', label: T('xl.col.customer'), type: 'text' },
        { key: 'name', label: T('xl.col.article'), type: 'text' },
        { key: 'color', label: T('xl.col.color'), type: 'text' },
        { key: 'size', label: T('xl.col.size'), type: 'text' },
        { key: 'sku', label: T('xl.col.sku'), type: 'code' },
        { key: 'quantity', label: T('xl.col.quantity'), type: 'int', total: 'sum' },
        { key: 'unit_price', label: T('xl.col.unitPrice'), type: 'money' },
        { key: 'discount', label: T('xl.col.discount'), type: 'money', total: 'sum' },
        { key: 'total', label: T('xl.col.lineTotal'), type: 'money', total: 'sum', formula: (c) => `${c('quantity')}*${c('unit_price')}-${c('discount')}` },
        ...(withCost ? [
            { key: 'cost', label: T('xl.col.costTotal'), type: 'money', total: 'sum' },
            { key: 'profit', label: T('xl.col.profit'), type: 'money', total: 'sum', formula: (c) => `${c('total')}-${c('cost')}` },
        ] : []),
    ];
    return [{ name: T('xl.lines.sheet'), title: T('xl.lines.title'), period: period(range, T), columns, rows, notes: [T('xl.lines.note')] }];
}

/** Customers: contact, what they bought, their kridi. */
function customerSheets(api, T) {
    const rows = partners.customersOverview(api).map((c, i) => ({
        n: i + 1, name: c.name, phone: c.phone || '', address: c.address || '', tickets: c.sales_count, total: c.sales_total,
        points: c.loyalty_points || 0, allowed: c.credit_enabled ? T('xl.yes') : T('xl.no'), limit: c.credit_limit || 0, owed: c.owed, last: c.last_sale_at,
    }));
    return [{
        name: T('xl.customers.sheet'), title: T('xl.customers.title'), period: T('xl.asOf', { date: day(new Date(), T) }),
        summary: [{ label: T('xl.kridi.kLeft'), value: r2(rows.reduce((s, r) => s + r.owed, 0)) }],
        columns: [
            { key: 'n', label: T('xl.col.n'), type: 'int', width: 6 },
            { key: 'name', label: T('xl.col.customer'), type: 'text' },
            { key: 'phone', label: T('xl.col.phone'), type: 'code' },
            { key: 'address', label: T('xl.col.address'), type: 'text' },
            { key: 'tickets', label: T('xl.col.tickets'), type: 'int', total: 'sum' },
            { key: 'total', label: T('xl.col.totalSpent'), type: 'money', total: 'sum' },
            { key: 'points', label: T('xl.col.points'), type: 'int' },
            { key: 'allowed', label: T('xl.col.creditAllowed'), type: 'text' },
            { key: 'limit', label: T('xl.col.creditLimit'), type: 'money' },
            { key: 'owed', label: T('xl.col.debt'), type: 'money', total: 'sum' },
            { key: 'last', label: T('xl.col.lastVisit'), type: 'date' },
        ],
        rows,
    }];
}

/** Kridi: each customer debt, what is paid, what is left, how late. */
function kridiSheets(api, T, { now = Date.now(), open = false } = {}) {
    const rows = api.all(`
        SELECT cs.invoice_number, cs.created_at, cs.due_date, cs.amount_due, COALESCE(cs.amount_paid, 0) AS paid,
               c.name AS customer, c.phone, s.receipt_number
        FROM credit_sales cs LEFT JOIN customers c ON c.id = cs.customer_id LEFT JOIN sales s ON s.id = cs.sale_id
        ORDER BY cs.created_at DESC`).map(k => {
        const left = r2(Math.max(0, k.amount_due - k.paid));
        const due = k.due_date ? new Date(String(k.due_date).replace(' ', 'T')).getTime() : null;
        const late = left > 0.004 && due && due < now ? Math.floor((now - due) / 86400000) : 0;
        const status = left <= 0.004 ? 'paid' : late > 0 ? 'overdue' : k.paid > 0 ? 'partial' : 'pending';
        return { ...k, left, late, status: T(`xl.status.${status}`), open: left > 0.004 };
    }).filter(k => !open || k.open);
    const owed = r2(rows.reduce((s, r) => s + r.left, 0));
    const late = r2(rows.filter(r => r.late > 0).reduce((s, r) => s + r.left, 0));
    return [{
        name: T('xl.kridi.sheet'), title: T('xl.kridi.title'), period: T('xl.asOf', { date: day(new Date(now), T) }),
        summary: [{ label: T('xl.kridi.kLeft'), value: owed }, { label: T('xl.kridi.kLate'), value: late }],
        columns: [
            { key: 'invoice_number', label: T('xl.col.invoice'), type: 'code' },
            { key: 'receipt_number', label: T('xl.col.ticket'), type: 'code' },
            { key: 'created_at', label: T('xl.col.date'), type: 'date' },
            { key: 'customer', label: T('xl.col.customer'), type: 'text' },
            { key: 'phone', label: T('xl.col.phone'), type: 'code' },
            { key: 'amount_due', label: T('xl.col.amountDue'), type: 'money', total: 'sum' },
            { key: 'paid', label: T('xl.col.paid'), type: 'money', total: 'sum' },
            { key: 'left', label: T('xl.col.left'), type: 'money', total: 'sum', formula: (c) => `MAX(0,${c('amount_due')}-${c('paid')})` },
            { key: 'due_date', label: T('xl.col.dueDate'), type: 'date' },
            { key: 'late', label: T('xl.col.lateDays'), type: 'int' },
            { key: 'status', label: T('xl.col.status'), type: 'text' },
        ],
        rows,
    }];
}

/** Suppliers: goods received, paid, sent back, still owed (what arrived only). */
function supplierSheets(api, T) {
    const rows = partners.suppliersOverview(api).map((s, i) => ({
        n: i + 1, name: s.name, contact: s.contact_person || '', phone: s.phone || '', orders: s.orders_count,
        received: s.received_total, paid: s.received_paid, returned: s.returned_total, owed: s.owed, last: s.last_received_at,
    }));
    return [{
        name: T('xl.suppliers.sheet'), title: T('xl.suppliers.title'), period: T('xl.asOf', { date: day(new Date(), T) }),
        summary: [{ label: T('xl.suppliers.kOwed'), value: r2(rows.reduce((s, r) => s + r.owed, 0)) }],
        columns: [
            { key: 'n', label: T('xl.col.n'), type: 'int', width: 6 },
            { key: 'name', label: T('xl.col.supplier'), type: 'text' },
            { key: 'contact', label: T('xl.col.contact'), type: 'text' },
            { key: 'phone', label: T('xl.col.phone'), type: 'code' },
            { key: 'orders', label: T('xl.col.orders'), type: 'int', total: 'sum' },
            { key: 'received', label: T('xl.col.received'), type: 'money', total: 'sum' },
            { key: 'paid', label: T('xl.col.paid'), type: 'money', total: 'sum' },
            { key: 'returned', label: T('xl.col.returned'), type: 'money', total: 'sum' },
            { key: 'owed', label: T('xl.col.owed'), type: 'money', total: 'sum' },
            { key: 'last', label: T('xl.col.lastReceived'), type: 'date' },
        ],
        rows,
    }];
}

const EXPORTS = {
    stock: { sheets: (api, T) => stockSheets(api, T), file: 'xl.stock.sheet' },
    products: { sheets: (api, T, args) => productSheets(api, T, args), file: 'xl.products.sheet' },
    journal: { sheets: (api, T, args) => journalSheets(api, T, args.range), file: 'xl.journal.sheet' },
    salesLines: { sheets: (api, T, args) => salesLineSheets(api, T, args.range, args), file: 'xl.lines.sheet' },
    customers: { sheets: (api, T) => customerSheets(api, T), file: 'xl.customers.sheet' },
    kridi: { sheets: (api, T, args) => kridiSheets(api, T, args), file: 'xl.kridi.sheet' },
    suppliers: { sheets: (api, T) => supplierSheets(api, T), file: 'xl.suppliers.sheet' },
};

module.exports = { EXPORTS, stockSheets, productSheets, journalSheets, salesLineSheets, customerSheets, kridiSheets, supplierSheets };
