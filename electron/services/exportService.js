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
const { formatDate } = require('../i18n');

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100 + 0;
const day = (value, T) => (value ? formatDate(value, T.lang, false) : '');
const period = (range, T) => (range?.startDate && range?.endDate ? `${day(range.startDate, T)} — ${day(range.endDate, T)}` : '');

/** Stock, article by article: name, codes, pieces or kg, unit prices and totals (owner). */
function stockSheets(api, T) {
    const lines = stock.stockLines(api);
    const totals = stock.stockTotals(lines);
    // Pieces and kilograms in their own columns: their totals mean something
    const rows = lines.map((l, i) => ({
        n: i + 1, category: l.category, name: l.name, sku: l.sku, barcode: l.barcode, plu: l.plu,
        pieces: l.unit === 'kg' ? null : l.quantity, kg: l.unit === 'kg' ? l.quantity / 1000 : null,
        unit_cost: l.unit_cost, unit_price: l.unit_price, cost_value: l.cost_value, retail_value: l.retail_value, margin_value: l.margin_value,
    }));
    const notes = [T('xl.stock.note')];
    if (totals.pieces_without_cost > 0) notes.unshift(T('xl.stock.noCost', { n: totals.pieces_without_cost }));
    const main = {
        name: T('xl.stock.sheet'), title: T('xl.stock.title'), period: T('xl.asOf', { date: day(new Date(), T) }),
        summary: [
            { label: T('xl.stock.kArticles'), value: totals.articles, type: 'int' },
            { label: T('xl.stock.kPieces'), value: totals.pieces, type: 'int' },
            ...(totals.kg > 0 ? [{ label: T('xl.stock.kKg'), value: totals.kg, type: 'kg' }] : []),
            { label: T('xl.stock.kCost'), value: totals.cost },
            { label: T('xl.stock.kRetail'), value: totals.retail },
            { label: T('xl.stock.kMargin'), value: totals.margin },
        ],
        columns: [
            { key: 'n', label: T('xl.col.n'), type: 'int', width: 6 },
            { key: 'category', label: T('xl.col.category'), type: 'text' },
            { key: 'name', label: T('xl.col.article'), type: 'text' },
            { key: 'sku', label: T('xl.col.sku'), type: 'code' },
            { key: 'barcode', label: T('xl.col.barcode'), type: 'code' },
            // The scale's number of an article sold by weight (its code when it has no barcode)
            { key: 'plu', label: T('xl.col.plu'), type: 'code', width: 7 },
            { key: 'pieces', label: T('xl.col.pieces'), type: 'int', total: 'sum' },
            { key: 'kg', label: T('xl.col.kg'), type: 'kg', total: 'sum' },
            { key: 'unit_cost', label: T('xl.col.unitCost'), type: 'money' },
            { key: 'unit_price', label: T('xl.col.unitPrice'), type: 'money' },
            // Formulas: a quantity changed in the file changes its totals (one of pieces / kg is empty)
            { key: 'cost_value', label: T('xl.col.costValue'), type: 'money', total: 'sum', formula: (c) => `MAX(0,${c('pieces')}+${c('kg')})*${c('unit_cost')}` },
            { key: 'retail_value', label: T('xl.col.retailValue'), type: 'money', total: 'sum', formula: (c) => `MAX(0,${c('pieces')}+${c('kg')})*${c('unit_price')}` },
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
            { key: 'kg', label: T('xl.col.kg'), type: 'kg', total: 'sum' },
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
        SELECT p.name, c.name AS category, p.sku, p.barcode, p.price, p.cost, p.wholesale_price, p.stock_quantity, p.unit, p.carton_qty
        FROM products p LEFT JOIN categories c ON c.id = p.category_id
        WHERE COALESCE(p.is_active, 1) = 1
        ORDER BY c.name, p.name`).map((p, i) => ({
        ...p, n: i + 1,
        pieces: p.unit === 'kg' ? null : p.stock_quantity, kg: p.unit === 'kg' ? (Number(p.stock_quantity) || 0) / 1000 : null,
        unit: T(p.unit === 'kg' ? 'xl.unit.kg' : 'xl.unit.piece'), carton_qty: Number(p.carton_qty) > 1 ? p.carton_qty : null,
    }));
    const columns = [
        { key: 'n', label: T('xl.col.n'), type: 'int', width: 6 },
        { key: 'category', label: T('xl.col.category'), type: 'text' },
        { key: 'name', label: T('xl.col.article'), type: 'text' },
        { key: 'sku', label: T('xl.col.sku'), type: 'code' },
        { key: 'barcode', label: T('xl.col.barcode'), type: 'code' },
        { key: 'unit', label: T('xl.col.soldBy'), type: 'text' },
        { key: 'carton_qty', label: T('xl.col.cartonQty'), type: 'int' },
        { key: 'pieces', label: T('xl.col.pieces'), type: 'int', total: 'sum' },
        { key: 'kg', label: T('xl.col.kg'), type: 'kg', total: 'sum' },
        ...(withCost ? [{ key: 'cost', label: T('xl.col.unitCost'), type: 'money' }] : []),
        { key: 'price', label: T('xl.col.unitPrice'), type: 'money' },
        { key: 'wholesale_price', label: T('xl.col.wholesale'), type: 'money' },
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
               si.product_name AS name, si.weight_grams, si.sku, si.quantity, si.unit_price, COALESCE(si.discount, 0) AS discount,
               si.total, ROUND(si.quantity * COALESCE(si.unit_cost, 0), 2) AS cost
        FROM sale_items si JOIN sales s ON s.id = si.sale_id
        LEFT JOIN employees e ON e.id = s.employee_id
        LEFT JOIN customers c ON c.id = s.customer_id
        WHERE datetime(s.created_at) BETWEEN datetime(?) AND datetime(?) AND ${countedSale('s')}
        ORDER BY s.created_at, s.receipt_number`, [range?.startDate, range?.endDate])
        .map(r => ({ ...r, kg: Number(r.weight_grams) > 0 ? r.weight_grams / 1000 : null, profit: r2(r.total - r.cost) }));
    const columns = [
        { key: 'date', label: T('xl.col.date'), type: 'date' },
        { key: 'ticket', label: T('xl.col.ticket'), type: 'code' },
        { key: 'employee', label: T('xl.col.employee'), type: 'text' },
        { key: 'customer', label: T('xl.col.customer'), type: 'text' },
        { key: 'name', label: T('xl.col.article'), type: 'text' },
        // Sold by weight: the weight of the line (quantity 1, price for that weight)
        { key: 'kg', label: T('xl.col.kg'), type: 'kg', total: 'sum' },
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


/** A month 'YYYY-MM' on the shop's clock: its first and last instant, and its name ("octobre 2026"). */
function monthRange(month, lang = 'ar', now = new Date()) {
    const [y, m] = String(month || '').split('-').map(Number);
    const first = Number.isInteger(y) && m >= 1 && m <= 12 ? new Date(y, m - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
    const next = new Date(first.getFullYear(), first.getMonth() + 1, 1);
    const name = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-DZ' : 'en-GB', { month: 'long', year: 'numeric' }).format(first);
    return { startDate: first.toISOString(), endDate: new Date(next.getTime() - 1).toISOString(), name };
}

/** The kridi paid in during a period (cash that is not in the sales journal: the sale was counted as kridi). */
function kridiPaidIn(api, range) {
    return api.all(`
        SELECT cp.created_at AS date, cs.invoice_number, c.name AS customer, LOWER(cp.payment_method) AS method, cp.amount, e.name AS employee
        FROM credit_payments cp
        JOIN credit_sales cs ON cs.id = cp.credit_sale_id
        LEFT JOIN customers c ON c.id = cs.customer_id
        LEFT JOIN employees e ON e.id = cp.received_by
        WHERE datetime(cp.created_at) BETWEEN datetime(?) AND datetime(?)
        ORDER BY datetime(cp.created_at)`, [range.startDate, range.endDate]).map(p => ({ ...p, amount: r2(p.amount) }));
}

/**
 * One file for the accountant, for one month: the month in short (sales, returns,
 * TVA, each way of paying, kridi paid in, stock value), the sales journal, the
 * kridi paid in, and the stock today. Every figure is the one of its own sheet.
 */
function accountantSheets(api, T, { month } = {}) {
    const range = monthRange(month, T.lang);
    const journal = salesJournal(api, range);
    const sales = journal.rows.filter(r => r.type === 'sale');
    const returns = journal.rows.filter(r => r.type === 'return');
    const sum = (rows, key) => r2(rows.reduce((t, r) => t + (Number(r[key]) || 0), 0));
    const paidIn = kridiPaidIn(api, range);
    const stockTotals = stock.stockTotals(stock.stockLines(api));
    const line = (key, value) => ({ item: T(`xl.acc.${key}`), amount: r2(value) });
    const summaryRows = [
        line('sales', sum(sales, 'amount_ttc')),
        line('returns', sum(returns, 'amount_ttc')),
        line('net', journal.totals.amount_ttc),
        line('ht', journal.totals.amount_ht),
        line('tva', journal.totals.tva),
        ...['cash', 'card', 'transfer', 'credit', 'gift_card', 'other'].map(m => line(`by.${m}`, sum(journal.rows, m))),
        line('kridiPaidIn', sum(paidIn, 'amount')),
        line('stockCost', stockTotals.cost),
        line('stockRetail', stockTotals.retail),
    ];
    const asOf = T('xl.asOf', { date: day(new Date(), T) });
    const [journalSheet] = journalSheets(api, T, range);
    const [stockSheet, byCategory] = stockSheets(api, T);
    return [
        {
            name: T('xl.acc.sheet'), title: T('xl.acc.title', { month: range.name }), period: period(range, T),
            summary: [
                { label: T('xl.acc.kTickets'), value: sales.length, type: 'int' },
                { label: T('xl.acc.kReturns'), value: returns.length, type: 'int' },
                { label: T('xl.acc.net'), value: journal.totals.amount_ttc },
            ],
            columns: [
                { key: 'item', label: T('xl.acc.item'), type: 'text', width: 44 },
                { key: 'amount', label: T('xl.acc.amount'), type: 'money', width: 20 },
            ],
            rows: summaryRows,
            notes: [T('xl.acc.note1'), T('xl.acc.note2', { date: asOf })],
        },
        { ...journalSheet, title: `${journalSheet.title} — ${range.name}` },
        {
            name: T('xl.acc.kridiSheet'), title: T('xl.acc.kridiTitle', { month: range.name }), period: period(range, T),
            columns: [
                { key: 'date', label: T('xl.col.date'), type: 'date' },
                { key: 'invoice_number', label: T('xl.col.invoice'), type: 'code' },
                { key: 'customer', label: T('xl.col.customer'), type: 'text' },
                { key: 'method', label: T('xl.col.type'), type: 'text' },
                { key: 'employee', label: T('xl.col.employee'), type: 'text' },
                { key: 'amount', label: T('xl.col.paid'), type: 'money', total: 'sum' },
            ],
            rows: paidIn.map(p => ({ ...p, method: T(`xl.acc.by.${['cash', 'card', 'transfer'].includes(p.method) ? p.method : 'other'}`) })),
        },
        { ...stockSheet, period: asOf },
        byCategory,
    ];
}

/**
 * A customer's account, line by line: each kridi (its first amount), each
 * return that lowered it, each payment, and what is left after each line.
 * The last balance is what the customer owes now (as on the screens).
 */
function customerStatementSheets(api, T, { customerId } = {}) {
    const customer = api.get('SELECT id, name, phone, address FROM customers WHERE id = ?', [customerId]);
    if (!customer) throw new Error('CUSTOMER_NOT_FOUND|{}');
    const lines = [];
    for (const k of api.all(`
        SELECT cs.id, cs.sale_id, cs.invoice_number, cs.created_at, cs.due_date, cs.amount_due, s.receipt_number,
               COALESCE((SELECT SUM(COALESCE(r.credit_reduced, 0)) FROM returns r WHERE r.sale_id = cs.sale_id), 0) AS lowered
        FROM credit_sales cs LEFT JOIN sales s ON s.id = cs.sale_id
        WHERE cs.customer_id = ?`, [customerId])) {
        const ticket = k.receipt_number ? ` (${T('xl.col.ticket')} ${k.receipt_number})` : '';
        lines.push({ date: k.created_at, what: `${T('xl.st.kridi')} ${k.invoice_number}${ticket}`, due: k.due_date, debit: r2(k.amount_due + k.lowered), credit: 0 });
    }
    for (const r of api.all(`
        SELECT r.created_at, r.return_number, r.credit_reduced, cs.invoice_number
        FROM returns r JOIN credit_sales cs ON cs.sale_id = r.sale_id
        WHERE cs.customer_id = ? AND COALESCE(r.credit_reduced, 0) > 0`, [customerId])) {
        lines.push({ date: r.created_at, what: `${T('xl.st.return')} ${r.return_number} — ${r.invoice_number}`, debit: 0, credit: r2(r.credit_reduced) });
    }
    for (const p of api.all(`
        SELECT cp.created_at, cp.amount, LOWER(cp.payment_method) AS method, cs.invoice_number
        FROM credit_payments cp JOIN credit_sales cs ON cs.id = cp.credit_sale_id
        WHERE cs.customer_id = ?`, [customerId])) {
        const way = T(`xl.acc.by.${['cash', 'card', 'transfer'].includes(p.method) ? p.method : 'other'}`);
        lines.push({ date: p.created_at, what: `${T('xl.st.payment')} (${way}) — ${p.invoice_number}`, debit: 0, credit: r2(p.amount) });
    }
    const at = (v) => new Date(String(v).includes('T') ? v : `${String(v).replace(' ', 'T')}Z`).getTime();
    lines.sort((a, b) => at(a.date) - at(b.date) || b.debit - a.debit);
    let balance = 0;
    const rows = lines.map((l, i) => { balance = r2(balance + l.debit - l.credit); return { n: i + 1, ...l, balance }; });
    const taken = r2(lines.reduce((t, l) => t + l.debit, 0));
    const given = r2(lines.reduce((t, l) => t + l.credit, 0));
    return [{
        name: T('xl.st.sheet'), title: T('xl.st.title', { name: customer.name }), period: T('xl.asOf', { date: day(new Date(), T) }),
        summary: [
            { label: T('xl.col.customer'), value: customer.name, type: 'text' },
            ...(customer.phone ? [{ label: T('xl.col.phone'), value: customer.phone, type: 'text' }] : []),
            { label: T('xl.st.kTaken'), value: taken },
            { label: T('xl.st.kGiven'), value: given },
            { label: T('xl.st.kLeft'), value: balance },
        ],
        columns: [
            { key: 'n', label: T('xl.col.n'), type: 'int', width: 6 },
            { key: 'date', label: T('xl.col.date'), type: 'date' },
            { key: 'what', label: T('xl.st.what'), type: 'text', width: 42 },
            { key: 'due', label: T('xl.col.dueDate'), type: 'date' },
            { key: 'debit', label: T('xl.st.debit'), type: 'money', total: 'sum' },
            { key: 'credit', label: T('xl.st.credit'), type: 'money', total: 'sum' },
            { key: 'balance', label: T('xl.st.balance'), type: 'money' },
        ],
        rows,
        notes: [T('xl.st.note')],
        customer, balance,
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
    accountant: { sheets: (api, T, args) => accountantSheets(api, T, args), file: 'xl.acc.file', fileArgs: (api, T, args) => ({ month: monthRange(args.month, T.lang).name }) },
    customerStatement: { sheets: (api, T, args) => customerStatementSheets(api, T, args), file: 'xl.st.file', fileArgs: (api, T, args) => ({ name: api.get('SELECT name FROM customers WHERE id = ?', [args.customerId])?.name || '' }) },
};

module.exports = { EXPORTS, monthRange, kridiPaidIn, accountantSheets, customerStatementSheets, stockSheets, productSheets, journalSheets, salesLineSheets, customerSheets, kridiSheets, supplierSheets };
