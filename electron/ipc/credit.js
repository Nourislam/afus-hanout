// IPC handlers: credit. Moved out of main.js unchanged; main.js passes what they use.
module.exports = function register(ctx) {
    const {
        getStoreSettings,
        BRAND,
        SyncManager,
        createCreditSale,
        fs,
        generateInvoiceNumber,
        getOne,
        getSettings,
        initEmailService,
        ipcMain,
        runInsert,
        runQuery,
        runTransaction,
        uuid,
        catalog,
    } = ctx;
    const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

    ipcMain.handle('db:creditSales:getAll', (_, params = {}) => {
      console.log('db:creditSales:getAll called with:', params);
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
    ipcMain.handle('db:creditPayments:create', (_, input) => runTransaction(() => {
      let payment = input || {};
      const id = payment.id || uuid();

      // Get the credit sale
      const creditSale = getOne('SELECT * FROM credit_sales WHERE id = ?', [payment.credit_sale_id]);
      if (!creditSale) {
        throw new Error('Credit sale not found');
      }
      // More than 0 and never more than what is still owed (to the cent)
      const left = r2((creditSale.amount_due || 0) - (creditSale.amount_paid || 0));
      const amount = r2(payment.amount);
      if (!(amount > 0) || amount > left + 0.004) throw catalog.codedError('CREDIT_PAYMENT_AMOUNT', { left });
      payment = { ...payment, amount };

      // Record the payment
      runInsert(`
    INSERT INTO credit_payments (id, credit_sale_id, amount, payment_method, reference, received_by, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
        id,
        payment.credit_sale_id,
        payment.amount,
        payment.payment_method,
        payment.reference || null,
        payment.received_by || null,
        payment.notes || null
      ]);

      // Update credit sale
      const newAmountPaid = r2((creditSale.amount_paid || 0) + payment.amount);
      let newStatus = 'partial';

      // Fix for floating point precision issues
      // Compare rounded values (cents)
      const paidCents = Math.round(newAmountPaid * 100);
      const dueCents = Math.round(creditSale.amount_due * 100);

      if (paidCents >= dueCents) {
        newStatus = 'paid';
      }

      runInsert(`
    UPDATE credit_sales 
    SET amount_paid = ?, status = ?, updated_at = CURRENT_TIMESTAMP, is_synced = 0
    WHERE id = ?
  `, [newAmountPaid, newStatus, payment.credit_sale_id]);

      // Update customer credit_balance
      runInsert(`
    UPDATE customers 
    SET credit_balance = ROUND(MAX(0, COALESCE(credit_balance, 0) - ?), 2), updated_at = CURRENT_TIMESTAMP, is_synced = 0
    WHERE id = ?
  `, [payment.amount, creditSale.customer_id]);

      SyncManager.triggerSync();
      return { ...payment, id };
    }));

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

    // ==========================================
    // CREDIT SALES
    // ==========================================



    // Credit Invoice Email
    ipcMain.handle('creditInvoice:sendEmail', async (_, { creditSaleId, email }) => {
      const creditSale = getOne(`
    SELECT cs.*, s.receipt_number, s.subtotal, s.tax_amount, s.discount_amount,
           c.name as customer_name, c.email as customer_email, c.phone as customer_phone, c.address as customer_address
    FROM credit_sales cs
    LEFT JOIN sales s ON cs.sale_id = s.id
    LEFT JOIN customers c ON cs.customer_id = c.id
    WHERE cs.id = ?
  `, [creditSaleId]);

      if (!creditSale) {
        throw new Error('Credit sale not found');
      }

      console.log('Sending Credit Invoice Email. Data:', JSON.stringify(creditSale, null, 2));

      creditSale.items = runQuery('SELECT * FROM sale_items WHERE sale_id = ?', [creditSale.sale_id]);
      creditSale.payments = runQuery('SELECT * FROM credit_payments WHERE credit_sale_id = ?', [creditSaleId]);

      // Get settings
      // Every setting, the shop's own details (store_config) on top
      const settings = getStoreSettings();

      // Initialize email service
      if (!initEmailService({
        smtp_host: settings.email_host,
        smtp_port: settings.email_port,
        smtp_user: settings.email_user,
        smtp_pass: settings.email_password,
        smtp_secure: settings.email_secure
      })) {
        throw new Error('Email service not configured');
      }

      // Generate invoice PDF
      const invoiceService = require('../services/invoiceService');
      const pdfPath = await invoiceService.generateInvoicePdf(creditSale, settings);

      try {
        const result = await invoiceService.sendInvoiceEmail({
          to: email || creditSale.customer_email,
          creditSale,
          businessInfo: {
            businessName: settings.businessName || BRAND.productName,
            businessAddress: settings.businessAddress,
            businessPhone: settings.businessPhone,
            businessEmail: settings.businessEmail
          },
          pdfPath
        });

        // Cleanup
        fs.unlink(pdfPath, () => { });

        return result;
      } catch (error) {
        fs.unlink(pdfPath, () => { });
        throw error;
      }
    });

    // Send payment reminder
    ipcMain.handle('creditInvoice:sendReminder', async (_, { creditSaleId, email }) => {
      const creditSale = getOne(`
    SELECT cs.*, c.name as customer_name, c.email as customer_email
    FROM credit_sales cs
    LEFT JOIN customers c ON cs.customer_id = c.id
    WHERE cs.id = ?
  `, [creditSaleId]);

      if (!creditSale) {
        throw new Error('Credit sale not found');
      }

      const settings = await getSettings();

      if (!initEmailService({
        smtp_host: settings.email_host,
        smtp_port: settings.email_port,
        smtp_user: settings.email_user,
        smtp_pass: settings.email_password,
        smtp_secure: settings.email_secure
      })) {
        throw new Error('Email service not configured');
      }

      const invoiceService = require('../services/invoiceService');
      return await invoiceService.sendReminderEmail({
        to: email || creditSale.customer_email,
        creditSale,
        businessInfo: {
          businessName: settings.businessName || BRAND.productName,
          businessPhone: settings.businessPhone,
          businessEmail: settings.businessEmail
        }
      });
    });
};
