/**
 * The kridi of a sale: its invoice (INV-YYMMDD-0001) and the customer's debt,
 * written inside the caller's transaction. `api` is the { get, run, uuid } adapter.
 */
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const pad = (n, size = 2) => String(n).padStart(size, '0');

/** Next invoice number of the day: the highest one + 1 (a deleted invoice never gives a number twice). */
function nextInvoiceNumber(api, date = new Date()) {
    const prefix = `INV-${String(date.getFullYear()).slice(-2)}${pad(date.getMonth() + 1)}${pad(date.getDate())}-`;
    const last = api.get('SELECT invoice_number FROM credit_sales WHERE invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1', [`${prefix}%`]);
    const n = last ? (parseInt(String(last.invoice_number).slice(prefix.length), 10) || 0) + 1 : 1;
    return `${prefix}${pad(n, 4)}`;
}

/** A customer's debt for one sale (inside the caller's transaction). */
function createCreditSale(api, creditSale) {
    const invoiceNumber = creditSale.invoice_number || nextInvoiceNumber(api);
    const id = creditSale.id || api.uuid();
    // 30 days to pay unless another date was chosen
    const dueDate = creditSale.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const amountDue = r2(creditSale.amount_due);
    api.run(`
        INSERT INTO credit_sales (id, sale_id, customer_id, invoice_number, amount_due, amount_paid, status, due_date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, creditSale.sale_id, creditSale.customer_id, invoiceNumber, amountDue, r2(creditSale.amount_paid), creditSale.status || 'pending', dueDate, creditSale.notes || null]);
    api.run('UPDATE customers SET credit_balance = ROUND(COALESCE(credit_balance, 0) + ?, 2), updated_at = CURRENT_TIMESTAMP WHERE id = ?', [amountDue, creditSale.customer_id]);
    return { ...creditSale, id, amount_due: amountDue, invoice_number: invoiceNumber, due_date: dueDate };
}

module.exports = { nextInvoiceNumber, createCreditSale };
