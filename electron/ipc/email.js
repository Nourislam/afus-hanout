// IPC handlers: email. Moved out of main.js unchanged; main.js passes what they use.
const { documentEmail } = require('../services/emailTemplates');
const { translate } = require('../i18n');

module.exports = function register(ctx) {
    const {
        getStoreSettings,
        ReceiptService,
        getOne,
        ipcMain,
        receiptService,
        runQuery,
        sendTestEmail,
        testEmailConnection,
    } = ctx;

    // Email Service
    ipcMain.handle('email:testConnection', async (_, settings) => {
      return testEmailConnection(settings);
    });

    ipcMain.handle('email:sendTest', async (_, { settings, toEmail }) => {
      return sendTestEmail(settings, toEmail);
    });

    // Send Purchase Order Email
    const nodemailer = require('nodemailer');
    ipcMain.handle('email:sendPurchaseOrder', async (_, { to, po }) => {
      // Get business settings including SMTP
      // Every setting, the shop's own details (store_config) on top
      const settings = getStoreSettings();

      console.log('Email settings loaded:', {
        email_host: settings.email_host,
        email_user: settings.email_user,
        email_password: settings.email_password ? '***SET***' : 'NOT SET',
        email_port: settings.email_port,
      });

      // Check SMTP settings
      if (!settings.email_host || !settings.email_user || !settings.email_password) {
        throw new Error(`Email not configured. Missing: ${!settings.email_host ? 'host ' : ''}${!settings.email_user ? 'user ' : ''}${!settings.email_password ? 'password' : ''}`);
      }

      // Fetch full PO with items if items are missing
      let fullPO = po;
      if (!po.items || po.items.length === 0) {
        fullPO = getOne(`
      SELECT po.*, s.name as supplier_name, s.email as supplier_email, s.phone as supplier_phone, s.address as supplier_address, s.contact_person as supplier_contact_person
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.id = ?
    `, [po.id]);

        if (fullPO) {
          fullPO.items = runQuery(`
        SELECT poi.*, p.name as product_name, p.sku
        FROM purchase_order_items poi
        LEFT JOIN products p ON poi.product_id = p.id
        WHERE poi.purchase_order_id = ?
      `, [po.id]);
        }
      }

      // Create transporter with settings
      const transporter = nodemailer.createTransport({
        host: settings.email_host,
        port: settings.email_port || 587,
        secure: settings.email_secure || false,
        auth: {
          user: settings.email_user,
          pass: settings.email_password,
        },
      });

      // In the shop's language, amounts in dinars
      const { subject: poSubject, html } = documentEmail('purchase_order', {
        number: fullPO.po_number || fullPO.id?.slice(0, 8), date: fullPO.created_at, to: fullPO.supplier_contact_person || fullPO.supplier_name,
        lines: (fullPO.items || []).map(i => ({ name: i.product_name, qty: i.quantity, price: i.unit_cost, total: i.total_cost })),
        total: fullPO.total, note: fullPO.notes,
      }, settings);

      // Generate PDF to attach
      let pdfPath = null;
      try {
        console.log('Generating PDF for email attachment...');
        pdfPath = await receiptService.generatePurchaseOrderPdf(fullPO, { type: 'purchase_order', ...settings });
        console.log('Email PDF generated at:', pdfPath);
      } catch (pdfError) {
        console.error('PDF generation failed, sending email without attachment:', pdfError);
      }

      // Build attachments array
      const attachments = [];
      if (pdfPath) {
        const fs = require('fs');
        if (fs.existsSync(pdfPath)) {
          console.log('Attaching PDF to email:', pdfPath);
          attachments.push({
            filename: `PO_${fullPO.po_number || 'draft'}.pdf`,
            path: pdfPath,
          });
        } else {
          console.error('Generated PDF file not found at path:', pdfPath);
        }
      } else {
        console.warn('pdfPath is null or undefined');
      }

      // Send email
      await transporter.sendMail({
        from: settings.email_user,
        to,
        subject: poSubject,
        html,
        attachments,
      });

      return { success: true };
    });


    // ==========================================  
    // EMAIL: SEND RECEIPT
    // ==========================================
    ipcMain.handle('email:sendReceipt', async (_, sale, toEmail) => {
      // Every setting, the shop's own details (store_config) on top
      const settings = getStoreSettings();

      if (!settings.email_host || !settings.email_user || !settings.email_password) {
        throw new Error('Email not configured. Please configure SMTP settings in Settings > Email.');
      }

      // Determine if this is a credit payment
      const isCreditPayment = sale.type === 'credit_payment' || (sale.invoice_number && !sale.receipt_number);

      // Normalize data for email template
      const receiptNumber = sale.receipt_number || sale.invoice_number || 'N/A';
      const totalAmount = isCreditPayment ? (sale.amount || 0) : (sale.total || 0);

      // Ensure sale has items (only for standard sales)
      if (!isCreditPayment && (!sale.items || sale.items.length === 0)) {
        const items = runQuery('SELECT * FROM sale_items WHERE sale_id = ?', [sale.id]);
        sale.items = items;
      }

      const transporter = nodemailer.createTransport({
        host: settings.email_host,
        port: settings.email_port || 587,
        secure: settings.email_secure || false,
        auth: { user: settings.email_user, pass: settings.email_password },
      });

      const { subject: receiptSubject, html } = documentEmail(isCreditPayment ? 'credit_payment' : 'receipt', {
        number: receiptNumber, date: sale.created_at, to: sale.customer_name,
        lines: isCreditPayment
          ? [{ name: translate(settings.defaultLanguage, 'email.creditLine', { number: sale.invoice_number || '' }), qty: 1, price: totalAmount, total: totalAmount }]
          : (sale.items || []).map(i => ({ name: i.product_name, qty: i.quantity, price: i.unit_price, total: i.total })),
        subtotal: sale.subtotal, discount: sale.discount, tax: sale.tax, total: totalAmount,
      }, settings);

      // Generate PDF to attach
      let pdfPath = null;
      try {
        // Pass the correct type to generatePdf so it uses the right template logic
        const pdfType = isCreditPayment ? 'credit_payment' : 'receipt';
        pdfPath = await receiptService.generatePdf(sale, { ...settings, type: pdfType });
      } catch (pdfError) {
        console.error('Receipt PDF generation failed, sending email without attachment:', pdfError);
      }

      // Build attachments array
      const attachments = [];
      if (pdfPath) {
        const fs = require('fs');
        if (fs.existsSync(pdfPath)) {
          attachments.push({
            filename: `Receipt_${receiptNumber}.pdf`,
            path: pdfPath,
          });
        }
      }

      await transporter.sendMail({
        from: settings.email_user,
        to: toEmail,
        subject: receiptSubject,
        html,
        attachments,
      });

      return { success: true };
    });

    // A quotation to the customer, its PDF attached (the Quote window's Send button)
    const emailService = require('../services/emailService');
    ipcMain.handle('email:sendQuotation', async (_, { to, quote: asked } = {}) => {
      if (!to || !asked) return { success: false, message: 'Missing e-mail address or quotation' };
      const settings = getStoreSettings();
      const ready = emailService.initEmailService({
        smtp_host: settings.email_host, smtp_port: settings.email_port,
        smtp_user: settings.email_user, smtp_pass: settings.email_password, smtp_secure: settings.email_secure,
      });
      if (!ready) return { success: false, message: 'Email not configured. Please configure SMTP settings in Settings > Email.' };
      // Amounts as numbers (the e-mail and the PDF format them)
      const num = (v) => Number(v) || 0;
      const quote = {
        ...asked, subtotal: num(asked.subtotal), tax_amount: num(asked.tax_amount), discount_amount: num(asked.discount_amount), total: num(asked.total),
        items: (asked.items || []).map(i => ({ ...i, unit_price: num(i.unit_price), total: num(i.total) })),
      };
      let pdfPath = null;
      try { pdfPath = await receiptService.generateQuotationPdf(quote, settings); } catch (error) { console.error('Quotation PDF failed, sending without it:', error); }
      await emailService.sendQuotationEmail({ to, quote, businessInfo: settings, pdfPath });
      return { success: true };
    });

    ipcMain.handle('email:sendGiftCard', async (_, { giftCard, email }) => {
      try {
        const receiptService = new ReceiptService();

        // Get all settings (Same approach as creditInvoice:sendEmail for consistency)
        // Every setting, the shop's own details (store_config) on top
        const settings = getStoreSettings();

        // Merge structured settings if they exist (compatibility with new SettingsPage structure)
        // Structure from SettingsPage: { host, port, user, pass, secure }
        if (settings.email_settings) {
          settings.email_host = settings.email_settings.host || settings.email_host;
          settings.email_port = settings.email_settings.port || settings.email_port;
          settings.email_user = settings.email_settings.user || settings.email_user;
          settings.email_password = settings.email_settings.pass || settings.email_password;
          settings.email_secure = settings.email_settings.secure !== undefined ? settings.email_settings.secure : settings.email_secure;
        }

        // Structure from SettingsPage: { businessName, etc }
        if (settings.store_config) {
          Object.assign(settings, settings.store_config);
        }

        // Generate PDF to temp path
        const pdfPath = await receiptService.generateGiftCardPdf(giftCard, settings);

        // Init service
        // Using require here to ensure access if global scope is ambiguous
        const emailService = require('../services/emailService');

        const emailConfig = {
          smtp_host: settings.email_host,
          smtp_port: settings.email_port,
          smtp_user: settings.email_user,
          smtp_pass: settings.email_password,
          smtp_secure: settings.email_secure
        };

        if (emailService.initEmailService(emailConfig)) {
          const { subject, html } = documentEmail('gift_card', { number: giftCard.code, amount: giftCard.current_balance }, settings);
          await emailService.sendEmail({
            to: email,
            subject,
            html,
            attachments: [{
              filename: `GiftCard_${giftCard.code}.pdf`,
              path: pdfPath
            }]
          });
          return true;
        } else {
          throw new Error("Failed to initialize email service");
        }

      } catch (error) {
        console.error('Failed to send Gift Card Email:', error);
        throw error;
      }
    });
};
