// IPC handlers: settings. Moved out of main.js unchanged; main.js passes what they use.
module.exports = function register(ctx) {
    const {
        catalog,
        getOne,
        ipcMain,
        runInsert,
        runQuery,
        session,
    } = ctx;

    // Settings
    // Settings rows of removed features (the old AI assistant key) stay in the
    // file untouched but are never sent to the interface
    const RETIRED_SETTINGS = ['ai_settings'];

    ipcMain.handle('db:settings:get', (_, key) => {
      if (RETIRED_SETTINGS.includes(key)) return null;
      const row = getOne('SELECT value FROM settings WHERE key = ?', [key]);
      return row ? JSON.parse(row.value) : null;
    });

    // The cashiers' rights (discount limit, returns) are changed by the owner only
    const ADMIN_ONLY_SETTINGS = new Set(['security', 'pos_controls']);
    function checkSettingWrite(key) {
      const actor = session.getEmployee();
      if (ADMIN_ONLY_SETTINGS.has(key) && actor?.role !== 'admin') throw catalog.codedError('ADMIN_REQUIRED', {});
    }

    ipcMain.handle('db:settings:set', (_, { key, value }) => {
      checkSettingWrite(key);
      const jsonValue = JSON.stringify(value);
      const existing = getOne('SELECT key FROM settings WHERE key = ?', [key]);
      if (existing) {
        runInsert('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?', [jsonValue, key]);
      } else {
        runInsert('INSERT INTO settings (key, value) VALUES (?, ?)', [key, jsonValue]);
      }
      return true;
    });

    ipcMain.handle('db:settings:delete', (_, key) => {
      checkSettingWrite(key);
      runInsert('DELETE FROM settings WHERE key = ?', [key]);
      return true;
    });

    ipcMain.handle('db:settings:getAll', () => {
      const rows = runQuery('SELECT key, value FROM settings').filter(row => !RETIRED_SETTINGS.includes(row.key));
      const settings = {};
      rows.forEach(row => {
        settings[row.key] = JSON.parse(row.value);
      });
      return settings;
    });
};
