// IPC handlers: the seasons to prepare, the day's closing summary, what looks
// odd, and the zakat estimate's figures (services/seasonService.js,
// dayService.js, zakatService.js). They only read: nothing is changed.
module.exports = function register(ctx) {
    const { dbApi, ipcMain, session, shiftService } = ctx;
    const seasons = require('../services/seasonService');
    const day = require('../services/dayService');
    const { zakatFigures } = require('../services/zakatService');

    ipcMain.handle('seasons:upcoming', () => seasons.upcoming());
    ipcMain.handle('seasons:prep', (_, id) => seasons.prepList(dbApi, String(id || 'ramadan')));

    // The profit is the owner's: other roles get the summary without it
    ipcMain.handle('day:summary', () => {
        const summary = day.daySummary(dbApi);
        if (session.getEmployee()?.role !== 'admin') delete summary.profit;
        return summary;
    });
    ipcMain.handle('day:oddities', () => day.oddities(dbApi, {
        cashDifference: (shiftId) => shiftService.getShiftStats(shiftId).cash_difference,
    }));

    // The cash expected in the drawers still open, with the shop's figures
    ipcMain.handle('zakat:figures', () => {
        let drawers = 0;
        for (const shift of shiftService.getOpenShifts()) {
            try { drawers += Number(shiftService.getShiftStats(shift.id).expected_cash) || 0; } catch { /* a broken drawer is skipped */ }
        }
        return zakatFigures(dbApi, { drawers });
    });
};
