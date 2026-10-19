// IPC handlers: people. Moved out of main.js unchanged; main.js passes what they use.
const chargesService = require('../services/chargesService');

module.exports = function register(ctx) {
    const {
        SyncManager,
        catalog,
        dbApi,
        getOne,
        ipcGuard,
        ipcMain,
        isFirstSetup,
        logSystemAction,
        runInsert,
        runQuery,
        runTransaction,
        session,
        uuid,
    } = ctx;

    const pinService = require('../services/pinService');
    const { PERMISSIONS } = require('../shared/permissions.mjs');

    // Customers
    ipcMain.handle('db:customers:getAll', () => {
      return runQuery('SELECT * FROM customers WHERE is_active = 1 ORDER BY name');
    });

    // Customers and suppliers at a glance (read only, computed from the operations)
    const partners = require('../services/partnersService');
    ipcMain.handle('db:customers:overview', () => partners.customersOverview(dbApi));
    ipcMain.handle('db:customers:history', (_, customerId) => partners.customerHistory(dbApi, customerId));
    ipcMain.handle('db:suppliers:overview', () => partners.suppliersOverview(dbApi));

    ipcMain.handle('db:customers:getById', (_, id) => {
      return getOne('SELECT * FROM customers WHERE id = ?', [id]);
    });

    ipcMain.handle('db:customers:search', (_, query) => {
      const searchTerm = `%${query}%`;
      return runQuery('SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? ORDER BY name',
        [searchTerm, searchTerm, searchTerm]);
    });

    // Kridi (allowed or not, and the limit) is set only by a role with the
    // customers.credit permission; for the others it stays as it was
    function creditFields(customer, existing = null) {
      if (ipcGuard.allows(PERMISSIONS.CUSTOMERS_CREDIT, session.getEmployee()) || isFirstSetup()) {
        return [customer.credit_enabled ? 1 : 0, customer.credit_limit || 0, customer.is_wholesale ? 1 : 0];
      }
      return [existing?.credit_enabled ? 1 : 0, existing?.credit_limit || 0, existing?.is_wholesale ? 1 : 0];
    }

    const receiptLanguage = (customer) => (['ar', 'fr', 'en'].includes(customer.receipt_language) ? customer.receipt_language : null);

    ipcMain.handle('db:customers:create', (_, customer) => {
      // Wholesale customer (pays the wholesale prices): same rule as kridi
      const [creditEnabled, creditLimit, wholesale] = creditFields(customer);
      runInsert(`
    INSERT INTO customers (id, name, email, phone, address, loyalty_points, notes, credit_enabled, credit_limit, is_wholesale, receipt_language, is_synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `, [
        customer.id,
        customer.name,
        customer.email,
        customer.phone,
        customer.address,
        customer.loyalty_points || 0,
        customer.notes,
        creditEnabled,
        creditLimit,
        wholesale,
        receiptLanguage(customer)
      ]);
      SyncManager.triggerSync();
      return customer;
    });

    ipcMain.handle('db:customers:update', (_, customer) => {
      const [creditEnabled, creditLimit, wholesale] = creditFields(customer, getOne('SELECT credit_enabled, credit_limit, is_wholesale FROM customers WHERE id = ?', [customer.id]));
      runInsert(`
    UPDATE customers SET name = ?, email = ?, phone = ?, address = ?, notes = ?, credit_enabled = ?, credit_limit = ?, is_wholesale = ?, receipt_language = ?, updated_at = CURRENT_TIMESTAMP, is_synced = 0
    WHERE id = ?
  `, [
        // The loyalty points are not taken from the form: only sales, returns
        // and their conversion change them (a form opened earlier cannot undo them)
        customer.name,
        customer.email,
        customer.phone,
        customer.address,
        customer.notes,
        creditEnabled,
        creditLimit,
        wholesale,
        receiptLanguage(customer),
        customer.id
      ]);
      logSystemAction('update', `Updated Customer: ${customer.name}`, { id: customer.id });
      SyncManager.triggerSync();
      return customer;
    });

    ipcMain.handle('db:customers:delete', (_, id, { confirmOwed = false } = {}) => {
      // A customer who still owes money is put aside only once the shop has seen it
      const owed = getOne(`SELECT COALESCE(SUM(MAX(amount_due - COALESCE(amount_paid, 0), 0)), 0) AS owed
    FROM credit_sales WHERE customer_id = ?`, [id])?.owed || 0;
      if (owed > 0.004 && !confirmOwed) throw catalog.codedError('CUSTOMER_OWES', { amount: Math.round(owed * 100) / 100 });
      runInsert('UPDATE customers SET is_active = 0, is_synced = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
      SyncManager.triggerSync();
      return true;
    });

    // Employees
    ipcMain.handle('db:employees:getAll', () => {
      return runQuery('SELECT id, name, email, role, is_active, avatar_path, created_at FROM employees WHERE is_active = 1 ORDER BY name');
    });

    ipcMain.handle('db:employees:getById', (_, id) => {
      return getOne('SELECT id, name, email, role, is_active, avatar_path, created_at FROM employees WHERE id = ?', [id]);
    });

    ipcMain.handle('db:employees:verifyPin', (_, { id, pin }) => {
      // PINs are hashed (services/pinService.js); a right PIN opens the session
      const employee = pinService.checkEmployeePin(dbApi, id, pin);
      if (employee) {
        session.setEmployee(employee);
        logSystemAction('login', `Employee Login: ${employee.name}`, null, employee.id);
        return employee;
      }
      return null;
    });

    ipcMain.handle('db:employees:create', (_, employee) => {
      runInsert(`
    INSERT INTO employees (id, name, email, pin, role, is_active, avatar_path, is_synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `, [
        employee.id,
        employee.name,
        employee.email || null,
        pinService.hashPin(employee.pin),
        employee.role,
        employee.is_active ? 1 : 0,
        employee.avatar_path || null
      ]);
      SyncManager.triggerSync();
      return { ...employee, pin: undefined };
    });

    ipcMain.handle('db:employees:update', (_, employee) => {
      if (employee.pin) {
        runInsert(`
      UPDATE employees SET name = ?, email = ?, pin = ?, role = ?, is_active = ?, avatar_path = ?, updated_at = CURRENT_TIMESTAMP, is_synced = 0
      WHERE id = ?
    `, [
          employee.name,
          employee.email || null,
          pinService.hashPin(employee.pin),
          employee.role,
          employee.is_active ? 1 : 0,
          employee.avatar_path || null,
          employee.id
        ]);
      } else {
        runInsert(`
      UPDATE employees SET name = ?, email = ?, role = ?, is_active = ?, avatar_path = ?, updated_at = CURRENT_TIMESTAMP, is_synced = 0
      WHERE id = ?
    `, [
          employee.name,
          employee.email || null,
          employee.role,
          employee.is_active ? 1 : 0,
          employee.avatar_path || null,
          employee.id
        ]);
      }
      SyncManager.triggerSync();
      return { ...employee, pin: undefined };
    });

    ipcMain.handle('db:employees:delete', (_, id) => {
      runInsert('UPDATE employees SET is_active = 0, is_synced = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
      SyncManager.triggerSync();
      return true;
    });

    // ==========================================
    // SUPPLIERS & RETURNS
    // ==========================================
    ipcMain.handle('db:suppliers:getAll', () => {
      const suppliers = runQuery('SELECT * FROM suppliers ORDER BY name');
      console.log('DEBUG: suppliers:getAll returned', suppliers.length, 'suppliers');
      return suppliers;
    });

    ipcMain.handle('db:suppliers:getById', (_, id) => {
      return getOne('SELECT * FROM suppliers WHERE id = ?', [id]);
    });

    // Get Supplier History (POs, Payments, Returns)
    ipcMain.handle('db:suppliers:getHistory', (_, supplierId) => {
      const history = runQuery(`
    SELECT 
      'purchase_order' as type,
      id,
      po_number as reference,
      created_at as date,
      total as amount,
      status,
      payment_status
    FROM purchase_orders 
    WHERE supplier_id = ?
    
    UNION ALL
    
    SELECT 
      'payment' as type,
      id,
      payment_method as reference, -- e.g. "Bank Transfer"
      paid_at as date,
      amount,
      'completed' as status,
      NULL as payment_status
    FROM supplier_payments
    WHERE supplier_id = ?
    
    UNION ALL
    
    SELECT 
      'return' as type,
      id,
      return_number as reference,
      created_at as date,
      total_amount as amount,
      status,
      NULL as payment_status
    FROM purchase_returns
    WHERE supplier_id = ?
    
    ORDER BY date DESC
  `, [supplierId, supplierId, supplierId]);

      return history;
    });

    // Record Supplier Payment
    ipcMain.handle('db:supplierPayments:create', (_, data) => runTransaction(() => { // data: { purchase_order_id, supplier_id, amount, payment_method, reference, notes }
      const id = uuid();
      const { purchase_order_id, supplier_id, amount, payment_method, reference, notes } = data;

      try {
        // 1. Record Payment
        runInsert(`
      INSERT INTO supplier_payments (id, purchase_order_id, supplier_id, amount, payment_method, reference, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, purchase_order_id, supplier_id, amount, payment_method, reference, notes, session.getEmployee()?.id || 'system']);

        // 2. Update Purchase Order (if linked)
        if (purchase_order_id) {
          const po = getOne('SELECT total, amount_paid FROM purchase_orders WHERE id = ?', [purchase_order_id]);
          if (po) {
            const newPaid = (po.amount_paid || 0) + amount;
            let newStatus = 'partial';
            if (newPaid >= po.total) newStatus = 'paid';
            if (newPaid === 0) newStatus = 'unpaid';

            runInsert('UPDATE purchase_orders SET amount_paid = ?, payment_status = ? WHERE id = ?',
              [newPaid, newStatus, purchase_order_id]);
          }
        }

        // 3. Update Supplier Balance (Reduce debt)
        // Note: Assuming 'balance' tracks what we OWE the supplier. Payment reduces it.
        // If balance tracks what they owe us, valid logic would be reversed. 
        // Convention: Supplier Balance = Amount We Owe.
        const supplier = getOne('SELECT balance FROM suppliers WHERE id = ?', [supplier_id]);
        const currentBalance = supplier ? (supplier.balance || 0) : 0;
        const newBalance = currentBalance - amount;
        runInsert('UPDATE suppliers SET balance = ? WHERE id = ?', [newBalance, supplier_id]);

        return { success: true, id };
      } catch (error) {
        console.error('Failed to record supplier payment:', error);
        throw error;
      }
    }));

    // Create Purchase Return
    ipcMain.handle('db:purchaseReturns:create', (_, data) => {
      const id = uuid();
      const { supplier_id, purchase_order_id, items, notes } = data; // items: [{product_id, quantity, unit_cost, reason}]

      try {
        // Calculate total
        const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
        const returnNumber = 'RET-' + Date.now().toString().slice(-6);

        runTransaction(() => {
          // 1. Create Return Record
          runInsert(`
        INSERT INTO purchase_returns (id, return_number, purchase_order_id, supplier_id, total_amount, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [id, returnNumber, purchase_order_id, supplier_id, totalAmount, notes, 'completed']);

          // 2. Insert Items & Update Stock (returning to the supplier removes stock)
          items.forEach(item => {
            runInsert(`
          INSERT INTO purchase_return_items (id, return_id, product_id, variant_id, product_name, quantity, unit_cost, reason)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [uuid(), id, item.product_id, item.variant_id || null, item.product_name, item.quantity, item.unit_cost, item.reason]);

            if (getOne('SELECT id FROM products WHERE id = ?', [item.product_id])) {
              catalog.adjustStock(dbApi, {
                productId: item.product_id,
                variantId: item.variant_id || null,
                delta: -item.quantity,
                type: 'return_out',
                reason: `Return #${returnNumber}`,
              });
            }
          });
        });

        // 3. Update Supplier Balance (They owe us credit, or we owe them less)
        // Reduce what we owe them (Balance - Return Amount)
        const supplier = getOne('SELECT balance FROM suppliers WHERE id = ?', [supplier_id]);
        const currentBalance = supplier ? (supplier.balance || 0) : 0;
        const newBalance = currentBalance - totalAmount;
        runInsert('UPDATE suppliers SET balance = ? WHERE id = ?', [newBalance, supplier_id]);

        return { success: true, id, return_number: returnNumber };
      } catch (error) {
        console.error('Failed to create purchase return:', error);
        throw error;
      }
    });

    ipcMain.handle('db:suppliers:create', (_, supplier) => {
      const id = supplier.id || uuid();
      runInsert(`
    INSERT INTO suppliers (id, name, email, phone, address, contact_person, website, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, supplier.name, supplier.email || null, supplier.phone || null, supplier.address || null, supplier.contact_person || null, supplier.website || null, supplier.notes || null]);
      return { ...supplier, id };
    });

    ipcMain.handle('db:suppliers:update', (_, supplier) => {
      runInsert(`
    UPDATE suppliers SET 
      name = ?, email = ?, phone = ?, address = ?, contact_person = ?, website = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [supplier.name, supplier.email, supplier.phone, supplier.address, supplier.contact_person, supplier.website, supplier.notes, supplier.id]);
      return supplier;
    });

    // A supplier with purchases, payments, receivings or returns is kept: deleting it
    // would take that history with it (the database removes their payments and returns)
    ipcMain.handle('db:suppliers:delete', (_, id) => {
      const used = ['purchase_orders', 'supplier_payments', 'receivings', 'purchase_returns', 'supplier_invoices']
        .some(table => getOne(`SELECT 1 AS used FROM ${table} WHERE supplier_id = ? LIMIT 1`, [id]));
      if (used) throw catalog.codedError('SUPPLIER_HAS_HISTORY');
      runInsert('DELETE FROM suppliers WHERE id = ?', [id]);
      return true;
    });

    // ==========================================
    // PURCHASE ORDERS
    // ==========================================
    ipcMain.handle('db:purchaseOrders:getAll', () => {
      return runQuery(`
    SELECT po.*, s.name as supplier_name, s.email as supplier_email, s.phone as supplier_phone, s.address as supplier_address
    FROM purchase_orders po
    LEFT JOIN suppliers s ON po.supplier_id = s.id
    ORDER BY po.created_at DESC
  `);
    });

    ipcMain.handle('db:purchaseOrders:getById', (_, id) => {
      const po = getOne(`
    SELECT po.*, s.name as supplier_name, s.email as supplier_email, s.phone as supplier_phone, s.address as supplier_address
    FROM purchase_orders po
    LEFT JOIN suppliers s ON po.supplier_id = s.id
    WHERE po.id = ?
  `, [id]);

      if (po) {
        po.items = runQuery(`
      SELECT poi.*, p.name as product_name, p.sku
      FROM purchase_order_items poi
      LEFT JOIN products p ON poi.product_id = p.id
      WHERE poi.purchase_order_id = ?
    `, [id]);
      }

      return po;
    });

    ipcMain.handle('db:purchaseOrders:create', (_, po) => runTransaction(() => {
      // One transaction: the order and its lines are saved together, and an error
      // reaches the interface instead of a "created" message for nothing
      const id = po.id || uuid();
      runInsert(`
    INSERT INTO purchase_orders (
      id, po_number, supplier_id, expected_date, 
      subtotal, tax_rate, tax_amount, discount_type, discount_value, shipping_cost, 
      total, status, notes, amount_paid, payment_status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'unpaid')
  `, [
        id, po.po_number, po.supplier_id, po.expected_date,
        po.subtotal, po.tax_rate || 0, po.tax_amount, po.discount_type || 'fixed', po.discount_value || 0, po.shipping_cost || 0,
        po.total, po.status || 'draft', po.notes
      ]);

      // Insert PO items
      for (const item of po.items) {
        runInsert(`
      INSERT INTO purchase_order_items (id, purchase_order_id, product_id, variant_id, variant_label, product_name, quantity, unit_cost, tax_rate, tax_amount, discount_amount, total_cost)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
          item.id || uuid(), id, item.product_id, item.variant_id || null, item.variant_label || null, item.product_name, item.quantity, item.unit_cost,
          item.tax_rate || 0, item.tax_amount || 0, item.discount_amount || 0, item.total_cost
        ]);
      }

      return { ...po, id };
    }));

    ipcMain.handle('db:purchaseOrders:delete', (_, id) => runTransaction(() => {
      // Check validation rules
      const po = getOne('SELECT status, amount_paid FROM purchase_orders WHERE id = ?', [id]);

      if (!po) {
        throw new Error('Purchase Order not found');
      }

      if (po.status === 'received') {
        throw catalog.codedError('PO_RECEIVED_DELETE');
      }

      if (po.amount_paid > 0) {
        throw catalog.codedError('PO_PAID_DELETE');
      }

      try {
        // Delete items first
        runInsert('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [id]);
        // Delete PO
        runInsert('DELETE FROM purchase_orders WHERE id = ?', [id]);
        return true;
      } catch (error) {
        console.error('Failed to delete PO:', error);
        throw error;
      }
    }));

    // GOODS RECEIVING (GRN)
    ipcMain.handle('db:receivings:create', (_, data) => {
      const { poId, items, notes, extras = {} } = data;
      const receivingId = uuid();
      // Purchase charges (transport, customs, travel): added to the cost of what arrived
      const extra = (k) => Math.max(0, Number(extras[k]) || 0);
      const extrasTotal = extra('transport') + extra('customs') + extra('travel') + extra('other');
      const receiveNumber = 'GRN-' + Date.now().toString().slice(-6);

      try {
        runTransaction(() => {
          // 1. Create Receiving Record
          runInsert(`
        INSERT INTO receivings (id, receive_number, purchase_order_id, supplier_id, notes)
        SELECT ?, ?, id, supplier_id, ? FROM purchase_orders WHERE id = ?
      `, [receivingId, receiveNumber, notes, poId]);
          let extraPerPiece = new Map();
          if (extrasTotal > 0) {
            runInsert('UPDATE receivings SET extra_transport = ?, extra_customs = ?, extra_travel = ?, extra_other = ? WHERE id = ?',
              [extra('transport'), extra('customs'), extra('travel'), extra('other'), receivingId]);
            extraPerPiece = chargesService.landedCosts(items.filter(i => i.quantity_received > 0).map(i => ({
              key: i.po_item_id || i.product_id,
              quantity: i.quantity_received,
              unitCost: getOne('SELECT unit_cost FROM purchase_order_items WHERE id = ?', [i.po_item_id])?.unit_cost || 0,
            })), extrasTotal);
          }

          // 2. Process Items (stock goes to the ordered variant)
          for (const item of items) {
            if (!(item.quantity_received > 0)) continue;
            const poItem = item.po_item_id
              ? getOne('SELECT variant_id FROM purchase_order_items WHERE id = ?', [item.po_item_id])
              : null;
            const variantId = item.variant_id || (poItem && poItem.variant_id) || null;

            runInsert(`
          INSERT INTO receiving_items (id, receiving_id, product_id, variant_id, product_name, quantity_ordered, quantity_received)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [uuid(), receivingId, item.product_id, variantId, item.product_name, item.quantity_ordered, item.quantity_received]);

            // Update PO Item Received Qty
            runInsert(`
          UPDATE purchase_order_items 
          SET received_quantity = received_quantity + ?
          WHERE id = ?
        `, [item.quantity_received, item.po_item_id]);

            // With purchase charges: the piece's cost becomes the average of the stock and what arrived
            const perPiece = extraPerPiece.get(item.po_item_id || item.product_id) || 0;
            if (perPiece > 0) {
              const product = getOne('SELECT cost FROM products WHERE id = ?', [item.product_id]) || {};
              const variant = variantId ? getOne('SELECT cost, stock_quantity FROM product_variants WHERE id = ?', [variantId]) : null;
              const unitCost = getOne('SELECT unit_cost FROM purchase_order_items WHERE id = ?', [item.po_item_id])?.unit_cost || 0;
              const before = variant ? variant.stock_quantity : (getOne('SELECT stock_quantity FROM products WHERE id = ?', [item.product_id])?.stock_quantity || 0);
              const cost = chargesService.averageCost({
                stock: before, cost: variant && variant.cost !== null && variant.cost !== undefined ? variant.cost : product.cost,
                quantity: item.quantity_received, unitCost: unitCost + perPiece,
              });
              if (variant) runInsert('UPDATE product_variants SET cost = ? WHERE id = ?', [cost, variantId]);
              else runInsert('UPDATE products SET cost = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [cost, item.product_id]);
            }

            catalog.adjustStock(dbApi, {
              productId: item.product_id,
              variantId,
              delta: item.quantity_received,
              type: 'purchase',
              reason: `GRN: ${receiveNumber}`,
            });
          }
        });

        // 3. Check PO Status
        // Get all items for this PO to check if everything is received
        const poItems = runQuery('SELECT quantity, received_quantity FROM purchase_order_items WHERE purchase_order_id = ?', [poId]);
        const isFullyReceived = poItems.every(i => i.received_quantity >= i.quantity);
        const isPartial = poItems.some(i => i.received_quantity > 0);

        const newStatus = isFullyReceived ? 'received' : (isPartial ? 'partial' : 'sent');

        runInsert('UPDATE purchase_orders SET status = ? WHERE id = ?', [newStatus, poId]);

        return { id: receivingId, receive_number: receiveNumber };
      } catch (error) {
        console.error('Failed to create GRN:', error);
        throw error;
      }
    });

    // SUPPLIER INVOICES (Phase 3)
    ipcMain.handle('db:supplierInvoices:create', (_, data) => {
      const id = uuid();
      const { purchase_order_id, invoice_number, invoice_date, due_date, subtotal, tax_amount, total_amount, notes } = data;

      try {
        // 1. Perform 3-Way Match Validation Check
        // Get PO Total
        const po = getOne('SELECT total FROM purchase_orders WHERE id = ?', [purchase_order_id]);

        // Get GRN Value (Sum of received items * unit cost)
        // Note: This relies on unit_cost from PO items. Detailed GRN valuation might need actual cost at receipt if different.
        // For now assuming PO cost.
        const grnValue = getOne(`
      SELECT SUM(quantity_received * unit_cost) as total_received_value 
      FROM purchase_order_items 
      WHERE purchase_order_id = ?
    `, [purchase_order_id]);

        const poTotal = po ? po.total : 0;
        const receivedValue = grnValue ? grnValue.total_received_value || 0 : 0;

        // The invoice matches when it equals the order total, or the value of what
        // was actually received (partial deliveries). Small rounding allowed.
        const difference = Math.min(Math.abs(total_amount - poTotal), receivedValue > 0 ? Math.abs(total_amount - receivedValue) : Infinity);
        const match_status = difference < 0.05 ? 'matched' : 'mismatched';

        runInsert(`
      INSERT INTO supplier_invoices (
        id, purchase_order_id, invoice_number, invoice_date, due_date,
        subtotal, tax_amount, total_amount, match_status, payment_status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?)
    `, [id, purchase_order_id, invoice_number, invoice_date, due_date, subtotal, tax_amount, total_amount, match_status, notes]);

        return { id, match_status };
      } catch (error) {
        console.error('Failed to create Supplier Invoice:', error);
        throw error;
      }
    });

    ipcMain.handle('db:supplierInvoices:getByPoId', (_, poId) => {
      return runQuery('SELECT * FROM supplier_invoices WHERE purchase_order_id = ? ORDER BY invoice_date DESC', [poId]);
    });

    // ================================================
    // RETURNS
    // ================================================


    ipcMain.handle('db:purchaseOrders:receiveStock', (_, { poId, receivedItems }) => {
      // 1. Update PO status
      runInsert("UPDATE purchase_orders SET status = 'received', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [poId]);

      // 2. Update Product/Variant Stock and Log. Quantities actually received
      // (receivedItems: [{ id | product_id, variant_id?, quantity }]) win over the ordered ones.
      const items = runQuery('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?', [poId]);
      const receivedQty = (item) => {
        if (!Array.isArray(receivedItems) || receivedItems.length === 0) return item.quantity;
        const match = receivedItems.find(r => (r.id && r.id === item.id)
          || (r.product_id === item.product_id && (r.variant_id || null) === (item.variant_id || null)));
        return match ? Math.max(0, parseInt(match.quantity, 10) || 0) : 0;
      };

      runTransaction(() => {
        for (const item of items) {
          const quantity = receivedQty(item);
          if (quantity > 0 && item.product_id && getOne('SELECT id FROM products WHERE id = ?', [item.product_id])) {
            catalog.adjustStock(dbApi, {
              productId: item.product_id,
              variantId: item.variant_id || null,
              delta: quantity,
              type: 'receive_po',
              reason: `Received PO #${poId}`,
            });
          }
        }
      });
      return true;
    });

    // Customer Credit Info
    ipcMain.handle('db:customers:getCreditInfo', (_, customerId) => {
      const customer = getOne(`
    SELECT id, name, email, phone, credit_enabled, credit_limit, credit_balance
    FROM customers WHERE id = ?
  `, [customerId]);

      if (customer) {
        customer.available_credit = (customer.credit_limit || 0) - (customer.credit_balance || 0);
        customer.pending_sales = runQuery(`
      SELECT COUNT(*) as count, SUM(amount_due - amount_paid) as total_pending
      FROM credit_sales
      WHERE customer_id = ? AND status IN ('pending', 'partial')
    `, [customerId])[0] || { count: 0, total_pending: 0 };
      }

      return customer;
    });

    ipcMain.handle('db:customers:updateCreditSettings', (_, { customerId, credit_enabled, credit_limit }) => {
      runInsert(`
    UPDATE customers 
    SET credit_enabled = ?, credit_limit = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [credit_enabled ? 1 : 0, credit_limit || 0, customerId]);

      return true;
    });
};
