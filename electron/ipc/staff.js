// IPC handlers: staff. Moved out of main.js unchanged; main.js passes what they use.
module.exports = function register(ctx) {
    const {
        catalog,
        dbApi,
        guard,
        ipcMain,
        logSystemAction,
        runQuery,
        session,
        shiftService,
    } = ctx;

    // Shifts
    ipcMain.handle('db:shifts:start', (_, { employeeId, openingCash, notes }) => {
      const shift = shiftService.startShift(employeeId, openingCash, notes);
      logSystemAction('shift_start', `Shift Started`, { shiftId: shift.id, openingCash }, employeeId);
      return shift;
    });

    ipcMain.handle('db:shifts:end', (_, { shiftId, closingCash, notes, closedBy, cashCount }) => {
      const expected = shiftService.getShiftStats(shiftId).expected_cash;
      const shift = shiftService.endShift(shiftId, closingCash, notes, cashCount);
      logSystemAction('shift_end', `Shift Ended`, { shiftId: shift.id, closingCash, expectedCash: expected, closedBy: closedBy || shift.employee_id }, closedBy || shift.employee_id);
      return shift;
    });

    ipcMain.handle('db:shifts:getOpen', () => shiftService.getOpenShifts());

    ipcMain.handle('db:shifts:getLastClosed', () => shiftService.getLastClosedShift());

    ipcMain.handle('db:shifts:getActivity', (_, { startDate, endDate }) => shiftService.getEmployeeActivity(startDate, endDate));

    ipcMain.handle('db:shifts:getCurrent', (_, employeeId) => {
      return shiftService.getCurrentShift(employeeId);
    });

    // Cash taken out of the drawer (who takes it comes from the session)
    ipcMain.handle('db:shifts:addExpense', (_, { shiftId, amount, reason }) => {
      const actor = session.getEmployee();
      if (!actor) throw catalog.codedError('LOGIN_REQUIRED', {});
      const expense = shiftService.addExpense(shiftId, { amount, reason }, actor);
      logSystemAction('cash_expense', `Cash expense: ${expense.amount} (${expense.reason})`, { shiftId, expenseId: expense.id }, actor.id);
      return expense;
    });
    ipcMain.handle('db:shifts:getExpenses', (_, shiftId) => shiftService.getExpenses(shiftId));

    ipcMain.handle('db:shifts:getStats', (_, shiftId) => {
      return shiftService.getShiftStats(shiftId);
    });

    ipcMain.handle('db:shifts:getHistory', (_, { startDate, endDate }) => shiftService.getShiftHistory(startDate, endDate));

    ipcMain.handle('auth:logout', () => { session.clear(); return true; });
    // A manager types their PIN to agree (discount above the limit, return...).
    // Only checks the PIN: the logged-in employee does not change.
    ipcMain.handle('auth:approve', (_, { employeeId, pin }) => {
      const manager = guard.approver(dbApi, { employeeId, pin });
      return manager ? { ok: true, id: manager.id, name: manager.name } : { ok: false };
    });
    ipcMain.handle('security:getRules', () => guard.readRules(dbApi));

    // System Logs
    ipcMain.handle('db:logs:getAll', (_, { startDate, endDate, type, limit = -1 } = {}) => {
      let query = `
    SELECT l.*, e.name as employee_name 
    FROM system_logs l
    LEFT JOIN employees e ON l.employee_id = e.id
    WHERE 1=1
  `;
      const params = [];

      if (startDate) {
        query += ' AND l.created_at >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += ' AND l.created_at <= ?';
        params.push(endDate);
      }
      if (type && type !== 'all') {
        query += ' AND l.action_type = ?';
        params.push(type);
      }

      // -1: every entry
      query += ' ORDER BY l.created_at DESC LIMIT ?';
      params.push(Number.isInteger(limit) && limit > 0 ? limit : -1);

      return runQuery(query, params);
    });
};
