// IPC handlers: printing. Moved out of main.js unchanged; main.js passes what they use.
module.exports = function register(ctx) {
    const {
        BrowserWindow,
        ReceiptService,
        catalog,
        dbApi,
        dialog,
        fs,
        getLabelSettings,
        getOne,
        getPrinterSettings,
        getSettings,
        getShopSettingsForPrint,
        getStoreSettings,
        i18n,
        ipcMain,
        labelService,
        printDocument,
        printerError,
        receiptService,
        runQuery,
        shiftService,
        shopT,
    } = ctx;

    const { labelSalePrice } = require('../shared/promotions.mjs');

    // Closing report (Z) of a drawer: numbered in the order drawers were closed
    function zReport(shiftId) {
      const stats = shiftService.getShiftStats(shiftId);
      const closedBefore = getOne('SELECT COUNT(*) AS n FROM shifts WHERE end_time IS NOT NULL AND datetime(end_time) <= datetime(?)', [stats.end_time || new Date().toISOString()])?.n || 0;
      const employee = getOne('SELECT name FROM employees WHERE id = ?', [stats.employee_id]);
      return { ...stats, z_number: String(stats.end_time ? closedBefore : closedBefore + 1).padStart(4, '0'), employee_name: employee?.name || '' };
    }
    ipcMain.handle('shifts:zReportHtml', (_, shiftId) => receiptService.zReportHtml(zReport(shiftId), getShopSettingsForPrint()));
    ipcMain.handle('shifts:printZ', async (_, shiftId) => {
      const printer = await resolvePrinterOptions(getPrinterSettings().receipt, 'receipt');
      try {
        return await receiptService.printZ(zReport(shiftId), getShopSettingsForPrint(), printer);
      } catch (error) {
        throw printerError(error, printer.savedName || printer.printerName);
      }
    });

    // Receipt lines carry the variant's colour code and size so colours are
    // printed in the shop's language ("Noir" / "أسود"), whatever the label stored.
    function enrichSaleForPrint(sale) {
      if (!sale || !Array.isArray(sale.items)) return sale;
      const items = sale.items.map(item => {
        if (!item.variant_id || item.color_code) return item;
        const variant = getOne('SELECT color, color_code, size FROM product_variants WHERE id = ?', [item.variant_id]);
        return variant ? { ...item, color: item.color || variant.color, color_code: variant.color_code, size: item.size || variant.size } : item;
      });
      return { ...sale, items };
    }

    /**
     * The installed printer to send a job to (see printDocument.choosePrinter):
     * the saved printer prints directly; without one the system print dialog is
     * shown. A saved printer that was removed or renamed falls back to the dialog,
     * and the interface is told so it can say "choose it again in Settings".
     * kind: 'receipt' | 'label'
     */
    async function resolvePrinterOptions(options, kind) {
      const saved = String(options.printerName || '');
      let installed = null;
      if (saved) {
        try {
          installed = ctx.mainWindow ? await ctx.mainWindow.webContents.getPrintersAsync() : null;
        } catch {
          installed = null;
        }
      }
      const choice = printDocument.choosePrinter(installed, saved);
      if (choice.printerMissing && ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
        ctx.mainWindow.webContents.send('printers:missing', { kind, name: saved });
      }
      return { ...options, ...choice, savedName: saved };
    }

    // Ticket fields that Settings can show before they are saved (preview, test print)
    const RECEIPT_PREVIEW_KEYS = [
      'businessName', 'businessAddress', 'businessCity', 'businessWilaya', 'businessPhone',
      'businessRc', 'businessTaxId', 'businessNis', 'businessAi', 'receiptHeader', 'receiptFooter',
      'receiptShowBrand', 'receiptTicketQr', 'receiptPaperWidthMm', 'taxName', 'taxType', 'taxEnabled', 'taxRate',
    ];
    function shopSettingsWith(overrides) {
      const settings = getShopSettingsForPrint();
      if (!overrides || typeof overrides !== 'object') return settings;
      for (const key of RECEIPT_PREVIEW_KEYS) if (overrides[key] !== undefined) settings[key] = overrides[key];
      return settings;
    }

    // A customer's tickets in their own language (Customers › ticket language)
    function forCustomer(settings, sale) {
      if (!sale || !sale.customer_id) return settings;
      let lang = null;
      try { lang = getOne('SELECT receipt_language FROM customers WHERE id = ?', [sale.customer_id])?.receipt_language; } catch { lang = null; }
      return ['ar', 'fr', 'en'].includes(lang) ? { ...settings, defaultLanguage: lang } : settings;
    }

    ipcMain.handle('receipts:print', async (_, sale, overrides = {}) => {
      // overrides: printer settings being edited, and { shop } for the ticket text
      const { shop: shopOverrides, ...printerOverrides } = overrides || {};
      const printer = await resolvePrinterOptions({ ...getPrinterSettings().receipt, ...printerOverrides }, 'receipt');
      try {
        return await receiptService.print(enrichSaleForPrint(sale), forCustomer(shopSettingsWith(shopOverrides), sale), printer);
      } catch (error) {
        throw printerError(error, printer.savedName || printer.printerName);
      }
    });

    ipcMain.handle('receipts:getHtml', async (_, sale, overrides) => {
      return receiptService.getHtml(enrichSaleForPrint(sale), forCustomer(shopSettingsWith(overrides), sale));
    });

    ipcMain.handle('receipts:savePdf', async (_, sale) => {
      try {
        const settings = getShopSettingsForPrint();
        const dialogResult = await dialog.showSaveDialog({
          title: shopT('dialog.saveReceipt'),
          defaultPath: `Receipt_${sale.receipt_number || sale.id}.pdf`,
          filters: [{ name: shopT('dialog.pdfFiles'), extensions: ['pdf'] }]
        });

        if (dialogResult.canceled) return null;
        return await receiptService.generatePdf(enrichSaleForPrint(sale), forCustomer(settings, sale), dialogResult.filePath);
      } catch (error) {
        console.error('savePdf error:', error);
        throw error;
      }
    });

    // A4 invoice of a sale: data read again from the database (customer, lines,
    // payments, the TVA saved with the sale) and the shop's own legal numbers
    function saleForInvoice(saleId) {
      const sale = getOne(`
    SELECT s.*, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email, c.address AS customer_address
    FROM sales s LEFT JOIN customers c ON c.id = s.customer_id WHERE s.id = ?
  `, [saleId]);
      if (!sale) throw catalog.codedError('SALE_NOT_FOUND', {});
      sale.items = runQuery('SELECT * FROM sale_items WHERE sale_id = ?', [saleId]);
      sale.payments = runQuery('SELECT * FROM payments WHERE sale_id = ?', [saleId]);
      return enrichSaleForPrint(sale);
    }
    ipcMain.handle('invoices:print', async (_, saleId) => {
      const sale = saleForInvoice(saleId);
      const html = receiptService.generateHtml(sale, { ...forCustomer(getShopSettingsForPrint(), sale), type: 'invoice' });
      const win = printDocument.hiddenWindow(BrowserWindow, { javascript: false });
      try {
        await printDocument.loadHtml(win, html);
        // The system dialog: an A4 invoice usually goes to an office printer, not the ticket printer
        const result = await printDocument.printContents(win.webContents, { silent: false, printBackground: true, pageSize: 'A4' });
        return result.success;
      } catch (error) {
        throw printerError(error, '');
      } finally {
        if (!win.isDestroyed()) win.destroy();
      }
    });
    ipcMain.handle('invoices:savePdf', async (_, saleId) => {
      const sale = saleForInvoice(saleId);
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: shopT('dialog.saveReceipt'),
        defaultPath: `Facture_${sale.receipt_number}.pdf`,
        filters: [{ name: shopT('dialog.pdfFiles'), extensions: ['pdf'] }],
      });
      if (canceled || !filePath) return null;
      return receiptService.generatePdf(sale, { ...forCustomer(getShopSettingsForPrint(), sale), type: 'invoice' }, filePath);
    });
    ipcMain.handle('invoices:html', (_, saleId) => {
      const sale = saleForInvoice(saleId);
      return receiptService.generateHtml(sale, { ...forCustomer(getShopSettingsForPrint(), sale), type: 'invoice' });
    });

    // ==========================================
    // PRINTERS
    // ==========================================
    // Lists the printers installed in the operating system (Windows printers,
    // including thermal receipt/label printers that have a Windows driver).
    ipcMain.handle('printers:list', async () => {
      if (!ctx.mainWindow) return [];
      const printers = await ctx.mainWindow.webContents.getPrintersAsync();
      return printers.map(p => ({
        name: p.name,
        displayName: p.displayName || p.name,
        description: p.description || '',
        isDefault: !!p.isDefault,
        status: p.status,
      }));
    });

    ipcMain.handle('printers:getSettings', () => getPrinterSettings());

    // Code printed on an article label when the layout asks for a barcode instead of the QR
    function articleSymbology(layout, value) {
      const type = layout && layout.codeType;
      if (!type || type === 'qr') return null;
      if (type === 'ean13' && !/^\d{12,13}$/.test(String(value || ''))) return 'code128';
      return type;
    }

    // What an article label prints: the code and, when the layout asks for a
    // barcode, the symbology (EAN-13 needs digits, otherwise Code 128 is used)
    function articleCode(layout, { qrValue, barcode, sku }) {
      const type = articleSymbology(layout, barcode || sku);
      return type ? { symbology: type, qrValue: barcode || sku } : { qrValue };
    }

    // items: [{ variantId?, productId?, quantity, article?, previewBarcode? }],
    // free labels [{ code, symbology, title?, price?, quantity }] or { sample: true }
    function buildLabelData(items, layout = {}) {
      const settings = getStoreSettings();
      // Articles on sale: the label shows the old price struck out and the new one
      const promotions = layout.showSalePrice === false ? [] : runQuery('SELECT * FROM promotions WHERE is_active = 1');
      const withSale = (label, product) => {
        if (!product || !promotions.length) return label;
        const sale = labelSalePrice(promotions, { productId: product.id, categoryId: product.category_id, price: label.price });
        return sale === null ? label : { ...label, oldPrice: label.price, price: sale };
      };
      const articleScope = layout.codeScope === 'article';
      const money = { currency: settings.currency, currencySymbol: settings.currencySymbol };
      const labels = [];
      for (const item of items || []) {
        const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
        if (item.sample) {
          // Example shown in Settings while the layout is being chosen
          const lang = i18n.normalizeLanguage(getStoreSettings().defaultLanguage);
          const body = '200123456789';
          const barcode = body + catalog.gs1CheckDigit(body);
          labels.push({
            productName: i18n.translate(lang, 'labels.sampleName'),
            variantLabel: articleScope ? '' : i18n.variantLabel({ color: 'black', color_code: 'black', size: 'M' }, lang),
            sku: articleScope ? barcode : 'TSH-BLK-M-001',
            // Like a real piece: its barcode for EAN-13 (created when printing), its SKU otherwise
            ...articleCode(layout, { qrValue: articleScope ? barcode : 'TSH-BLK-M-001', barcode: articleScope || layout.codeType === 'ean13' ? barcode : '', sku: 'TSH-BLK-M-001' }),
            price: 2500,
            ...money,
            quantity,
          });
        } else if (item.code) {
          labels.push({
            productName: item.title || '',
            variantLabel: '',
            sku: String(item.code),
            qrValue: String(item.code),
            symbology: item.symbology || 'code128',
            price: item.price === '' || item.price === undefined || item.price === null ? null : Number(item.price),
            currency: settings.currency,
            quantity,
          });
        } else if (item.variantId && !articleScope) {
          const variant = getOne('SELECT * FROM product_variants WHERE id = ?', [item.variantId]);
          if (!variant) throw catalog.codedError('VARIANT_GONE', { product: '' });
          const product = getOne('SELECT * FROM products WHERE id = ?', [variant.product_id]);
          const barcode = item.previewBarcode || variant.barcode;
          labels.push(withSale({
            productName: product ? product.name : '',
            // Colour in the shop's language, like the ticket ("Noir" / "أسود")
            variantLabel: i18n.variantLabel(variant, i18n.normalizeLanguage(settings.defaultLanguage)),
            sku: variant.sku,
            ...articleCode(layout, { qrValue: variant.qr_code || variant.sku, barcode, sku: variant.sku }),
            price: catalog.effectivePrice(product || {}, variant),
            ...money,
            quantity,
          }, product));
        } else if (item.productId || item.variantId) {
          let productId = item.productId;
          if (!productId) productId = (getOne('SELECT product_id FROM product_variants WHERE id = ?', [item.variantId]) || {}).product_id;
          const product = getOne('SELECT * FROM products WHERE id = ?', [productId]);
          if (!product) throw new Error('Product not found');
          if (product.has_variants && !articleScope) throw catalog.codedError('VARIANT_REQUIRED', { product: product.name });
          const barcode = item.previewBarcode || product.barcode;
          const code = barcode || product.sku;
          if (!code) throw catalog.codedError('LABEL_NO_CODE', { product: product.name });
          // One code for the whole article: price from the article (lowest piece price when unset)
          let price = product.price;
          if (product.has_variants && !(Number(price) > 0)) {
            const min = getOne('SELECT MIN(price) AS p FROM product_variants WHERE product_id = ? AND is_active = 1 AND price IS NOT NULL', [product.id]);
            if (min && min.p !== null) price = min.p;
          }
          labels.push(withSale({
            productName: product.name,
            variantLabel: '',
            sku: product.sku || barcode,
            ...articleCode(layout, { qrValue: code, barcode, sku: product.sku || barcode }),
            price,
            ...money,
            quantity,
          }, product));
        }
      }
      return labels;
    }

    function buildLabelsDocument(items, layoutOverrides, { preview = false } = {}) {
      const layout = getLabelSettings(layoutOverrides);
      const shop = getShopSettingsForPrint();
      // Articles without a code get one (saved when printing, only shown in a preview)
      const article = (items || []).filter(i => !i.code && !i.sample);
      const ensure = (list) => catalog.ensureLabelCodes(dbApi, list, { scope: layout.codeScope, codeType: layout.codeType, dryRun: preview });
      const prepared = article.length ? (preview ? ensure(article) : dbApi.transaction(() => ensure(article))) : { items: [], created: 0 };
      const allItems = [...(items || []).filter(i => i.code || i.sample), ...prepared.items];
      const labels = buildLabelData(allItems, layout);
      const shopInfo = {
        name: shop.businessName,
        logo: shop.shopLogoDataUri,
        lang: i18n.normalizeLanguage(shop.defaultLanguage),
      };
      const html = labelService.buildLabelsHtml(labels, layout, { ...shopInfo, preview });
      return { html, layout, created: prepared.created, labels, shopInfo };
    }

    // Codes of a document that a scanner may not read once printed (too small
    // for the label size and the printer resolution)
    function labelIssues(doc, dpi) {
      return labelService.inspectLabels(doc.labels, doc.layout, doc.shopInfo, { dpi }).filter(entry => !entry.ok);
    }

    // For each code type, whether it can be read on this label (unsaved layout
    // from Settings), with the example label: options that cannot work are shown
    // as unavailable instead of printing codes nobody can scan
    function labelCodeOptions(layoutOverrides = {}, dpi) {
      const shop = getShopSettingsForPrint();
      const shopInfo = { name: shop.businessName, logo: shop.shopLogoDataUri, lang: i18n.normalizeLanguage(shop.defaultLanguage) };
      const check = (overrides) => {
        const layout = getLabelSettings({ ...layoutOverrides, ...overrides });
        const entries = labelService.inspectLabels(buildLabelData([{ sample: true, quantity: 1 }], layout), layout, shopInfo, { dpi });
        return entries;
      };
      const codeTypes = {};
      for (const type of ['qr', 'ean13', 'code128', 'code39', 'datamatrix']) {
        const code = check({ codeType: type, showBarcode: false }).find(e => e.kind === 'code');
        codeTypes[type] = code ? { ok: code.ok, moduleMm: code.moduleMm, minMm: code.minMm } : { ok: false };
      }
      const bars = check({ codeType: 'qr', showBarcode: true }).find(e => e.kind === 'bars');
      return { codeTypes, bars: bars ? { ok: bars.ok, moduleMm: bars.moduleMm, minMm: bars.minMm } : { ok: false, unavailable: true } };
    }

    ipcMain.handle('labels:getTemplates', () => ({
      templates: labelService.LABEL_TEMPLATES,
      defaults: labelService.DEFAULT_LABEL_SETTINGS,
    }));

    ipcMain.handle('labels:getSettings', () => getLabelSettings());

    const labelDpi = (printer) => (printer && printer.dpi !== undefined ? printer.dpi : getPrinterSettings().label.dpi);

    ipcMain.handle('labels:preview', (_, { items, layout, printer }) => {
      const doc = buildLabelsDocument(items, layout, { preview: true });
      return {
        html: doc.html,
        page: labelService.getPageSize(labelService.resolveLayout(doc.layout)),
        issues: labelIssues(doc, labelDpi(printer)),
      };
    });

    ipcMain.handle('labels:codeOptions', (_, { layout, printer } = {}) => labelCodeOptions(layout, labelDpi(printer)));

    ipcMain.handle('labels:print', async (_, { items, layout, printer }) => {
      // Printer first: no codes are created for a job that cannot print
      const options = await resolvePrinterOptions({ ...getPrinterSettings().label, ...(printer || {}) }, 'label');
      const doc = buildLabelsDocument(items, layout);
      const result = await labelService.printLabels(BrowserWindow, doc.html, doc.layout, options)
        .catch((error) => { throw printerError(error, options.savedName || options.printerName); });
      // What was really sent (checked on the printed labels, not on the preview)
      return {
        ...result,
        created: doc.created,
        printerMissing: options.printerMissing,
        printed: doc.labels.reduce((sum, l) => sum + Math.min(Math.max(parseInt(l.quantity, 10) || 1, 1), 1000), 0),
        issues: labelIssues(doc, options.dpi),
      };
    });

    ipcMain.handle('labels:savePdf', async (_, { items, layout }) => {
      const doc = buildLabelsDocument(items, layout);
      const result = await dialog.showSaveDialog({
        title: shopT('dialog.saveLabels'),
        defaultPath: 'labels.pdf',
        filters: [{ name: shopT('dialog.pdfFiles'), extensions: ['pdf'] }],
      });
      if (result.canceled) return null;
      const pdf = await labelService.labelsToPdf(BrowserWindow, doc.html, doc.layout);
      await fs.promises.writeFile(result.filePath, pdf);
      return result.filePath;
    });

    // Print an HTML document prepared by the renderer (used by the generic barcode
    // generator). Rendered in a sandboxed window with scripts disabled; the system
    // print dialog is always shown.
    ipcMain.handle('print:html', async (_, { html }) => {
      if (typeof html !== 'string' || html.length > 20 * 1024 * 1024) throw new Error('Invalid document');
      const win = printDocument.hiddenWindow(BrowserWindow, { javascript: false });
      try {
        await printDocument.loadHtml(win, html);
        const result = await printDocument.printContents(win.webContents, { silent: false, printBackground: true });
        return result.success;
      } finally {
        if (!win.isDestroyed()) win.destroy();
      }
    });

    // QR image (SVG) for an identifier, for on-screen previews
    ipcMain.handle('labels:qrSvg', (_, text) => labelService.qrSvg(text));

    // A sample purchase order with the shop's details and the signature being
    // set in Settings (not saved yet): what the supplier will receive
    ipcMain.handle('purchaseOrders:previewHtml', (_, overrides = {}) => {
      const storeSettings = {};
      runQuery('SELECT key, value FROM settings').forEach(row => {
        try { storeSettings[row.key] = JSON.parse(row.value); } catch { storeSettings[row.key] = row.value; }
      });
      Object.assign(storeSettings, storeSettings.store_config || {});
      for (const key of ['poSignatureName', 'poSignatureTitle', 'poSignatureImage']) {
        if (typeof overrides[key] === 'string') storeSettings[key] = overrides[key];
      }
      const sample = {
        id: 'preview', po_number: 'PO-0001', created_at: new Date().toISOString(), supplier_name: shopT('doc.supplierDefault'),
        items: [{ product_name: 'T-shirt', quantity: 12, unit_cost: 900, total_cost: 10800 }, { product_name: 'Jean', quantity: 6, unit_cost: 2500, total_cost: 15000 }],
        subtotal: 25800, total: 25800,
      };
      return receiptService.generateHtml(sample, { ...storeSettings, type: 'purchase_order' });
    });

    // ==========================================
    // PURCHASE ORDERS: SAVE PDF
    // ==========================================
    ipcMain.handle('purchaseOrders:savePdf', async (_, po) => {
      try {
        const settingsRows = runQuery('SELECT key, value FROM settings');
        const storeSettings = {};
        settingsRows.forEach(row => {
          try { storeSettings[row.key] = JSON.parse(row.value); } catch { storeSettings[row.key] = row.value; }
        });
        // The shop's own details (name, address, signature) are inside store_config
        Object.assign(storeSettings, storeSettings.store_config || {});
        storeSettings.type = 'purchase_order';

        // Fetch full PO with items if missing
        let fullPO = po;
        if (!po.items || po.items.length === 0) {
          fullPO = getOne(`
        SELECT po.*, s.name as supplier_name, s.email as supplier_email, s.phone as supplier_phone, s.address as supplier_address
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

        // Show save dialog
        const { shell } = require('electron');
        const result = await dialog.showSaveDialog(ctx.mainWindow, {
          title: shopT('dialog.savePurchaseOrder'),
          defaultPath: `PO_${fullPO.po_number || 'draft'}.pdf`,
          filters: [{ name: shopT('dialog.pdfFiles'), extensions: ['pdf'] }]
        });

        if (result.canceled || !result.filePath) {
          return null;
        }

        console.log('Generating PO PDF for:', fullPO?.po_number || fullPO?.id);
        const pdfPath = await receiptService.generatePurchaseOrderPdf(fullPO, storeSettings, result.filePath);
        console.log('PDF saved to:', pdfPath);

        // Open the PDF after saving
        shell.openPath(pdfPath);

        return pdfPath;
      } catch (error) {
        console.error('PO PDF generation error:', error);
        throw error;
      }
    });




    ipcMain.handle('quotations:print', async (_, quote) => {
      // Print using the same service, it will auto-detect type 'quotation' via the update above
      return await receiptService.print(quote);
    });

    ipcMain.handle('quotations:savePdf', async (_, quote) => {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: shopT('dialog.saveQuotation'),
        defaultPath: `Quotation_${quote.quote_number}.pdf`,
        filters: [{ name: shopT('dialog.pdfFiles'), extensions: ['pdf'] }]
      });

      if (canceled || !filePath) return null;

      const settings = await getSettings(); // Helper or duplicate logic
      await receiptService.generateQuotationPdf(quote, settings, filePath);
      return filePath;
    });

    ipcMain.handle('creditPayments:printReceipt', async (_, paymentId) => {
      const payment = getOne(`
    SELECT cp.*, cs.invoice_number, c.name as customer_name,
           (cs.amount_due - cs.amount_paid) as remaining_balance
    FROM credit_payments cp
    JOIN credit_sales cs ON cp.credit_sale_id = cs.id
    JOIN customers c ON cs.customer_id = c.id
    WHERE cp.id = ?
  `, [paymentId]);

      if (!payment) {
        throw new Error('Payment not found');
      }

      return await receiptService.print(payment, { ...getShopSettingsForPrint(), type: 'credit_payment' });
    });



    // ==========================================
    // Receipt & Print Handlers
    // ==========================================






    // Gift Card PDF & Emailhandlers
    ipcMain.handle('giftCards:savePdf', async (_, giftCard) => {
      try {
        const dialogResult = await dialog.showSaveDialog({
          title: shopT('dialog.saveGiftCard'),
          defaultPath: `GiftCard_${giftCard.code}.pdf`,
          filters: [{ name: shopT('dialog.pdfFiles'), extensions: ['pdf'] }]
        });

        if (dialogResult.canceled) return null;

        const receiptService = new ReceiptService();
        const settings = getOne("SELECT value FROM settings WHERE key = 'store_config'") || {};
        let storeSettings = {};
        try { storeSettings = JSON.parse(settings.value); } catch (e) { console.error(e); }

        const pdfPath = await receiptService.generateGiftCardPdf(giftCard, storeSettings, dialogResult.filePath);
        return pdfPath;
      } catch (error) {
        console.error('Failed to save Gift Card PDF:', error);
        throw error;
      }
    });
};
