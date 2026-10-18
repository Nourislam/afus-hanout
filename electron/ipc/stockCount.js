// IPC handlers: stockCount. Moved out of main.js unchanged; main.js passes what they use.
module.exports = function register(ctx) {
    const {
        SyncManager,
        dbApi,
        ipcMain,
        logSystemAction,
        runTransaction,
    } = ctx;

    // Stock count (services/stockCountService.js): the stock changes only on confirm
    const stockCounts = require('../services/stockCountService');
    ipcMain.handle('stockCount:current', () => {
      const count = stockCounts.currentCount(dbApi);
      return count ? stockCounts.summary(dbApi, count.id) : null;
    });
    ipcMain.handle('stockCount:start', (_, { categoryId = null, employeeId = null } = {}) => runTransaction(() => {
      const count = stockCounts.startCount(dbApi, { categoryId, employeeId });
      return stockCounts.summary(dbApi, count.id);
    }));
    ipcMain.handle('stockCount:scan', (_, { countId, code, quantity = 1 }) => runTransaction(() => stockCounts.scan(dbApi, countId, code, quantity)));
    ipcMain.handle('stockCount:setCounted', (_, { countId, lineId, counted }) => runTransaction(() => stockCounts.setCounted(dbApi, countId, lineId, counted)));
    ipcMain.handle('stockCount:removeLine', (_, { countId, lineId }) => runTransaction(() => stockCounts.removeLine(dbApi, countId, lineId)));
    ipcMain.handle('stockCount:summary', (_, countId) => stockCounts.summary(dbApi, countId));
    ipcMain.handle('stockCount:cancel', (_, countId) => runTransaction(() => stockCounts.cancelCount(dbApi, countId)));
    ipcMain.handle('stockCount:confirm', (_, { countId, reason, employeeId = null }) => {
      const report = runTransaction(() => stockCounts.confirmCount(dbApi, countId, { reason, employeeId }));
      logSystemAction('stock_count_confirmed', `Stock count confirmed: ${reason}`, { countId, shortage: report.shortage_pieces, surplus: report.surplus_pieces }, employeeId);
      SyncManager.triggerSync();
      return report;
    });
    ipcMain.handle('stockCount:list', (_, limit) => stockCounts.listCounts(dbApi, limit));
};
