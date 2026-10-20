// IPC handler: the shop's Excel files (services/exportService.js for what they
// hold, services/excelReport.js for their look). One channel, one rule per file
// (services/ipcGuard.js): purchase prices stay the owner's.
module.exports = function register(ctx) {
    const { dbApi, ipcMain, dialog, fs, session, logSystemAction, getShopSettingsForPrint } = ctx;
    const { EXPORTS } = require('../services/exportService');
    const { buildWorkbook } = require('../services/excelReport');
    const { translator } = require('../i18n');

    const safeName = (text) => String(text || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    const today = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    /** Build one file: { buffer, fileName, rows } (also used by the tests). */
    async function build(kind, { lang, ...args } = {}) {
      const def = EXPORTS[kind];
      if (!def) throw new Error(`Unknown export: ${kind}`);
      const shop = getShopSettingsForPrint();
      const T = translator(lang || shop.defaultLanguage);
      const employee = session.getEmployee();
      // The purchase price is the owner's: other roles get the files without it
      const withCost = employee?.role === 'admin';
      const sheets = def.sheets(dbApi, T, { ...args, withCost });
      const buffer = await buildWorkbook({ shop, T, by: employee?.name || null, sheets, logoDataUri: shop.shopLogoDataUri });
      const fileName = `${safeName(T(def.file))} - ${safeName(shop.businessName || 'Afus Boutique')} - ${today()}.xlsx`;
      return { buffer, fileName, rows: sheets[0]?.rows.length || 0 };
    }

    ipcMain.handle('exports:save', async (_, { kind, ...args } = {}) => {
      const file = await build(kind, args);
      const T = translator(args.lang || getShopSettingsForPrint().defaultLanguage);
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: T('xl.save'),
        defaultPath: file.fileName,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });
      if (canceled || !filePath) return null;
      fs.writeFileSync(filePath, file.buffer);
      logSystemAction('export', `Excel file saved: ${kind}`, { kind, rows: file.rows }, session.getEmployee()?.id || null);
      return { filePath, rows: file.rows };
    });

    return { build };
};
