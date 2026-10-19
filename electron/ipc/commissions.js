// IPC handlers: employee commissions and the employee of the month (an optional add-on).
// The owner sees everyone; an employee only ever gets their own month.
module.exports = function register(ctx) {
    const { dbApi, ipcMain, runTransaction, logSystemAction, session } = ctx;
    const commissions = require('../services/commissionService');

    ipcMain.handle('commissions:board', (_, { month } = {}) => commissions.board(dbApi, month));
    ipcMain.handle('commissions:saveRule', (_, input = {}) => {
      const saved = runTransaction(() => commissions.saveRule(dbApi, input));
      logSystemAction('commission_saved', 'Employee commission saved', { employee_id: input.employee_id, ...saved }, session.getEmployee()?.id || null);
      return saved;
    });
    ipcMain.handle('commissions:mine', (_, { month } = {}) => {
      const me = session.getEmployee();
      return me ? commissions.mine(dbApi, me.id, month) : null;
    });
};
