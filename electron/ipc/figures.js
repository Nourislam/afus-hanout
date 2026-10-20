// IPC handlers: the stock line by line (with its money) and "Check the figures" (the owner's).
module.exports = function register(ctx) {
    const { dbApi, ipcMain } = ctx;
    const stock = require('../services/stockService');
    const integrity = require('../services/integrityService');

    ipcMain.handle('stock:lines', () => {
      const lines = stock.stockLines(dbApi);
      return { lines, totals: stock.stockTotals(lines), byArticle: stock.byArticle(lines), byCategory: stock.byCategory(lines) };
    });
    ipcMain.handle('figures:check', () => integrity.check(dbApi));
};
