// IPC handlers: credit. Moved out of main.js unchanged; main.js passes what they use.
module.exports = function register(ctx) {
    const {
        SyncManager,
        createCreditSale,
        generateInvoiceNumber,
        getOne,
        ipcMain,
        runInsert,
        runQuery,
        runTransaction,
        uuid,
        dbApi,
        getSettingValue,
    } = ctx;
    const karni = require('../services/karniService');

    ipcMain.handle('db:creditSales:getAll', (_, params = {}) => {
      let query = `
    SELECT cs.*, s.receipt_number, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
    FROM credit_sales cs
    LEFT JOIN sales s ON cs.sale_id = s.id
    LEFT JOIN customers c ON cs.customer_id = c.id
  `;

      const conditions = [];
      const values = [];

      if (params.customerId) {
        conditions.push('cs.customer_id = ?');
        values.push(params.customerId);
      }

      if (params.status) {
        conditions.push('cs.status = ?');
        values.push(params.status);
      }

      if (params.startDate) {
        conditions.push('cs.created_at >= ?');
        values.push(params.startDate);
      }

      if (params.endDate) {
        conditions.push('cs.created_at <= ?');
        values.push(params.endDate);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY cs.created_at DESC';

      return runQuery(query, values);
    });

    ipcMain.handle('db:creditSales:getById', (_, id) => {
      const creditSale = getOne(`
    SELECT cs.*, s.receipt_number, s.subtotal, s.tax_amount, s.discount_amount,
           c.name as customer_name, c.email as customer_email, c.phone as customer_phone, c.address as customer_address
    FROM credit_sales cs
    LEFT JOIN sales s ON cs.sale_id = s.id
    LEFT JOIN customers c ON cs.customer_id = c.id
    WHERE cs.id = ?
  `, [id]);

      if (creditSale) {
        // Get sale items
        creditSale.items = runQuery('SELECT * FROM sale_items WHERE sale_id = ?', [creditSale.sale_id]);
        // Get payments made
        creditSale.payments = runQuery(`
      SELECT cp.*, e.name as received_by_name
      FROM credit_payments cp
      LEFT JOIN employees e ON cp.received_by = e.id
      WHERE cp.credit_sale_id = ?
      ORDER BY cp.created_at DESC
    `, [id]);
      }

      return creditSale;
    });

    ipcMain.handle('db:creditSales:getByCustomer', (_, customerId) => {
      return runQuery(`
    SELECT cs.*, s.receipt_number
    FROM credit_sales cs
    LEFT JOIN sales s ON cs.sale_id = s.id
    WHERE cs.customer_id = ?
    ORDER BY cs.created_at DESC
  `, [customerId]);
    });

    ipcMain.handle('db:creditSales:create', (_, creditSale) => runTransaction(() => createCreditSale(creditSale)));

    ipcMain.handle('db:creditSales:update', (_, creditSale) => {
      runInsert(`
    UPDATE credit_sales 
    SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [creditSale.status, creditSale.notes || null, creditSale.id]);

      return creditSale;
    });

    // Credit Payments
    // One ticket's debt paid (the same rule as «خلّص بعض»: services/karniService.js)
    ipcMain.handle('db:creditPayments:create', (_, input) => runTransaction(() => {
      const payment = input || {};
      const saved = karni.recordPayment(dbApi, {
        id: payment.id || uuid(), creditSaleId: payment.credit_sale_id, amount: payment.amount, method: payment.payment_method,
        reference: payment.reference || null, receivedBy: payment.received_by || null, notes: payment.notes || null,
      });
      SyncManager.triggerSync();
      return { ...payment, ...saved };
    }));

    // The karni: who owes what, «خلّص بعض» against the whole balance, the statement's lines
    ipcMain.handle('karni:balances', () => karni.balances(dbApi));
    ipcMain.handle('karni:lines', (_, customerId) => karni.openLines(dbApi, customerId));
    ipcMain.handle('karni:openingDebt', (_, input = {}) => runTransaction(() => karni.openingDebt(dbApi, {
      name: input.name, phone: input.phone, amount: input.amount, date: input.date, defaultLimit: getSettingValue('karni_default_limit'),
    })));
    ipcMain.handle('karni:payPart', (_, input = {}) => runTransaction(() => karni.payPart(dbApi, {
      customerId: input.customerId, amount: input.amount, method: input.method === 'card' ? 'card' : 'cash', receivedBy: input.receivedBy || null,
    })));

    ipcMain.handle('db:creditPayments:getByCreditSale', (_, creditSaleId) => {
      return runQuery(`
    SELECT cp.*, e.name as received_by_name
    FROM credit_payments cp
    LEFT JOIN employees e ON cp.received_by = e.id
    WHERE cp.credit_sale_id = ?
    ORDER BY cp.created_at DESC
  `, [creditSaleId]);
    });

    ipcMain.handle('db:creditPayments:getById', (_, paymentId) => {
      return getOne(`
      SELECT cp.*, cs.invoice_number, c.name as customer_name,
             (cs.amount_due - cs.amount_paid) as remaining_balance
      FROM credit_payments cp
      JOIN credit_sales cs ON cp.credit_sale_id = cs.id
      JOIN customers c ON cs.customer_id = c.id
      WHERE cp.id = ?
    `, [paymentId]);
    });

    // Generate invoice number handler
    ipcMain.handle('db:creditSales:generateInvoiceNumber', () => {
      return generateInvoiceNumber();
    });

};
