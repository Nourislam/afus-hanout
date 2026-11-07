// IPC handlers: the label scale's list (services/scalePluService.js). A file
// for the scale's program (CSV or Excel), a sheet to type it in by hand, and
// "the scale is up to date" to follow what changes after.
module.exports = function register(ctx) {
    const { dbApi, ipcMain, dialog, fs, BrowserWindow, printDocument, printerError, getSettingValue, getShopSettingsForPrint, session, logSystemAction } = ctx;
    const plu = require('../services/scalePluService');
    const { scaleFormat } = require('../shared/scaleBarcode.ts');
    const { translator } = require('../i18n');

    const shopT = () => {
        const shop = getShopSettingsForPrint();
        const T = translator(shop.defaultLanguage);
        return { shop, T, lang: T.lang || shop.defaultLanguage || 'ar' };
    };
    const day = () => new Date().toISOString().slice(0, 10);

    ipcMain.handle('scale:plu', () => plu.pluList(dbApi));
    ipcMain.handle('scale:assignNumbers', () => ({ given: plu.assignNumbers(dbApi), list: plu.pluList(dbApi) }));
    ipcMain.handle('scale:markSent', () => {
        const sent = plu.markSent(dbApi);
        logSystemAction('scale', `Scale list marked up to date (${sent.count} articles)`, sent, session.getEmployee()?.id || null);
        return plu.pluList(dbApi);
    });

    // The file for the scale's program: CSV (what most of them import) or Excel
    ipcMain.handle('scale:saveFile', async (_, format = 'csv') => {
        const { shop, T } = shopT();
        const list = plu.pluList(dbApi);
        const excel = format === 'xlsx';
        const { canceled, filePath } = await dialog.showSaveDialog({
            title: T('plu.save'),
            defaultPath: `${T('plu.file')} - ${day()}.${excel ? 'xlsx' : 'csv'}`,
            filters: [excel ? { name: 'Excel', extensions: ['xlsx'] } : { name: 'CSV', extensions: ['csv'] }],
        });
        if (canceled || !filePath) return null;
        if (excel) {
            const { buildWorkbook } = require('../services/excelReport');
            const { scalePluSheets } = require('../services/exportService');
            fs.writeFileSync(filePath, await buildWorkbook({ shop, T, by: session.getEmployee()?.name || null, sheets: scalePluSheets(dbApi, T), logoDataUri: shop.shopLogoDataUri }));
        } else {
            fs.writeFileSync(filePath, plu.pluCsv(list.rows, { decimals: scaleFormat(getSettingValue('scale_barcode')).decimals }), 'utf8');
        }
        logSystemAction('export', `Scale file saved (${list.rows.length} articles)`, { format }, session.getEmployee()?.id || null);
        return { filePath, rows: list.rows.length };
    });

    // The A4 sheet, on the office printer (system dialog)
    ipcMain.handle('scale:printSheet', async (_, onlyChanged = false) => {
        const { shop, T, lang } = shopT();
        const html = plu.pluSheetHtml(plu.pluList(dbApi), { shop, T, lang, onlyChanged: !!onlyChanged });
        const win = printDocument.hiddenWindow(BrowserWindow, { javascript: false });
        try {
            await printDocument.loadHtml(win, html);
            const result = await printDocument.printContents(win.webContents, { silent: false, printBackground: true, pageSize: 'A4' });
            return result.success;
        } catch (error) {
            throw printerError(error, '');
        } finally {
            if (!win.isDestroyed()) win.destroy();
        }
    });
};
