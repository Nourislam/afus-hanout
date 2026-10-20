// IPC handlers: the stock line by line (with its money) and "Check the figures" (the owner's).
module.exports = function register(ctx) {
    const { dbApi, ipcMain, isDemo, getSettingValue, saveSettingValue, runTransaction, logSystemAction, session } = ctx;
    const codes = require('../services/codesService');
    const stock = require('../services/stockService');
    const integrity = require('../services/integrityService');
    const watch = require('../services/figuresWatch');

    ipcMain.handle('stock:lines', () => {
      const lines = stock.stockLines(dbApi);
      return { lines, totals: stock.stockTotals(lines), byArticle: stock.byArticle(lines), byCategory: stock.byCategory(lines) };
    });
    ipcMain.handle('figures:check', () => {
      const report = integrity.check(dbApi);
      // A check by hand on the shop's own data also clears (or raises) the weekly bar
      if (!isDemo?.()) watch.remember(report, { saveSetting: saveSettingValue });
      return report;
    });
    // Lines that cannot be scanned (no QR, reference or barcode), and a reference for each
    ipcMain.handle('stock:withoutCode', () => codes.linesWithoutCode(dbApi));
    ipcMain.handle('stock:createCodes', () => {
      const made = (runTransaction || ((fn) => fn()))(() => codes.createMissingCodes(dbApi, getSettingValue('sku_settings') || {}));
      if (made.length) logSystemAction?.('codes_created', `Codes made for ${made.length} stock lines`, { count: made.length }, session?.getEmployee()?.id || null);
      return made;
    });
    // The last weekly result (the owner's bar); none in the demo shop
    ipcMain.handle('figures:last', () => (isDemo?.() ? null : getSettingValue(watch.KEY)));
};
