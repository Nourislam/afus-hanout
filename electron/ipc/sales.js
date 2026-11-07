// IPC handlers: sales. Moved out of main.js unchanged; main.js passes what they use.
const { stockUnits, weighedPrice, aboveCap, isWeighed, isService, serviceCost, BARIDI_PAY_MIN } = require('../shared/grocery.ts');
const { SHOP_DAY_SQL } = require('../shared/shopDay.ts');
const changeBalance = require('../services/changeBalanceService');

module.exports = function register(ctx) {
    const {
        SyncManager,
        catalog,
        createCreditSale,
        dbApi,
        getOne,
        getStoreSettings,
        guard,
        ipcMain,
        logSystemAction,
        loyaltyService,
        returnService,
        runInsert,
        runQuery,
        runTransaction,
        salesStatsService,
        session,
        shiftService,
        uuid,
    } = ctx;

    // Sales
    ipcMain.handle('db:sales:create', (_, sale) => {
      // Discount limit and totals checked here, with the logged-in employee
      // (services/guard.js): a cashier above the limit needs a manager's PIN
      const check = guard.checkSale(dbApi, session.getEmployee(), sale, sale.approval);
      if (check.approvedBy) {
        logSystemAction('discount_approved', `Discount ${check.discount.percent}% approved by ${check.approvedBy.name}`, { saleId: sale.id, amount: check.discount.amount, approvedBy: check.approvedBy.id }, session.getEmployee()?.id || null);
      }
      // Kridi: allowed for this customer and under their limit (or a manager agreed)
      const credit = guard.checkCredit(dbApi, session.getEmployee(), sale, sale.approval);
      if (credit?.approvedBy) {
        logSystemAction('credit_limit_approved', `Credit above the limit for ${credit.customer.name} approved by ${credit.approvedBy.name}`, { saleId: sale.id, owed: credit.owedAfter, limit: credit.customer.credit_limit, approvedBy: credit.approvedBy.id }, session.getEmployee()?.id || null);
      }
      let creditSale = null;
      // The whole sale (header, lines, stock movements, payments, gift card
      // redemptions) is written in one transaction: if anything fails - e.g. a
      // gift card without enough balance or a variant that no longer exists -
      // nothing is saved and stock is left untouched.
      // A "deposit" payment only comes from a reservation picked up
      if (!sale.reservation_id && (sale.payments || []).some(p => p.method === 'deposit')) throw catalog.codedError('RESERVATION_NOT_FOUND', {});
      // Baridi Pay (stored as 'transfer'): Algérie Poste refuses less than 100 DA
      if ((sale.payments || []).some(p => p.method === 'transfer' && Math.round((Number(p.amount) || 0) * 100) / 100 < BARIDI_PAY_MIN)) {
        throw catalog.codedError('BARIDI_MIN', { min: BARIDI_PAY_MIN });
      }
      runTransaction(() => {
        runInsert(`
      INSERT INTO sales (id, receipt_number, employee_id, customer_id, subtotal, tax_amount, discount_amount, total, status, notes, service_charge, tax_exempt, reservation_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [sale.id, sale.receipt_number, sale.employee_id ?? null, sale.customer_id ?? null,
        sale.subtotal ?? 0, sale.tax_amount ?? 0, sale.discount_amount ?? 0, sale.total ?? 0, sale.status || 'completed', sale.notes ?? null,
        sale.service_charge || 0, sale.tax_exempt ? 1 : 0, sale.reservation_id || null]);
        // Reservation picked up: its pieces come back first, the lines take them out
        if (sale.reservation_id) reservations.completeForSale(dbApi, sale);

        for (const item of sale.items) {
          const product = getOne('SELECT id, name, cost, has_variants, stock_quantity, unit, capped_price, service_margin, max_per_customer FROM products WHERE id = ?', [item.product_id]);
          // Not an article: a pack (its own column, product_id only ever points at an article)
          const bundle = product ? null : getOne('SELECT * FROM bundles WHERE id = ?', [item.product_id]);
          const variant = item.variant_id
            ? getOne('SELECT * FROM product_variants WHERE id = ?', [item.variant_id])
            : null;
          if (item.variant_id && !variant) {
            throw catalog.codedError('VARIANT_GONE', { product: item.product_name });
          }
          if (product && product.has_variants && !variant) {
            throw catalog.codedError('VARIANT_REQUIRED', { product: item.product_name });
          }
          // Same rule as the sales screen, checked again here: a ticket put on hold
          // or a cart opened before another sale cannot take more than the stock.
          // Lines are read after the previous ones were taken off, so two lines of
          // the same piece add up.
          // The units come from the article, not from the window: an article sold
          // by weight is one line of its grams; any other article ignores a weight
          if (product) {
            if (isWeighed(product)) {
              if (!(Number(item.weight_grams) > 0) || Number(item.quantity) !== 1) {
                throw catalog.codedError('WEIGHT_REQUIRED', { product: product.name });
              }
            } else if (item.weight_grams || item.sold_as === 'weight') {
              item.weight_grams = null;
              if (item.sold_as === 'weight') item.sold_as = null;
            }
          }
          // A service (flexy…) has no stock to check or move
          const service = product && !variant && isService(product);
          if (product && !service) {
            const available = variant ? (variant.stock_quantity || 0) : (product.stock_quantity || 0);
            // A weighed line takes its grams, any other line its quantity
            if (stockUnits(item) > available) {
              throw catalog.codedError('STOCK_INSUFFICIENT', {
                product: variant ? `${product.name} (${catalog.variantLabel(variant)})` : product.name,
                available,
              });
            }
          }

          // In short supply: no more than its limit per customer on this ticket (every line of it)
          if (product && Number(product.max_per_customer) > 0) {
            const taken = (sale.items || []).filter(i => i.product_id === product.id && !i.variant_id).reduce((n, i) => n + stockUnits(i), 0);
            if (taken > Number(product.max_per_customer)) throw catalog.codedError('SCARCITY_LIMIT', { product: product.name, n: product.max_per_customer });
          }

          // Never above the official price (capped articles: bread, milk, oil...)
          if (product && aboveCap(product, item.unit_price, item.weight_grams)) {
            throw catalog.codedError('PRICE_ABOVE_CAP', { product: product.name, cap: product.capped_price });
          }

          // Cost snapshot for profit reports: variant cost if set, else product cost
          // (a weighed line costs its weight at the cost per kg)
          let unitCost = 0;
          if (variant && variant.cost !== null && variant.cost !== undefined) unitCost = variant.cost;
          else if (service) unitCost = serviceCost(item.unit_price, product.service_margin);
          else if (product) unitCost = Number(item.weight_grams) > 0 ? weighedPrice(product.cost || 0, item.weight_grams) : (product.cost || 0);
          const soldAs = service ? 'service' : ['carton', 'weight'].includes(item.sold_as) ? item.sold_as : null;

          runInsert(`
        INSERT INTO sale_items (id, sale_id, product_id, bundle_id, variant_id, variant_label, sku, product_name, quantity, unit_price, discount, tax_amount, total, unit_cost, weight_grams, sold_as)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [item.id, sale.id, product ? item.product_id : null, bundle ? bundle.id : null, variant ? variant.id : null,
          variant ? catalog.variantLabel(variant) : (item.variant_label || null),
          variant ? variant.sku : (item.sku || null),
          item.product_name, item.quantity, item.unit_price, item.discount || 0, item.tax_amount || 0, item.total, unitCost,
          Number(item.weight_grams) > 0 ? Math.round(item.weight_grams) : null, soldAs]);

          if (service) continue;
          if (product) {
            // Regular product or one variant of it
            catalog.adjustStock(dbApi, {
              productId: item.product_id,
              variantId: variant ? variant.id : null,
              delta: -stockUnits(item),
              type: 'sale',
              reason: `Sale #${sale.receipt_number}`,
              employeeId: sale.employee_id || null,
            });
            continue;
          }

          // Not a product: a pack
          if (bundle && bundle.deduct_component_stock === 1) {
            const bundleItems = runQuery('SELECT * FROM bundle_items WHERE bundle_id = ?', [bundle.id]);
            // The pieces of the pack must be in stock, like any article sold
            for (const bItem of bundleItems) {
              const part = getOne('SELECT name, stock_quantity FROM products WHERE id = ?', [bItem.product_id]);
              if (part && bItem.quantity * item.quantity > (part.stock_quantity || 0)) {
                throw catalog.codedError('STOCK_INSUFFICIENT', { product: part.name, available: part.stock_quantity || 0 });
              }
            }
            for (const bItem of bundleItems) {
              catalog.adjustStock(dbApi, {
                productId: bItem.product_id,
                delta: -(bItem.quantity * item.quantity),
                type: 'sale_bundle',
                reason: `Bundle Sale: ${bundle.name} (Sale #${sale.receipt_number})`,
                employeeId: sale.employee_id || null,
              });
            }
          } else if (bundle) {
            // Deduct stock from bundle itself (Pre-packed)
            if (Number(item.quantity) > (bundle.stock_quantity || 0)) {
              throw catalog.codedError('STOCK_INSUFFICIENT', { product: bundle.name, available: bundle.stock_quantity || 0 });
            }
            runInsert('UPDATE bundles SET stock_quantity = stock_quantity - ? WHERE id = ?', [item.quantity, bundle.id]);
          }
        }

        // Change under 5 DA written on the customer's name (it stays in the drawer)
        if (Number(sale.change_kept) > 0) {
          const cash = (sale.payments || []).filter(p => p.method === 'cash');
          const tendered = cash.reduce((s, p) => { try { return s + (Number(JSON.parse(p.reference || '{}').tendered) || 0); } catch { return s; } }, 0);
          const cashPaid = cash.reduce((s, p) => s + (Number(p.amount) || 0), 0);
          changeBalance.keep(dbApi, { customerId: sale.customer_id, amount: sale.change_kept, saleId: sale.id, changeGiven: tendered - cashPaid });
        }

        // Paid with loyalty points turned into a card: earns no new points
        let paidWithPoints = 0;
        for (const payment of sale.payments || []) {
          runInsert(`
        INSERT INTO payments (id, sale_id, method, amount, reference)
        VALUES (?, ?, ?, ?, ?)
      `, [payment.id, sale.id, payment.method, payment.amount, payment.reference ?? null]);

          // Paid with the change kept for this customer: never more than he has
          if (payment.method === 'change_balance') changeBalance.use(dbApi, { customerId: sale.customer_id, amount: payment.amount, saleId: sale.id });

          // Handle Gift Card Redemption
          if (payment.method === 'gift_card') {
            const code = payment.reference; // Reference holds the gift card code
            const amount = payment.amount;

            const card = getOne('SELECT * FROM gift_cards WHERE code = ?', [code]);
            if (!card) throw catalog.codedError('GIFT_CARD_NOT_FOUND', { code });
            const newBalance = card.current_balance - amount;
            if (newBalance < 0) throw catalog.codedError('GIFT_CARD_BALANCE', { code });

            runInsert('UPDATE gift_cards SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newBalance, card.id]);
            if (card.kind === 'loyalty') paidWithPoints += Number(amount) || 0;

            // Update payment reference with balance info for receipt
            const refData = JSON.stringify({ code: code, remaining: newBalance });
            runInsert('UPDATE payments SET reference = ? WHERE id = ?', [refData, payment.id]);
            payment.reference = refData;

            // Log transaction
            runInsert(`
          INSERT INTO gift_card_transactions (id, gift_card_id, sale_id, amount, type, balance_before, balance_after, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [uuid(), card.id, sale.id, amount, 'redeem', card.current_balance, newBalance]);
          }
        }

        // Loyalty: 1 point per 100 DA, and the customer's total spent. Done here,
        // in the same transaction, so the customer record is never overwritten.
        // What earned points is kept on the sale, so a return takes back exactly those.
        if (sale.customer_id) {
          const base = Math.max(0, (Number(sale.total) || 0) - paidWithPoints);
          runInsert('UPDATE sales SET loyalty_base = ? WHERE id = ?', [base, sale.id]);
          runInsert(`
        UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) + ?, total_spent = COALESCE(total_spent, 0) + ?,
          updated_at = CURRENT_TIMESTAMP, is_synced = 0
        WHERE id = ?
      `, [loyaltyService.pointsOf(base), Number(sale.total) || 0, sale.customer_id]);
        }

        // Promotion used by this sale
        if (sale.promotion_id) {
          runInsert('UPDATE promotions SET current_uses = COALESCE(current_uses, 0) + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [sale.promotion_id]);
        }

        // The kridi of this sale, in the same transaction: a sale on kridi is
        // never saved without the customer's debt
        if (credit) {
          creditSale = createCreditSale({
            sale_id: sale.id,
            customer_id: credit.customer.id,
            amount_due: credit.amount,
            due_date: sale.credit?.due_date,
            notes: sale.credit?.notes || null,
          });
        }
      });

      logSystemAction('create', `New Sale #${sale.receipt_number}`, { id: sale.id, total: sale.total }, sale.employee_id);
      SyncManager.triggerSync();

      // Return the sale with the variant snapshots the receipt needs
      const items = runQuery('SELECT * FROM sale_items WHERE sale_id = ?', [sale.id]);
      const { approval: _approval, ...saved } = sale;
      return { ...saved, credit_sale: creditSale, items: sale.items.map(i => ({ ...i, ...(items.find(r => r.id === i.id) || {}) })) };
    });

    // Ticket number, customer (name or phone, digits only also) or seller, in all the history
    function salesSearch(params, add) {
      const text = String(params?.search || '').trim();
      if (!text) return;
      const term = `%${text}%`;
      const digits = text.replace(/\D/g, '');
      if (digits.length >= 3) {
        add(" AND (s.receipt_number LIKE ? OR c.name LIKE ? OR REPLACE(REPLACE(c.phone, ' ', ''), '-', '') LIKE ? OR e.name LIKE ?)", [term, term, `%${digits}%`, term]);
      } else {
        add(' AND (s.receipt_number LIKE ? OR c.name LIKE ? OR e.name LIKE ?)', [term, term, term]);
      }
    }

    // How many tickets match (the sales history loads them a page at a time)
    ipcMain.handle('db:sales:count', (_, params = {}) => {
      let query = 'SELECT COUNT(*) AS n FROM sales s LEFT JOIN employees e ON s.employee_id = e.id LEFT JOIN customers c ON s.customer_id = c.id WHERE 1=1';
      const values = [];
      salesSearch(params, (sql, v) => { query += sql; values.push(...v); });
      return getOne(query, values)?.n || 0;
    });

    ipcMain.handle('db:sales:getAll', (_, params = {}) => {
      let query = `
    SELECT s.*, e.name as employee_name, c.name as customer_name, c.phone as customer_phone
    FROM sales s
    LEFT JOIN employees e ON s.employee_id = e.id
    LEFT JOIN customers c ON s.customer_id = c.id
    WHERE 1=1
  `;
      const queryParams = [];

      if (params?.startDate && params?.endDate) {
        query += ' AND s.created_at BETWEEN ? AND ?';
        queryParams.push(params.startDate, params.endDate);
      }

      if (params?.employeeId) {
        query += ' AND s.employee_id = ?';
        queryParams.push(params.employeeId);
      }

      salesSearch(params, (sql, values) => { query += sql; queryParams.push(...values); });

      query += ' ORDER BY s.created_at DESC';

      // The whole history: no cap (a page size only when the caller asks for one)
      if (Number.isInteger(params?.limit) && params.limit > 0) {
        query += ' LIMIT ? OFFSET ?';
        queryParams.push(params.limit, Number.isInteger(params.offset) ? params.offset : 0);
      }

      return runQuery(query, queryParams);
    });

    ipcMain.handle('db:sales:getById', (_, id) => {
      const sale = getOne(`
    SELECT s.*, e.name as employee_name, c.name as customer_name
    FROM sales s
    LEFT JOIN employees e ON s.employee_id = e.id
    LEFT JOIN customers c ON s.customer_id = c.id
    WHERE s.id = ?
  `, [id]);

      if (sale) {
        // returned_quantity: pieces of the line already brought back (returns screen)
        sale.items = runQuery(`
      SELECT si.*, IFNULL((SELECT SUM(ri.quantity) FROM return_items ri WHERE ri.sale_item_id = si.id), 0) AS returned_quantity
      FROM sale_items si WHERE si.sale_id = ?
    `, [id]);
        sale.payments = runQuery('SELECT * FROM payments WHERE sale_id = ?', [id]);
      }

      return sale;
    });

    ipcMain.handle('db:sales:getToday', (_, params = {}) => {
      // "Today" in the shop's local time (timestamps are stored in UTC), the shop day from 04:00
      let query = `
    SELECT s.*, e.name as employee_name
    FROM sales s
    LEFT JOIN employees e ON s.employee_id = e.id
    WHERE date(s.created_at, 'localtime', ${SHOP_DAY_SQL}) = date('now', 'localtime', ${SHOP_DAY_SQL})
  `;
      const queryParams = [];

      if (params?.employeeId) {
        query += ' AND s.employee_id = ?';
        queryParams.push(params.employeeId);
      }

      query += ' ORDER BY s.created_at DESC';
      return runQuery(query, queryParams);
    });

    // Totals of a period: only the sales that count (electron/services/saleStatus.js)
    ipcMain.handle('db:sales:getStats', (_, range) => salesStatsService.salesStats(dbApi, range || {}));

    // Held Transactions
    ipcMain.handle('db:held:getAll', () => {
      return runQuery(`
    SELECT h.*, e.name as employee_name, c.name as customer_name
    FROM held_transactions h
    LEFT JOIN employees e ON h.employee_id = e.id
    LEFT JOIN customers c ON h.customer_id = c.id
    ORDER BY h.created_at DESC
  `);
    });

    ipcMain.handle('db:held:create', (_, held) => {
      runInsert(`
    INSERT INTO held_transactions (id, employee_id, customer_id, items_json, subtotal, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [held.id, held.employee_id, held.customer_id,
        // Lines as a list; text that is already JSON is kept as it is
        typeof held.items === 'string' ? held.items : JSON.stringify(held.items || []), held.subtotal, held.notes]);
      return held;
    });

    ipcMain.handle('db:held:delete', (_, id) => {
      runInsert('DELETE FROM held_transactions WHERE id = ?', [id]);
      return true;
    });

    // ==========================================
    // RETURNS
    // ==========================================
    ipcMain.handle('db:returns:getAll', (_, params = {}) => {
      let query = `
    SELECT r.*, e.name as employee_name, s.receipt_number
    FROM returns r
    LEFT JOIN employees e ON r.employee_id = e.id
    LEFT JOIN sales s ON r.sale_id = s.id
    WHERE 1=1
  `;
      const queryParams = [];

      if (params?.employeeId) {
        // If filtering by employee, we arguably want see returns PROCESSED by this employee 
        // OR returns of sales MADE by this employee.
        // Requirement says "History should each users transaction not all". 
        // Usually means "transactions I performed". 
        // For Returns, it's the person who processed the return.
        query += ' AND r.employee_id = ?';
        queryParams.push(params.employeeId);
      }

      query += ' ORDER BY r.created_at DESC';

      return runQuery(query, queryParams);
    });

    ipcMain.handle('db:returns:getItems', (_, returnId) => {
      return runQuery(`
    SELECT ri.*, p.name as product_name
    FROM return_items ri
    LEFT JOIN products p ON ri.product_id = p.id
    WHERE ri.return_id = ?
  `, [returnId]);
    });

    ipcMain.handle('db:returns:create', (_, returnData) => runTransaction(() => {
      // One transaction: the return, its lines, the stock and the sale status are
      // saved together, or not at all (rules in services/returnService.js)
      const approvedBy = guard.checkReturn(dbApi, session.getEmployee(), returnData.approval);
      const saved = returnService.createReturn(dbApi, { ...returnData, employee_id: returnData.employee_id || session.getEmployee().id });
      if (approvedBy) logSystemAction('return_approved', `Return ${returnData.return_number} approved by ${approvedBy.name}`, { returnId: returnData.id, approvedBy: approvedBy.id }, session.getEmployee().id);
      logSystemAction('return_processed', `Processed Return: ${returnData.return_number}`, { returnId: returnData.id, saleId: returnData.sale_id, amount: saved.total_refund, debtLowered: saved.credit_reduced || 0, refund: saved.store_credit ? 'store_credit' : 'cash' }, returnData.employee_id);
      const { approval: _approval, ...result } = saved;
      return result;
    }));

    // Exchanges (built on the returns, see services/exchangeService.js)
    const exchangeService = require('../services/exchangeService');
    function shopTax() {
      const settings = getStoreSettings();
      const rate = parseFloat(settings.taxRate) || 0;
      const enabled = typeof settings.taxEnabled === 'boolean' ? settings.taxEnabled : rate > 0;
      return { enabled, rate, inclusive: settings.taxType !== 'exclusive' };
    }
    const exchangeSummary = (p) => ({
      quantity: p.quantity, credit: p.credit, new_unit_price: p.newUnitPrice, new_total: p.newTotal,
      new_tax: p.newTax, difference: p.difference, new_label: p.newLabel,
    });
    ipcMain.handle('db:exchanges:preview', (_, input) => exchangeSummary(exchangeService.previewExchange(dbApi, input, shopTax())));
    ipcMain.handle('db:exchanges:create', (_, input) => {
      const approvedBy = guard.checkReturn(dbApi, session.getEmployee(), input.approval);
      const result = runTransaction(() => exchangeService.createExchange(dbApi, { ...input, employee_id: input.employee_id || session.getEmployee().id }, shopTax()));
      if (approvedBy) logSystemAction('exchange_approved', `Exchange ${result.receipt_number} approved by ${approvedBy.name}`, { exchangeId: result.id, approvedBy: approvedBy.id }, session.getEmployee().id);
      logSystemAction('exchange_processed', `Exchange ${result.original_receipt} -> ${result.receipt_number}`, result, input.employee_id || null);
      SyncManager.triggerSync();
      return result;
    });
    ipcMain.handle('db:exchanges:getBySale', (_, saleId) => exchangeService.exchangesOfSale(dbApi, saleId));

    ipcMain.handle('db:receipts:getBySale', (_, saleId) => {
      return runQuery('SELECT * FROM receipts WHERE sale_id = ? ORDER BY created_at DESC', [saleId]);
    });

    // INTELLIGENCE & REPORTS (Phase 4)
    // Change kept for a customer (رصيد الصرف)
    ipcMain.handle('change:balance', (_, customerId) => changeBalance.balance(dbApi, customerId));

    // Reservations with a deposit (services/reservationService.js)
    const reservations = require('../services/reservationService');
    ipcMain.handle('reservations:list', (_, params = {}) => reservations.listReservations(dbApi, params));
    ipcMain.handle('reservations:create', (_, data) => {
      const actor = session.getEmployee();
      const shift = shiftService.getCurrentShift(actor.id);
      // The deposit goes into a drawer: one must be open
      if (Number(data.deposit) > 0 && (data.deposit_method || 'cash') === 'cash' && !shift) throw catalog.codedError('SHIFT_REQUIRED', {});
      const saved = runTransaction(() => reservations.createReservation(dbApi, { ...data, employee_id: actor.id, shift_id: shift?.id || null }));
      logSystemAction('reservation_created', `Reservation ${saved.number}`, { id: saved.id, deposit: saved.deposit }, actor.id);
      return saved;
    });
    ipcMain.handle('reservations:cancel', (_, { id, refund = 0 } = {}) => {
      const actor = session.getEmployee();
      if (Number(refund) > 0 && !shiftService.getCurrentShift(actor.id)) throw catalog.codedError('SHIFT_REQUIRED', {});
      const saved = runTransaction(() => reservations.cancelReservation(dbApi, id, { refund, employeeId: actor.id }));
      logSystemAction('reservation_cancelled', `Reservation ${saved.number} cancelled`, { id, refund }, actor.id);
      return saved;
    });

    // Receipts tracking
    ipcMain.handle('db:receipts:create', (_, receipt) => {
      runInsert(`
    INSERT INTO receipts (id, sale_id, type, email_to, status)
    VALUES (?, ?, ?, ?, ?)
  `, [receipt.id, receipt.sale_id, receipt.type, receipt.email_to || null, receipt.status || 'pending']);
      return receipt;
    });

    ipcMain.handle('db:receipts:updateStatus', (_, { id, status, errorMessage }) => {
      if (status === 'sent') {
        runInsert('UPDATE receipts SET status = ?, sent_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
      } else {
        runInsert('UPDATE receipts SET status = ?, error_message = ? WHERE id = ?', [status, errorMessage || null, id]);
      }
      return true;
    });


    // ================================================
    // QUOTATIONS
    // ================================================
    ipcMain.handle('db:quotations:create', (_, quote) => runTransaction(() => {
      runInsert(`
    INSERT INTO quotations (id, quote_number, customer_id, subtotal, tax_amount, discount_amount, total, notes, status, valid_until, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        quote.id,
        quote.quote_number,
        quote.customer_id || null,
        quote.subtotal || 0,
        quote.tax_amount || 0,
        quote.discount_amount || 0,
        quote.total || 0,
        quote.notes || null,
        quote.status || 'active',
        quote.valid_until || null,
        quote.created_by || null
      ]);

      for (const item of quote.items) {
        runInsert(`
      INSERT INTO quotation_items (id, quotation_id, product_id, variant_id, variant_label, product_name, quantity, unit_price, discount, tax_amount, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
          uuid(),
          quote.id,
          item.product_id || null,
          item.variant_id || null,
          item.variant_label || null,
          item.product_name,
          item.quantity,
          item.unit_price || 0,
          item.discount || 0,
          item.tax_amount || 0,
          item.total || 0
        ]);
      }
      return quote;
    }));

    ipcMain.handle('db:quotations:getAll', () => {
      return runQuery(`
    SELECT q.*, c.name as customer_name, e.name as employee_name
    FROM quotations q
    LEFT JOIN customers c ON q.customer_id = c.id
    LEFT JOIN employees e ON q.created_by = e.id
    ORDER BY q.created_at DESC
    `);
    });

    ipcMain.handle('db:quotations:getById', (_, id) => {
      const quote = getOne(`
    SELECT q.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone, e.name as employee_name
    FROM quotations q
    LEFT JOIN customers c ON q.customer_id = c.id
    LEFT JOIN employees e ON q.created_by = e.id
    WHERE q.id = ?
    `, [id]);

      if (quote) {
        quote.items = runQuery('SELECT * FROM quotation_items WHERE quotation_id = ?', [id]);
      }
      return quote;
    });
};
