// IPC handlers: catalog. Moved out of main.js unchanged; main.js passes what they use.
module.exports = function register(ctx) {
    const {
        SyncManager,
        catalog,
        dbApi,
        dialog,
        excelService,
        getLabelSettings,
        getOne,
        getSettingValue,
        ipcMain,
        logSystemAction,
        runInsert,
        runQuery,
        runTransaction,
        session,
        shopT,
        uuid,
    } = ctx;

    // Categories
    ipcMain.handle('db:categories:getAll', () => {
      return runQuery(`
    SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.is_active = 1 AND p.category_id = c.id) AS product_count
    FROM categories c
    ORDER BY c.name
  `);
    });

    // ------------------------------------------------------------------
    // Brands (list used to pick a brand quickly when entering products)
    // ------------------------------------------------------------------
    ipcMain.handle('db:brands:getAll', () => {
      return runQuery(`
    SELECT b.*, (SELECT COUNT(*) FROM products p WHERE p.is_active = 1 AND LOWER(TRIM(p.brand)) = LOWER(b.name)) AS product_count
    FROM brands b
    ORDER BY b.is_active DESC, b.name COLLATE NOCASE
  `);
    });

    ipcMain.handle('db:brands:create', (_, { name }) => {
      const clean = String(name || '').trim();
      if (!clean) throw catalog.codedError('BRAND_NAME_REQUIRED');
      const existing = getOne('SELECT * FROM brands WHERE name = ? COLLATE NOCASE', [clean]);
      if (existing) {
        if (!existing.is_active) dbApi.run('UPDATE brands SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [existing.id]);
        return { ...existing, is_active: 1 };
      }
      const id = uuid();
      dbApi.run('INSERT INTO brands (id, name, sort_order) VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM brands))', [id, clean]);
      return getOne('SELECT * FROM brands WHERE id = ?', [id]);
    });

    // Renaming a brand also renames it on the products that use it
    ipcMain.handle('db:brands:update', (_, { id, name, is_active }) => {
      const brand = getOne('SELECT * FROM brands WHERE id = ?', [id]);
      if (!brand) throw catalog.codedError('BRAND_NOT_FOUND');
      const clean = String(name ?? brand.name).trim();
      if (!clean) throw catalog.codedError('BRAND_NAME_REQUIRED');
      const clash = getOne('SELECT id FROM brands WHERE name = ? COLLATE NOCASE AND id <> ?', [clean, id]);
      if (clash) throw catalog.codedError('BRAND_EXISTS');
      runTransaction(() => {
        dbApi.run('UPDATE brands SET name = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP, is_synced = 0 WHERE id = ?',
          [clean, is_active === undefined ? brand.is_active : (is_active ? 1 : 0), id]);
        if (clean !== brand.name) {
          dbApi.run('UPDATE products SET brand = ?, updated_at = CURRENT_TIMESTAMP, is_synced = 0 WHERE LOWER(TRIM(brand)) = LOWER(?)', [clean, brand.name]);
        }
      });
      return getOne('SELECT * FROM brands WHERE id = ?', [id]);
    });

    // Removing a brand from the list does not change existing products
    ipcMain.handle('db:brands:delete', (_, id) => {
      dbApi.run('DELETE FROM brands WHERE id = ?', [id]);
      return true;
    });

    ipcMain.handle('db:categories:create', (_, category) => {
      dbApi.run('INSERT INTO categories (id, name, color, icon, is_synced) VALUES (?, ?, ?, ?, 0)',
        [category.id || uuid(), category.name, category.color ?? null, category.icon ?? null]);
      SyncManager.triggerSync();
      return category;
    });

    ipcMain.handle('db:categories:update', (_, category) => {
      dbApi.run('UPDATE categories SET name = ?, color = ?, icon = COALESCE(?, icon), updated_at = CURRENT_TIMESTAMP, is_synced = 0 WHERE id = ?',
        [category.name, category.color ?? null, category.icon ?? null, category.id]);
      SyncManager.triggerSync();
      return category;
    });

    // Deleting a category keeps its products; they simply become uncategorised
    ipcMain.handle('db:categories:delete', (_, id) => {
      runTransaction(() => {
        dbApi.run('UPDATE products SET category_id = NULL, updated_at = CURRENT_TIMESTAMP, is_synced = 0 WHERE category_id = ?', [id]);
        dbApi.run('DELETE FROM categories WHERE id = ?', [id]);
      });
      return true;
    });

    // Products
    const PRODUCT_LIST_COLUMNS = `
    p.*, c.name as category_name, c.color as category_color,
    (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS variant_count,
    (SELECT MIN(COALESCE(v.price, p.price)) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS min_variant_price,
    (SELECT MAX(COALESCE(v.price, p.price)) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS max_variant_price,
    (SELECT GROUP_CONCAT(DISTINCT COALESCE(NULLIF(v.color_code, ''), v.color)) FROM product_variants v
       WHERE v.product_id = p.id AND v.is_active = 1 AND v.color IS NOT NULL AND v.color <> '') AS variant_colors,
    (SELECT GROUP_CONCAT(DISTINCT v.size) FROM product_variants v
       WHERE v.product_id = p.id AND v.is_active = 1 AND v.stock_quantity > 0 AND v.size IS NOT NULL AND v.size <> '') AS sizes_in_stock
`;

    // The sales screen's quick buttons: the 8 articles sold most these 7 days (ids only)
    ipcMain.handle('db:products:quickPicks', () => require('../services/storeRankings').bestSellers(dbApi, { limit: 8 }).map(r => r.id));

    ipcMain.handle('db:products:getAll', () => {
      return runQuery(`
    SELECT ${PRODUCT_LIST_COLUMNS}
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = 1
    ORDER BY p.name
  `);
    });

    ipcMain.handle('db:products:getById', (_, id) => {
      const product = getOne(`
    SELECT ${PRODUCT_LIST_COLUMNS}
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `, [id]);
      if (!product) return null;
      return { ...product, variants: catalog.getVariants(dbApi, id) };
    });

    // ------------------------------------------------------------------
    // Product variants, identifiers and code lookup (clothing catalog)
    // ------------------------------------------------------------------
    ipcMain.handle('catalog:getVariants', (_, { productId, includeInactive = false }) => {
      return catalog.getVariants(dbApi, productId, { includeInactive });
    });

    ipcMain.handle('catalog:saveProduct', (_, { product, variants, employeeId, isNew }) => {
      const result = catalog.saveProduct(dbApi, product, variants || [], { employeeId, isNew: !!isNew });
      logSystemAction(isNew ? 'create' : 'update', `${isNew ? 'Created' : 'Updated'} product: ${product.name}`,
        { id: product.id, variants: (variants || []).length }, employeeId || null);
      SyncManager.triggerSync();
      return result;
    });

    ipcMain.handle('catalog:generateSkus', (_, { product, variants, reserved }) => {
      return catalog.generateSkus(dbApi, product, variants, getSettingValue('sku_settings') || {}, new Set(reserved || []));
    });

    ipcMain.handle('catalog:generateBarcodes', (_, { count = 1, reserved = [] } = {}) => {
      return catalog.generateInternalBarcodes(dbApi, Math.min(Math.max(parseInt(count, 10) || 1, 1), 500), new Set(reserved));
    });

    ipcMain.handle('catalog:generateFreeCodes', (_, { type = 'ean13', count = 1, reserved = [] } = {}) => {
      const n = Math.min(Math.max(parseInt(count, 10) || 1, 1), 500);
      return dbApi.transaction(() => catalog.generateFreeCodes(dbApi, { type, count: n, reserved }));
    });

    // Which of these codes are already used by an article, a variant or a gift card
    ipcMain.handle('catalog:findUsedCodes', (_, codes = []) => {
      return (codes || []).filter(code => code && catalog.isCodeUsed(dbApi, code));
    });

    ipcMain.handle('catalog:checkIdentifier', (_, { code, excludeVariantId, excludeProductId }) => {
      const formatError = catalog.validateIdentifier(code, 'code');
      if (formatError) return { valid: false, message: formatError };
      const owner = catalog.findIdentifierOwner(dbApi, code, { excludeVariantId, excludeProductId });
      return owner
        ? { valid: false, message: catalog.coded('ID_TAKEN', { field: 'code', value: String(code).toUpperCase(), owner: catalog.describeOwner(owner) }), owner }
        : { valid: true };
    });

    ipcMain.handle('catalog:missingCodes', () => {
      const layout = getLabelSettings();
      return catalog.findMissingCodes(dbApi, { scope: layout.codeScope, codeType: layout.codeType });
    });

    ipcMain.handle('catalog:lookupCode', (_, code) => {
      // With one code per article, scanning sells a piece without asking colour/size
      return catalog.lookupCode(dbApi, code, { articleScope: getLabelSettings().codeScope === 'article' });
    });

    ipcMain.handle('catalog:searchVariants', (_, { query, limit }) => {
      return catalog.searchVariants(dbApi, query, limit);
    });

    ipcMain.handle('catalog:regenerateQr', (_, variantId) => {
      const variant = catalog.regenerateQrCode(dbApi, variantId);
      SyncManager.triggerSync();
      return variant;
    });

    ipcMain.handle('db:products:search', (_, query) => {
      const searchTerm = `%${query}%`;
      return runQuery(`
    SELECT p.*, c.name as category_name, c.color as category_color 
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id 
    WHERE p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?
    ORDER BY p.name
  `, [searchTerm, searchTerm, searchTerm]);
    });

    ipcMain.handle('db:products:getByBarcode', (_, barcode) => {
      return getOne(`
    SELECT p.*, c.name as category_name, c.color as category_color 
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id 
    WHERE p.barcode = ?
  `, [barcode]);
    });

    ipcMain.handle('db:products:getByCategory', (_, categoryId) => {
      return runQuery(`
    SELECT p.*, c.name as category_name, c.color as category_color 
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id 
    WHERE p.category_id = ?
    ORDER BY p.name
  `, [categoryId]);
    });

    // Simple (non-variant) product create/update, e.g. from the Excel import.
    // Both go through the catalog service so identifiers are checked for
    // duplicates and stock changes are written to inventory_logs.
    ipcMain.handle('db:products:create', (_, product) => {
      const { product: saved } = catalog.saveProduct(dbApi, product, product.variants || [], { isNew: true });
      logSystemAction('create', `Created product: ${product.name}`, { id: product.id, sku: product.sku });
      SyncManager.triggerSync();
      return saved;
    });

    ipcMain.handle('db:products:update', (_, product) => {
      // Callers that do not send variants must not wipe a product's variants
      let variants = product.variants;
      if (variants === undefined) {
        const current = getOne('SELECT has_variants FROM products WHERE id = ?', [product.id]);
        variants = current && current.has_variants ? catalog.getVariants(dbApi, product.id) : [];
      }
      const { product: saved } = catalog.saveProduct(dbApi, product, variants);
      logSystemAction('update', `Updated product: ${product.name}`, { id: product.id });
      SyncManager.triggerSync();
      return saved;
    });

    ipcMain.handle('db:products:delete', (_, id) => {
      runInsert('UPDATE products SET is_active = 0, is_synced = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
      logSystemAction('delete', `Deleted product (set inactive)`, { id });
      SyncManager.triggerSync();
      return true;
    });

    ipcMain.handle('db:products:updateStock', (_, { id, variantId, quantity, type, reason, employeeId }) => {
      const qty = Math.abs(parseInt(quantity, 10) || 0);
      const result = runTransaction(() => catalog.adjustStock(dbApi, {
        productId: id,
        variantId: variantId || null,
        delta: type === 'add' ? qty : -qty,
        type,
        reason,
        employeeId,
      }));

      SyncManager.triggerSync();
      return { id, variant_id: result.variantId, stock_quantity: result.after };
    });

    // Inventory Logs
    ipcMain.handle('db:inventory:getLogs', (_, productId) => {
      const select = `
    SELECT il.*, p.name as product_name, e.name as employee_name,
           v.color as variant_color, v.size as variant_size, v.sku as variant_sku
    FROM inventory_logs il
    LEFT JOIN products p ON il.product_id = p.id
    LEFT JOIN product_variants v ON il.variant_id = v.id
    LEFT JOIN employees e ON il.employee_id = e.id
  `;
      if (productId) {
        return runQuery(`${select} WHERE il.product_id = ? ORDER BY il.created_at DESC`, [productId]);
      }
      return runQuery(`${select} ORDER BY il.created_at DESC`);
    });

    // Low stock at the most specific level: one row per variant for clothing
    // products, one row per product for simple products.
    ipcMain.handle('db:inventory:getLowStock', () => {
      return catalog.getLowStock(dbApi);
    });

    // ================================================
    // PHASE 2: ADVANCED FEATURES
    // ================================================

    const { saveImage, saveImageFromPath, deleteImage, getImageBase64 } = require('../services/imageService');

    // Image Service
    ipcMain.handle('images:save', async (_, { base64Data, originalName }) => {
      return saveImage(base64Data, originalName);
    });

    ipcMain.handle('images:saveLogo', async (_, { base64Data, originalName }) => {
      return require('../services/imageService').saveLogo(base64Data, originalName);
    });

    ipcMain.handle('images:saveFromPath', async (_, sourcePath) => {
      return saveImageFromPath(sourcePath);
    });

    ipcMain.handle('images:delete', (_, fileName) => {
      return deleteImage(fileName);
    });

    ipcMain.handle('images:get', (_, fileName) => {
      return getImageBase64(fileName);
    });

    ipcMain.handle('images:getPath', (_, fileName) => {
      const { getImagePath } = require('../services/imageService');
      return getImagePath(fileName);
    });

    // File Dialog for selecting an image
    ipcMain.handle('dialog:selectImage', async () => {
      const result = await dialog.showOpenDialog(ctx.mainWindow, {
        title: shopT('dialog.selectSignature'),
        filters: [
          { name: shopT('dialog.imageFiles'), extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }
        ],
        properties: ['openFile']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true };
      }

      // Save the image to app data
      const imageService = require('../services/imageService');
      const savedImage = await imageService.saveImageFromPath(result.filePaths[0]);
      return savedImage;
    });



    // ===== BARCODE SERVICE =====
    const barcodeService = require('../services/barcodeService');

    ipcMain.handle('barcode:getTypes', () => {
      return barcodeService.getBarcodeTypes();
    });

    ipcMain.handle('barcode:getPresets', () => {
      return barcodeService.getIndustryPresets();
    });

    ipcMain.handle('barcode:generate', async (_, options) => {
      return await barcodeService.generateBarcode(options);
    });

    ipcMain.handle('barcode:generateLabel', async (_, options) => {
      return await barcodeService.generateLabel(options);
    });

    ipcMain.handle('barcode:generateBatch', async (_, { products, preset, quantity }) => {
      return await barcodeService.generateBatchLabels(products, preset, quantity);
    });

    ipcMain.handle('barcode:generateGS1', (_, components) => {
      return barcodeService.generateGS1Data(components);
    });

    ipcMain.handle('barcode:generateRandom', (_, type) => {
      return barcodeService.generateRandomBarcode(type);
    });

    ipcMain.handle('barcode:calculateCheckDigit', (_, { data, type }) => {
      return barcodeService.calculateCheckDigit(data, type);
    });

    ipcMain.handle('excel:parseBuffer', (_, buffer) => {
      // Convert array to Buffer if needed
      const buf = Buffer.from(buffer);
      return excelService.parseBuffer(buf);
    });

    ipcMain.handle('excel:detectMappings', (_, { headers, dataType }) => {
      return excelService.detectColumnMappings(headers, dataType);
    });

    ipcMain.handle('excel:validateAndTransform', (_, { rows, mappings, dataType }) => {
      return excelService.validateAndTransform(rows, mappings, dataType);
    });

    ipcMain.handle('excel:getFieldMappings', (_, dataType) => {
      return excelService.getFieldMappings(dataType);
    });

    ipcMain.handle('excel:generateTemplate', (_, dataType) => {
      const buffer = excelService.generateTemplate(dataType);
      return Array.from(buffer);
    });

    // Quick start: articles with their sizes/colours from a sheet (services/productImportService.js)
    const productImport = require('../services/productImportService');
    ipcMain.handle('excel:importProducts', (_, rows) => {
      const report = runTransaction(() => productImport.importProducts(dbApi, rows || [], {
        skuSettings: getSettingValue('sku_settings') || {}, employeeId: session.getEmployee()?.id || null,
      }));
      logSystemAction('products_imported', `Imported ${report.imported.length} articles, ${report.rejected.length} rejected`, null, session.getEmployee()?.id || null);
      SyncManager.triggerSync();
      return report;
    });

    ipcMain.handle('excel:export', (_, { data, dataType }) => {
      const buffer = excelService.exportData(data, dataType);
      return Array.from(buffer);
    });
};
