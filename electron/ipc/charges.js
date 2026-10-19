// IPC handlers: shop charges and the month's net profit (an optional add-on, the owner's).
module.exports = function register(ctx) {
    const { dbApi, ipcMain, runTransaction, logSystemAction, session, getSettingValue } = ctx;
    const charges = require('../services/chargesService');

    ipcMain.handle('charges:list', () => charges.list(dbApi));
    ipcMain.handle('charges:save', (_, input = {}) => {
      const saved = runTransaction(() => charges.save(dbApi, input));
      logSystemAction('charge_saved', `Shop charge saved: ${saved.name}`, { id: saved.id, amount: saved.amount, every: saved.every_months }, session.getEmployee()?.id || null);
      return saved;
    });
    ipcMain.handle('charges:stop', (_, { id, month } = {}) => runTransaction(() => charges.stop(dbApi, id, month)));
    // The employees' commissions are taken off too while that add-on is on
    ipcMain.handle('charges:netProfit', (_, { month } = {}) => charges.netProfit(dbApi, month, {
      withCommissions: (getSettingValue('features') || {}).commissions === true,
    }));
};
