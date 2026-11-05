// IPC handlers: reports. Moved out of main.js unchanged; main.js passes what they use.
const { SHOP_DAY_SQL } = require('../shared/shopDay.ts');
module.exports = function register(ctx) {
    const {
        backupFolder,
        backupService,
        dbApi,
        getOne,
        getPrinterSettings,
        ipcMain,
        isDemo,
        logSystemAction,
        readExternalStatus,
        runQuery,
        runTransaction,
        salesStatsService,
        session,
        shiftService,
    } = ctx;

    const dashboard = require('../services/dashboardService');
    const accountingService = require('../services/accountingService');
    const insights = require('../services/insightsService');
    const markdowns = require('../services/markdownService');

    // Reports
    ipcMain.handle('db:reports:salesByDate', (_, { startDate, endDate, employeeId }) => {
      let query = `
    SELECT 
      date(s.created_at, 'localtime', ${SHOP_DAY_SQL}) as date,
      COUNT(s.id) as transactions,
      SUM(s.total) as revenue,
      SUM(s.tax_amount) as tax,
      COALESCE(SUM(s.total - s.tax_amount - COALESCE(p.cost, 0)), 0) as profit
    FROM sales s
    LEFT JOIN (
        SELECT sale_id, SUM(COALESCE(unit_cost, 0) * quantity) as cost
        FROM sale_items
        GROUP BY sale_id
    ) p ON s.id = p.sale_id
    WHERE datetime(s.created_at) BETWEEN datetime(?) AND datetime(?)
  `;
      const queryParams = [startDate, endDate];

      if (employeeId) {
        query += ' AND s.employee_id = ?';
        queryParams.push(employeeId);
      }

      query += `
    GROUP BY date(s.created_at, 'localtime', ${SHOP_DAY_SQL})
    ORDER BY date ASC
  `;

      return runQuery(query, queryParams);
    });

    // Clothing dashboard: best sizes/colours, stock value, low-stock variants
    ipcMain.handle('db:reports:clothingDashboard', (_, range) => {
      return dashboard.getClothingDashboard(dbApi, range || {});
    });

    // Home screen: what needs doing now, read-only. The screen passes its own day
    // limits (same form as sales.created_at) and local calendar dates.
    async function printerStatus() {
      const { receipt, label } = getPrinterSettings();
      if (!receipt.printerName && !label.printerName) return { receipt: 'none', label: 'none' };
      let names = null;
      try {
        names = ctx.mainWindow ? (await ctx.mainWindow.webContents.getPrintersAsync()).map(p => p.name) : null;
      } catch { names = null; }
      const state = (name) => (!name ? 'none' : !names ? 'unknown' : names.includes(name) ? 'ok' : 'missing');
      return { receipt: state(receipt.printerName), label: state(label.printerName) };
    }

    ipcMain.handle('dashboard:home', async (_, { today, tomorrow, since30, todayRange }) => {
      const outOfStock = dashboard.outOfStockSelling(dbApi, since30);
      const backups = backupService.listBackups(backupFolder());
      return {
        outOfStock: { count: outOfStock.length, items: outOfStock.slice(0, 3) },
        lowCount: dashboard.runningLow(dbApi).length,
        missingCost: dashboard.missingCost(dbApi),
        soldWithoutCost: todayRange ? dashboard.soldWithoutCost(dbApi, todayRange) : 0,
        overdueCredit: dashboard.overdueCredit(dbApi, today),
        offersEnding: dashboard.offersEnding(dbApi, today, tomorrow),
        openShifts: shiftService.getOpenShifts(),
        lastBackupAt: backups.length ? backups[0].createdAt : null,
        externalBackup: isDemo() ? null : readExternalStatus(),
        printers: await printerStatus(),
        firstSteps: dashboard.firstSteps(dbApi),
        // Colours / sizes that will be sold out within a week at the pace of the last 14 days
        runOut: (() => { const rows = insights.runOutSoon(dbApi); return { count: rows.length, items: rows.slice(0, 3) }; })(),
      };
    });
    ipcMain.handle('dashboard:firstSteps', () => dashboard.firstSteps(dbApi));

    // Decision figures (services/insightsService.js), read-only
    ipcMain.handle('insights:runOut', (_, args = {}) => insights.runOutSoon(dbApi, args));
    ipcMain.handle('insights:sellThrough', (_, args = {}) => insights.sellThrough(dbApi, args));
    ipcMain.handle('insights:matrix', (_, { productId, since = null } = {}) => insights.productMatrix(dbApi, productId, { since }));
    ipcMain.handle('insights:deadStock', (_, args = {}) => insights.deadStock(dbApi, args));
    ipcMain.handle('insights:stockWorth', (_, args = {}) => insights.stockWorth(dbApi, args));
    ipcMain.handle('insights:season', (_, args = {}) => insights.seasonReport(dbApi, args));
    // The shop's rhythm: busy hours and days, the coming occasions and what to buy for them
    const rhythm = require('../services/shopRhythm');
    ipcMain.handle('insights:rhythm', (_, args = {}) => rhythm.rhythm(dbApi, { weeks: Math.min(52, Math.max(2, parseInt(args?.weeks, 10) || 12)) }));
    ipcMain.handle('insights:calendar', () => rhythm.calendar(dbApi));
    ipcMain.handle('insights:events', () => rhythm.listEvents(dbApi));
    ipcMain.handle('insights:eventAdd', (_, args = {}) => {
      try { return { success: true, event: rhythm.addEvent(dbApi, args || {}, require('uuid').v4()) }; } catch (error) { return { success: false, error: error.message }; }
    });
    ipcMain.handle('insights:eventDelete', (_, id) => rhythm.deleteEvent(dbApi, id));
    // Markdown manager: suggestions and results are read-only; a decision is the owner's
    ipcMain.handle('insights:markdowns', () => ({ suggestions: markdowns.suggestions(dbApi), results: markdowns.results(dbApi), steps: markdowns.STEPS }));
    ipcMain.handle('insights:markdownDecide', (_, args = {}) => {
      const actor = session.getEmployee();
      const row = runTransaction(() => markdowns.decide(dbApi, { ...args, employeeId: actor?.id || null }));
      logSystemAction(row.status === 'approved' ? 'markdown_approved' : 'markdown_refused',
        `${row.percent}% on ${row.product_id}`, null, actor?.id || null);
      return row;
    });
    ipcMain.handle('dashboard:selling', (_, { range, since30 }) => ({
      best: dashboard.bestSellers(dbApi, range),
      slow: dashboard.slowMovers(dbApi, since30),
    }));
    ipcMain.handle('dashboard:series', (_, { range, bucket, offsetMinutes }) => dashboard.salesSeries(dbApi, range, bucket, offsetMinutes));
    ipcMain.handle('dashboard:stock', (_, { since30 }) => ({
      // Complete lists: everything to reorder or to put on sale
      outOfStock: dashboard.outOfStockSelling(dbApi, since30),
      low: dashboard.runningLow(dbApi),
      missingSizes: dashboard.missingSizes(dbApi, since30),
      slow: dashboard.slowMovers(dbApi, since30, -1),
      value: dashboard.stockValue(dbApi),
    }));
    ipcMain.handle('dashboard:cash', (_, { range, closuresSince }) => {
      const openShifts = shiftService.getOpenShifts().map(shift => {
        let stats = null;
        try { stats = shiftService.getShiftStats(shift.id); } catch { stats = null; }
        return { ...shift, stats };
      });
      const closures = shiftService.getShiftHistory(closuresSince, range.endDate)
        .filter(s => s.end_time)
        .slice(0, 5)
        .map(s => ({ id: s.id, employee_name: s.employee_name, start_time: s.start_time, end_time: s.end_time, closing_cash: s.closing_cash, expected_cash: s.stats?.expected_cash ?? null, cash_difference: s.stats?.cash_difference ?? null }));
      return {
        openShifts,
        credit: dashboard.creditMoves(dbApi, range),
        employees: shiftService.getEmployeeActivity(range.startDate, range.endDate).filter(e => e.sales_count > 0 || e.minutes_worked > 0 || e.open_shift_start),
        closures,
      };
    });

    ipcMain.handle('db:reports:topProducts', (_, { startDate, endDate, limit = -1, employeeId }) => {
      let query = `
    SELECT 
      si.product_id,
      si.product_name,
      SUM(si.quantity) as total_quantity,
      SUM(si.total) as total_revenue
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE datetime(s.created_at) BETWEEN datetime(?) AND datetime(?)
  `;
      const queryParams = [startDate, endDate];

      if (employeeId) {
        query += ' AND s.employee_id = ?';
        queryParams.push(employeeId);
      }

      query += `
    GROUP BY si.product_id
    ORDER BY total_quantity DESC
    LIMIT ?
  `;
      // -1: every article sold in the period
      queryParams.push(Number.isInteger(limit) && limit > 0 ? limit : -1);

      return runQuery(query, queryParams);
    });

    ipcMain.handle('db:reports:salesByCategory', (_, { startDate, endDate, employeeId }) => {
      let query = `
    SELECT 
      c.name as category_name,
      c.color as category_color,
      SUM(si.quantity) as total_quantity,
      SUM(si.total) as total_revenue
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    JOIN products p ON si.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE datetime(s.created_at) BETWEEN datetime(?) AND datetime(?)
  `;
      const queryParams = [startDate, endDate];

      if (employeeId) {
        query += ' AND s.employee_id = ?';
        queryParams.push(employeeId);
      }

      query += `
    GROUP BY p.category_id
    ORDER BY total_revenue DESC
  `;

      return runQuery(query, queryParams);
    });

    ipcMain.handle('db:reports:paymentMethods', (_, range) => salesStatsService.paymentMethods(dbApi, range || {}));

    // Sales journal for the accountant (services/accountingService.js); its Excel file is exports:save (journal)
    ipcMain.handle('reports:salesJournal', (_, range) => accountingService.salesJournal(dbApi, range || {}));
    // What to order again, per colour / size (services/reorderService.js)
    ipcMain.handle('reorder:suggestions', (_, params = {}) => require('../services/reorderService').reorderSuggestions(dbApi, params));

    ipcMain.handle('db:reports:getLowStock', () => {
      return runQuery(`
    SELECT p.*, s.id as supplier_id, s.name as supplier_name 
    FROM products p 
    LEFT JOIN suppliers s ON p.supplier_id = s.id 
    WHERE p.stock_quantity <= p.min_stock_level AND p.is_active = 1
    ORDER BY s.name, p.name
  `);
    });

    ipcMain.handle('db:reports:getSupplierStats', () => {
      const summary = getOne(`
    SELECT 
      COUNT(*) as total_orders,
      SUM(total) as total_purchased,
      SUM(amount_paid) as total_paid
    FROM purchase_orders
    WHERE status != 'cancelled'
  `);

      const topSuppliers = runQuery(`
    SELECT s.name, SUM(po.total) as total_spend, COUNT(po.id) as order_count
    FROM purchase_orders po
    JOIN suppliers s ON po.supplier_id = s.id
    WHERE po.status != 'cancelled'
    GROUP BY s.id
    ORDER BY total_spend DESC
    LIMIT 5
  `);

      return { summary, topSuppliers };
    });
};
