// IPC handlers: offers. Moved out of main.js unchanged; main.js passes what they use.
module.exports = function register(ctx) {
    const {
        SyncManager,
        dbApi,
        getOne,
        ipcMain,
        logSystemAction,
        loyaltyService,
        returnService,
        runInsert,
        runQuery,
        runTransaction,
        session,
        uuid,
    } = ctx;

    // Loyalty points turned into an avoir card (services/loyaltyService.js)
    ipcMain.handle('loyalty:redeem', (_, data = {}) => runTransaction(() => {
      const employee = session.getEmployee();
      const card = loyaltyService.redeem(dbApi, { customerId: data.customer_id, points: data.points, employeeId: employee?.id || null }, returnService.createStoreCredit);
      logSystemAction('loyalty_redeemed', `Loyalty: ${card.points} points -> ${card.amount}`, { customerId: data.customer_id, points: card.points, amount: card.amount, cardId: card.id }, employee?.id || null);
      return card;
    }));

    // Gift Cards
    ipcMain.handle('db:giftCards:getAll', () => {
      return runQuery(`
    SELECT gc.*, c.name as customer_name
    FROM gift_cards gc
    LEFT JOIN customers c ON gc.customer_id = c.id
    ORDER BY gc.created_at DESC
  `);
    });

    ipcMain.handle('db:giftCards:getById', (_, id) => {
      return getOne(`
    SELECT gc.*, c.name as customer_name
    FROM gift_cards gc
    LEFT JOIN customers c ON gc.customer_id = c.id
    WHERE gc.id = ?
  `, [id]);
    });

    ipcMain.handle('db:giftCards:getByCode', (_, code) => {
      return getOne(`
    SELECT gc.*, c.name as customer_name
    FROM gift_cards gc
    LEFT JOIN customers c ON gc.customer_id = c.id
    WHERE gc.code = ? AND gc.is_active = 1
  `, [code]);
    });

    ipcMain.handle('db:giftCards:create', (_, giftCard) => {
      runInsert(`
    INSERT INTO gift_cards (id, code, initial_balance, current_balance, customer_id, is_active, expires_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        giftCard.id,
        giftCard.code,
        giftCard.initial_balance,
        giftCard.current_balance || giftCard.initial_balance,
        giftCard.customer_id || null,
        giftCard.is_active ? 1 : 0,
        giftCard.expires_at || null,
        giftCard.created_by || null
      ]);
      return giftCard;
    });

    ipcMain.handle('db:giftCards:update', (_, giftCard) => {
      runInsert(`
    UPDATE gift_cards SET
      current_balance = ?, customer_id = ?, is_active = ?, expires_at = ?
    WHERE id = ?
  `, [
        giftCard.current_balance,
        giftCard.customer_id || null,
        giftCard.is_active ? 1 : 0,
        giftCard.expires_at || null,
        giftCard.id
      ]);
      return giftCard;
    });

    ipcMain.handle('db:giftCards:redeem', (_, { giftCardId, amount, saleId, employeeId }) => runTransaction(() => {
      const giftCard = getOne('SELECT * FROM gift_cards WHERE id = ?', [giftCardId]);
      if (!giftCard || !giftCard.is_active) {
        throw new Error('Gift card not found or inactive');
      }
      if (giftCard.current_balance < amount) {
        throw new Error('Insufficient balance');
      }

      const newBalance = giftCard.current_balance - amount;

      // Auto-deactivate if fully redeemed
      const isActive = newBalance > 0 ? 1 : 0;

      runInsert('UPDATE gift_cards SET current_balance = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP, is_synced = 0 WHERE id = ?', [newBalance, isActive, giftCardId]);

      // Log transaction
      runInsert(`
    INSERT INTO gift_card_transactions (id, gift_card_id, sale_id, amount, type, balance_before, balance_after, employee_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [uuid(), giftCardId, saleId || null, amount, 'redeem', giftCard.current_balance, newBalance, employeeId || null]);

      SyncManager.triggerSync();
      return { ...giftCard, current_balance: newBalance, is_active: !!isActive };
    }));

    ipcMain.handle('db:giftCards:reload', (_, { giftCardId, amount, employeeId }) => runTransaction(() => {
      const giftCard = getOne('SELECT * FROM gift_cards WHERE id = ?', [giftCardId]);
      if (!giftCard) {
        throw new Error('Gift card not found');
      }

      const newBalance = giftCard.current_balance + amount;
      runInsert('UPDATE gift_cards SET current_balance = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP, is_synced = 0 WHERE id = ?', [newBalance, giftCardId]);

      // Log transaction
      runInsert(`
    INSERT INTO gift_card_transactions (id, gift_card_id, amount, type, balance_before, balance_after, employee_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [uuid(), giftCardId, amount, 'reload', giftCard.current_balance, newBalance, employeeId || null]);

      SyncManager.triggerSync();
      return { ...giftCard, current_balance: newBalance, is_active: 1 };
    }));

    ipcMain.handle('db:giftCards:getTransactions', (_, giftCardId) => {
      return runQuery(`
    SELECT gct.*, gc.code as gift_card_code, e.name as employee_name, s.receipt_number
    FROM gift_card_transactions gct
    LEFT JOIN gift_cards gc ON gct.gift_card_id = gc.id
    LEFT JOIN employees e ON gct.employee_id = e.id
    LEFT JOIN sales s ON gct.sale_id = s.id
    WHERE gct.gift_card_id = ?
    ORDER BY gct.created_at DESC
  `, [giftCardId]);
    });

    // Generate gift card code
    ipcMain.handle('db:giftCards:generateCode', () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 16; i++) {
        if (i > 0 && i % 4 === 0) code += '-';
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    });

    // Bundles
    ipcMain.handle('db:bundles:getAll', () => {
      return runQuery('SELECT * FROM bundles ORDER BY name');
    });

    ipcMain.handle('db:bundles:getById', (_, id) => {
      const bundle = getOne('SELECT * FROM bundles WHERE id = ?', [id]);
      if (bundle) {
        bundle.items = runQuery(`
      SELECT bi.*, p.name as product_name, p.price as product_price, p.image_path
      FROM bundle_items bi
      JOIN products p ON bi.product_id = p.id
      WHERE bi.bundle_id = ?
    `, [id]);
      }
      return bundle;
    });

    ipcMain.handle('db:bundles:getActive', () => {
      const bundles = runQuery('SELECT * FROM bundles WHERE is_active = 1 ORDER BY name');
      for (const bundle of bundles) {
        bundle.items = runQuery(`
      SELECT bi.*, p.name as product_name, p.price as product_price, p.image_path
      FROM bundle_items bi
      JOIN products p ON bi.product_id = p.id
      WHERE bi.bundle_id = ?
    `, [bundle.id]);
      }
      return bundles;
    });

    ipcMain.handle('db:bundles:create', (_, { bundle, items }) => runTransaction(() => {
      // Calculate original price and savings
      let originalPrice = 0;
      for (const item of items) {
        const product = getOne('SELECT price FROM products WHERE id = ?', [item.product_id]);
        if (product) {
          originalPrice += product.price * (item.quantity || 1);
        }
      }
      const savings = originalPrice - bundle.bundle_price;

      runInsert(`
    INSERT INTO bundles (id, name, description, bundle_price, original_price, savings, is_active, image_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        bundle.id,
        bundle.name,
        bundle.description || null,
        bundle.bundle_price,
        originalPrice,
        savings,
        bundle.is_active ? 1 : 0,
        bundle.image_path || null
      ]);

      // Add bundle items
      for (const item of items) {
        runInsert(`
      INSERT INTO bundle_items (id, bundle_id, product_id, quantity)
      VALUES (?, ?, ?, ?)
    `, [uuid(), bundle.id, item.product_id, item.quantity || 1]);
      }

      // Bundle Assembly Logic: If pre-packed and has initial stock, deduct components
      if (bundle.deduct_component_stock === 0 && (bundle.stock_quantity || 0) > 0) {
        for (const item of items) {
          const qtyNeeded = (item.quantity || 1) * bundle.stock_quantity;

          runInsert('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?', [qtyNeeded, item.product_id]);

          // Log inventory movement
          runInsert(`
              INSERT INTO inventory_logs (id, product_id, type, quantity_change, quantity_before, quantity_after, reason, created_at)
              SELECT ?, ?, 'assembly', ?, stock_quantity + ?, stock_quantity, ?, CURRENT_TIMESTAMP
              FROM products WHERE id = ?
          `, [uuid(), item.product_id, -qtyNeeded, qtyNeeded, `Bundle Assembly: ${bundle.name} (+${bundle.stock_quantity})`, item.product_id]);
        }
      }

      return { ...bundle, original_price: originalPrice, savings, items };
    }));

    ipcMain.handle('db:bundles:update', (_, { bundle, items }) => runTransaction(() => {
      // Calculate original price and savings
      let originalPrice = 0;
      for (const item of items) {
        const product = getOne('SELECT price FROM products WHERE id = ?', [item.product_id]);
        if (product) {
          originalPrice += product.price * (item.quantity || 1);
        }
      }
      const savings = originalPrice - bundle.bundle_price;

      // Fetch old bundle to check for stock changes
      const oldBundle = getOne('SELECT stock_quantity, deduct_component_stock FROM bundles WHERE id = ?', [bundle.id]);

      runInsert(`
    UPDATE bundles SET
      name = ?, description = ?, bundle_price = ?, original_price = ?, savings = ?, is_active = ?, deduct_component_stock = ?, stock_quantity = ?, image_path = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
        bundle.name,
        bundle.description || null,
        bundle.bundle_price,
        originalPrice,
        savings,
        bundle.is_active ? 1 : 0,
        bundle.deduct_component_stock ? 1 : 0,
        bundle.stock_quantity || 0,
        bundle.image_path || null,
        bundle.id
      ]);

      // Replace bundle items
      runInsert('DELETE FROM bundle_items WHERE bundle_id = ?', [bundle.id]);
      for (const item of items) {
        runInsert(`
      INSERT INTO bundle_items (id, bundle_id, product_id, quantity)
      VALUES (?, ?, ?, ?)
    `, [uuid(), bundle.id, item.product_id, item.quantity || 1]);
      }

      // Bundle Assembly Logic (Update)
      if (bundle.deduct_component_stock === 0) { // Pre-packed
        const oldStock = oldBundle ? (oldBundle.stock_quantity || 0) : 0;
        const newStock = bundle.stock_quantity || 0;
        const stockDiff = newStock - oldStock;

        if (stockDiff > 0) {
          for (const item of items) {
            const qtyNeeded = (item.quantity || 1) * stockDiff;

            runInsert('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?', [qtyNeeded, item.product_id]);

            // Log inventory movement
            runInsert(`
                  INSERT INTO inventory_logs (id, product_id, type, quantity_change, quantity_before, quantity_after, reason, created_at)
                  SELECT ?, ?, 'assembly', ?, stock_quantity + ?, stock_quantity, ?, CURRENT_TIMESTAMP
                  FROM products WHERE id = ?
              `, [uuid(), item.product_id, -qtyNeeded, qtyNeeded, `Bundle Assembly: ${bundle.name} (+${stockDiff})`, item.product_id]);
          }
        }
      }

      return { ...bundle, original_price: originalPrice, savings, items };
    }));

    ipcMain.handle('db:bundles:delete', (_, id) => runTransaction(() => {
      const bundle = getOne('SELECT * FROM bundles WHERE id = ?', [id]);
      if (!bundle) return true;

      // Restore component stock if it's a pre-assembled bundle
      if (bundle.deduct_component_stock === 0 && (bundle.stock_quantity || 0) > 0) {
        const items = runQuery('SELECT * FROM bundle_items WHERE bundle_id = ?', [id]);

        for (const item of items) {
          const qtyToRestore = (item.quantity || 1) * bundle.stock_quantity;

          runInsert('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [qtyToRestore, item.product_id]);

          runInsert(`
        INSERT INTO inventory_logs (id, product_id, type, quantity_change, quantity_before, quantity_after, reason, created_at)
        SELECT ?, ?, 'disassembly', ?, stock_quantity - ?, stock_quantity, ?, CURRENT_TIMESTAMP
        FROM products WHERE id = ?
      `, [uuid(), item.product_id, qtyToRestore, qtyToRestore, `Bundle Deleted: ${bundle.name}`, item.product_id]);
        }
      }

      runInsert('DELETE FROM bundles WHERE id = ?', [id]);
      return true;
    }));

    ipcMain.handle('db:bundles:assemble', (_, { id, quantity }) => runTransaction(() => {
      const bundle = getOne('SELECT * FROM bundles WHERE id = ?', [id]);
      if (!bundle) throw new Error('Bundle not found');

      const items = runQuery('SELECT * FROM bundle_items WHERE bundle_id = ?', [id]);
      if (items.length === 0) throw new Error('Bundle has no items');

      // Check valid quantity
      if (quantity <= 0) throw new Error('Invalid quantity');

      // Verify component stock
      for (const item of items) {
        const product = getOne('SELECT stock_quantity, name FROM products WHERE id = ?', [item.product_id]);
        const required = (item.quantity || 1) * quantity;
        if (product.stock_quantity < required) {
          throw new Error(`Insufficient stock for ${product.name}. Need ${required}, have ${product.stock_quantity}`);
        }
      }

      // Deduct components and Log
      for (const item of items) {
        const required = (item.quantity || 1) * quantity;

        runInsert('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?', [required, item.product_id]);

        runInsert(`
      INSERT INTO inventory_logs (id, product_id, type, quantity_change, quantity_before, quantity_after, reason, created_at)
      SELECT ?, ?, 'assembly', ?, stock_quantity + ?, stock_quantity, ?, CURRENT_TIMESTAMP
      FROM products WHERE id = ?
    `, [uuid(), item.product_id, -required, required, `Bundle Assembly: ${bundle.name} (+${quantity})`, item.product_id]);
      }

      // Increase Bundle Stock
      runInsert('UPDATE bundles SET stock_quantity = COALESCE(stock_quantity, 0) + ? WHERE id = ?', [quantity, id]);

      return true;
    }));

    ipcMain.handle('db:bundles:disassemble', (_, { id, quantity }) => runTransaction(() => {
      const bundle = getOne('SELECT * FROM bundles WHERE id = ?', [id]);
      if (!bundle) throw new Error('Bundle not found');

      const currentStock = bundle.stock_quantity || 0;
      if (currentStock < quantity) {
        throw new Error(`Insufficient bundle stock to disassemble. Have: ${currentStock}, Need: ${quantity}`);
      }

      const items = runQuery('SELECT * FROM bundle_items WHERE bundle_id = ?', [id]);

      // Decrease Bundle Stock
      runInsert('UPDATE bundles SET stock_quantity = COALESCE(stock_quantity, 0) - ? WHERE id = ?', [quantity, id]);

      // Restore Components
      for (const item of items) {
        const toRestore = (item.quantity || 1) * quantity;

        runInsert('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [toRestore, item.product_id]);

        runInsert(`
      INSERT INTO inventory_logs (id, product_id, type, quantity_change, quantity_before, quantity_after, reason, created_at)
      SELECT ?, ?, 'disassembly', ?, stock_quantity - ?, stock_quantity, ?, CURRENT_TIMESTAMP
      FROM products WHERE id = ?
    `, [uuid(), item.product_id, toRestore, toRestore, `Bundle Disassembly: ${bundle.name} (-${quantity})`, item.product_id]);
      }

      return true;
    }));

    // Promotions
    ipcMain.handle('db:promotions:getAll', () => {
      return runQuery('SELECT * FROM promotions ORDER BY created_at DESC');
    });

    ipcMain.handle('db:promotions:getActive', () => {
      const now = new Date().toISOString();
      return runQuery(`
    SELECT * FROM promotions
    WHERE is_active = 1
      AND (start_date IS NULL OR start_date <= ?)
      AND (end_date IS NULL OR end_date >= ?)
      AND (max_uses IS NULL OR current_uses < max_uses)
    ORDER BY created_at DESC
  `, [now, now]);
    });

    ipcMain.handle('db:promotions:getById', (_, id) => {
      return getOne('SELECT * FROM promotions WHERE id = ?', [id]);
    });

    ipcMain.handle('db:promotions:getByCode', (_, code) => {
      const now = new Date().toISOString();
      return getOne(`
    SELECT * FROM promotions
    WHERE coupon_code = ?
      AND is_active = 1
      AND (start_date IS NULL OR start_date <= ?)
      AND (end_date IS NULL OR end_date >= ?)
      AND (max_uses IS NULL OR current_uses < max_uses)
  `, [code, now, now]);
    });

    ipcMain.handle('db:promotions:incrementUse', (_, id) => {
      runInsert('UPDATE promotions SET current_uses = current_uses + 1, updated_at = CURRENT_TIMESTAMP, is_synced = 0 WHERE id = ?', [id]);
      SyncManager.triggerSync();
      return true;
    });

    ipcMain.handle('db:promotions:create', (_, promo) => {
      runInsert(`
    INSERT INTO promotions (id, name, description, type, value, min_purchase, max_discount, max_uses, start_date, end_date, is_active, applies_to, applies_to_ids, coupon_code, auto_apply)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        promo.id,
        promo.name,
        promo.description || null,
        promo.type,
        promo.value || 0,
        promo.min_purchase || 0,
        promo.max_discount || null,
        promo.max_uses || null,
        promo.start_date || null,
        promo.end_date || null,
        promo.is_active ? 1 : 0,
        promo.applies_to || 'all',
        promo.applies_to_ids ? (typeof promo.applies_to_ids === 'string' ? promo.applies_to_ids : JSON.stringify(promo.applies_to_ids)) : null,
        promo.coupon_code || null,
        promo.auto_apply ? 1 : 0
      ]);
      return promo;
    });

    ipcMain.handle('db:promotions:update', (_, promo) => {
      runInsert(`
    UPDATE promotions SET
      name = ?, description = ?, type = ?, value = ?, min_purchase = ?, max_discount = ?,
      max_uses = ?, start_date = ?, end_date = ?, is_active = ?, applies_to = ?,
      applies_to_ids = ?, coupon_code = ?, auto_apply = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
        promo.name,
        promo.description || null,
        promo.type,
        promo.value || 0,
        promo.min_purchase || 0,
        promo.max_discount || null,
        promo.max_uses || null,
        promo.start_date || null,
        promo.end_date || null,
        promo.is_active ? 1 : 0,
        promo.applies_to || 'all',
        promo.applies_to_ids ? (typeof promo.applies_to_ids === 'string' ? promo.applies_to_ids : JSON.stringify(promo.applies_to_ids)) : null,
        promo.coupon_code || null,
        promo.auto_apply ? 1 : 0,
        promo.id
      ]);
      return promo;
    });

    ipcMain.handle('db:promotions:delete', (_, id) => {
      runInsert('DELETE FROM promotions WHERE id = ?', [id]);
      return true;
    });
};
