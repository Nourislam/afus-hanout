// IPC handlers: email. Moved out of main.js unchanged; main.js passes what they use.
module.exports = function register(ctx) {
    const {
        getStoreSettings,
        BRAND,
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

      // Build modern email HTML
      const itemsHtml = (fullPO.items || []).map((item, index) => `
    <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      <td style="padding: 12px 16px; color: #1e293b; border-bottom: 1px solid #e2e8f0;">${item.product_name}</td>
      <td class="mobile-hide" style="padding: 12px 16px; color: #475569; text-align: center; border-bottom: 1px solid #e2e8f0;">${item.quantity}</td>
      <td class="mobile-hide" style="padding: 12px 16px; color: #475569; text-align: right; border-bottom: 1px solid #e2e8f0;">$${(item.unit_cost || 0).toFixed(2)}</td>
      <td style="padding: 12px 16px; color: #0f172a; text-align: right; font-weight: 600; border-bottom: 1px solid #e2e8f0;">$${(item.total_cost || 0).toFixed(2)}</td>
    </tr>
  `).join('');

      const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Purchase Order</title>
      <style>
        @media only screen and (max-width: 600px) {
          .container { width: 100% !important; margin: 20px 0 !important; border-radius: 0 !important; }
          .content { padding: 20px !important; }
          .header { padding: 20px !important; }
          .info-grid { flex-direction: column !important; gap: 20px; }
          .info-grid > div { text-align: left !important; padding: 0 !important; }
          .mobile-hide { display: none !important; }
          h1 { font-size: 20px !important; }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9;">
      <div class="container" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); margin-top: 40px; margin-bottom: 40px;">
        
        <!-- Header -->
        <div class="header" style="background-color: #10b981; padding: 32px 40px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Purchase Order</h1>
          <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">#${fullPO.po_number || fullPO.id?.slice(0, 8)}</p>
        </div>

        <!-- Content -->
        <div class="content" style="padding: 40px;">
          
          <!-- Context -->
          <div style="margin-bottom: 32px; text-align: center; color: #64748b; font-size: 16px; line-height: 1.5;">
            <p>Hello ${fullPO.supplier_contact_person || fullPO.supplier_name || 'Supplier'},</p>
            <p>Please find attached our purchase order. We would appreciate if you could process this order at your earliest convenience.</p>
          </div>

          <!-- Info Grid -->
          <div class="info-grid" style="display: flex; justify-content: space-between; margin-bottom: 32px; background-color: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="flex: 1; padding-right: 20px;">
              <h3 style="margin: 0 0 8px; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">From</h3>
              <p style="margin: 0; color: #0f172a; font-weight: 600;">${settings.businessName || 'Our Company'}</p>
              <p style="margin: 4px 0 0; color: #475569; font-size: 14px;">${settings.businessEmail || ''}</p>
            </div>
            <div style="flex: 1; text-align: right;">
              <h3 style="margin: 0 0 8px; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">To</h3>
              <p style="margin: 0; color: #0f172a; font-weight: 600;">${fullPO.supplier_name || 'Supplier'}</p>
              <p style="margin: 4px 0 0; color: #475569; font-size: 14px;">${fullPO.supplier_email || ''}</p>
            </div>
          </div>

          <!-- Table -->
          <table style="width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 32px;">
            <thead>
              <tr>
                <th style="background-color: #f8fafc; padding: 12px 16px; text-align: left; color: #64748b; font-weight: 600; font-size: 13px; border-bottom: 2px solid #e2e8f0; border-top-left-radius: 6px;">ITEM</th>
                <th class="mobile-hide" style="background-color: #f8fafc; padding: 12px 16px; text-align: center; color: #64748b; font-weight: 600; font-size: 13px; border-bottom: 2px solid #e2e8f0;">QTY</th>
                <th class="mobile-hide" style="background-color: #f8fafc; padding: 12px 16px; text-align: right; color: #64748b; font-weight: 600; font-size: 13px; border-bottom: 2px solid #e2e8f0;">UNIT COST</th>
                <th style="background-color: #f8fafc; padding: 12px 16px; text-align: right; color: #64748b; font-weight: 600; font-size: 13px; border-bottom: 2px solid #e2e8f0; border-top-right-radius: 6px;">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" class="mobile-hide" style="padding: 20px 16px; text-align: right; font-weight: 600; color: #64748b;">Total Amount:</td>
                <td colspan="1" style="padding: 20px 16px; text-align: right; font-weight: 700; color: #0f172a; font-size: 18px;">$${(fullPO.total || 0).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>

          ${fullPO.notes ? `
            <div style="background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 16px; margin-bottom: 32px;">
              <h4 style="margin: 0 0 8px; color: #92400e; font-size: 14px; font-weight: 600;">Notes:</h4>
              <p style="margin: 0; color: #b45309; font-size: 14px;">${fullPO.notes}</p>
            </div>
          ` : ''}

          <!-- Footer -->
          <div style="text-align: center; border-top: 1px solid #e2e8f0; padding-top: 32px;">
            <p style="margin: 0 0 8px; color: #64748b; font-weight: 500;">Please verify this order and confirm receipt.</p>
            <p style="margin: 0; color: #94a3b8; font-size: 14px;">${settings.businessName || ''} &bull; ${settings.businessPhone || ''}</p>
          </div>
          
        </div>
      </div>
      
      <div style="text-align: center; padding-bottom: 40px; color: #94a3b8; font-size: 12px;">
        <p>Sent from our point of sale system</p>
      </div>
    </body>
    </html>
  `;

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
        subject: `Purchase Order #${fullPO.po_number || fullPO.id?.slice(0, 8)} from ${settings.businessName || 'our store'}`,
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
      const dateStr = new Date(sale.created_at).toLocaleString();

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

      let itemsHtml = '';
      if (isCreditPayment) {
        itemsHtml = `
      <tr>
        <td>Payment for Invoice #${sale.invoice_number}</td>
        <td>1</td>
        <td>$${totalAmount.toFixed(2)}</td>
        <td>$${totalAmount.toFixed(2)}</td>
      </tr>
    `;
      } else {
        itemsHtml = (sale.items || []).map(item => `
      <tr><td>${item.product_name}</td><td>${item.quantity}</td><td>$${(item.unit_price || 0).toFixed(2)}</td><td>$${(item.total || 0).toFixed(2)}</td></tr>
    `).join('');
      }

      const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #6366f1;">${settings.businessName || 'Receipt'}</h1>
      <p><strong>Receipt #:</strong> ${receiptNumber}</p>
      <p><strong>Date:</strong> ${dateStr}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead><tr style="background: #f3f4f6;"><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <p style="font-size: 20px; font-weight: bold;">Total: $${totalAmount.toFixed(2)}</p>
      <p style="color: #6b7280; margin-top: 30px;">${settings.receiptFooter || 'Thank you for your business!'}</p>
    </div>
  `;

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
        subject: `Receipt #${receiptNumber} from ${settings.businessName || 'our store'}`,
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
          await emailService.sendEmail({
            to: email,
            subject: `Your Gift Card from ${settings.businessName || BRAND.productName}`,
            html: `
                <h2>Here is your Gift Card!</h2>
                <p>Enjoy your gift card of <strong>${receiptService.formatCurrency(giftCard.current_balance)}</strong>.</p>
                <p>Please find the printable card attached.</p>
                <br>
                <p>Thank you!</p>
            `,
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
