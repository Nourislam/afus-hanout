// IPC handlers: backup. Moved out of main.js unchanged; main.js passes what they use.
module.exports = function register(ctx) {
    const {
        BRAND,
        afterBackup,
        app,
        backupError,
        backupFolder,
        backupService,
        catalog,
        databasePath,
        dialog,
        externalStatusFile,
        fs,
        getBackupSettings,
        getDbPath,
        getOne,
        initDatabase,
        ipcMain,
        isDemo,
        logService,
        path,
        readExternalStatus,
        refreshTrial,
        runQuery,
        saveSettingValue,
        session,
        shell,
        shopImagesDir,
        shopT,
        website,
    } = ctx;

    let sqlModule = null;
    async function sqlJs() {
      if (!sqlModule) sqlModule = await require('sql.js')();
      return sqlModule;
    }

    // The demo shop never touches the shop's backups (made, restored, deleted,
    // imported or exported): it has its own "start again" instead.
    const demoBlocked = () => (isDemo() ? { success: false, error: catalog.coded('DEMO_ACTIVE', {}) } : null);

    // Backups kept in the data folder, newest first
    ipcMain.handle('backup:list', () => (isDemo()
      ? { folder: null, backups: [], settings: getBackupSettings(), demo: true }
      : {
        folder: backupFolder(),
        backups: backupService.listBackups(backupFolder()),
        settings: getBackupSettings(),
        external: readExternalStatus(),
      }));

    // Are the shop's data safe? (the reminder bar for the owner)
    ipcMain.handle('backup:status', () => {
      if (isDemo()) return { demo: isDemo() };
      const backups = backupService.listBackups(backupFolder());
      return { lastBackupAt: backups.length ? backups[0].createdAt : null, external: readExternalStatus(), autoDaily: getBackupSettings().autoDaily };
    });

    // The other folder for a second copy (USB key, other disk, synced folder)
    ipcMain.handle('backup:chooseExternal', async () => {
      if (isDemo()) return demoBlocked();
      const { filePaths } = await dialog.showOpenDialog({ title: shopT('dialog.externalBackup'), properties: ['openDirectory', 'createDirectory'] });
      if (!filePaths || !filePaths.length) return { success: false, canceled: true };
      const settings = { ...getBackupSettings(), externalFolder: filePaths[0] };
      saveSettingValue('backup_settings', settings);
      // A first copy at once, so the shop sees it works
      const latest = backupService.listBackups(backupFolder())[0]
        || backupService.createBackup(backupFolder(), databasePath(app.getPath('userData')));
      return { success: true, folder: filePaths[0], external: afterBackup(latest, settings) };
    });
    ipcMain.handle('backup:clearExternal', () => {
      if (isDemo()) return demoBlocked();
      saveSettingValue('backup_settings', { ...getBackupSettings(), externalFolder: '' });
      try { fs.unlinkSync(externalStatusFile()); } catch { /* none */ }
      return { success: true };
    });

    ipcMain.handle('backup:create', async () => {
      if (isDemo()) return demoBlocked();
      try {
        const backup = backupService.createBackup(backupFolder(), databasePath(app.getPath('userData')));
        return { success: true, backup, external: afterBackup(backup) };
      } catch (error) {
        console.error('Backup failed:', error);
        return { success: false, error: backupError(error) };
      }
    });

    // What a backup holds, next to the current data, shown before restoring it
    ipcMain.handle('backup:inspect', async (_, name) => {
      if (isDemo()) throw catalog.codedError('DEMO_ACTIVE', {});
      const SQL = await sqlJs();
      const file = backupService.backupPath(backupFolder(), name);
      return {
        backup: backupService.summarizeDatabase(SQL, fs.readFileSync(file)),
        current: backupService.summarizeDatabase(SQL, fs.readFileSync(databasePath(app.getPath('userData')))),
      };
    });

    ipcMain.handle('backup:restore', async (_, name) => {
      if (isDemo()) return demoBlocked();
      const dir = backupFolder();
      const dbPath = databasePath(app.getPath('userData'));
      try {
        const file = backupService.backupPath(dir, name);
        const summary = backupService.summarizeDatabase(await sqlJs(), fs.readFileSync(file));
        if (!summary.valid) return { success: false, error: shopT('backup.invalidFile') };
        // The data of today is kept first: a restore can always be undone
        const safety = backupService.createBackup(dir, dbPath, { kind: 'before-restore' });
        try { backupService.backupImages(dir, shopImagesDir()); } catch { /* pictures are never removed */ }
        try {
          fs.copyFileSync(file, `${dbPath}.restore.tmp`);
          fs.renameSync(`${dbPath}.restore.tmp`, dbPath);
          await initDatabase();
        } catch (error) {
          fs.copyFileSync(path.join(dir, safety.name), dbPath);
          await initDatabase();
          throw error;
        }
        refreshTrial();
        website.moveContactToShop();
        // The pictures of the restored articles come back too (none removed)
        try { backupService.restoreImages(dir, shopImagesDir()); } catch (error) { console.error('Pictures not restored:', error); }
        // The employees may differ in the restored data: log in again
        session.clear();
        return { success: true, safety: safety.name };
      } catch (error) {
        console.error('Restore failed:', error);
        return { success: false, error: backupError(error, 'RESTORE_FAILED') };
      }
    });

    ipcMain.handle('backup:delete', (_, name) => demoBlocked() || backupService.deleteBackup(backupFolder(), name));

    // A copy of a backup on a USB key or another disk
    ipcMain.handle('backup:export', async (_, name) => {
      if (isDemo()) return demoBlocked();
      const file = backupService.backupPath(backupFolder(), name);
      const { filePath } = await dialog.showSaveDialog({
        title: shopT('dialog.exportBackup'),
        defaultPath: name,
        filters: [{ name: shopT('dialog.backupFiles'), extensions: ['db'] }],
      });
      if (!filePath) return { success: false, canceled: true };
      fs.copyFileSync(file, filePath);
      // The pictures go with it (afus-boutique-images next to the file)
      try { backupService.backupImages(backupFolder(), shopImagesDir()); backupService.exportImages(backupFolder(), filePath); } catch (error) { console.error('Pictures not exported:', error); }
      return { success: true, path: filePath };
    });

    // A backup brought from elsewhere: checked, then added to the list (restored only after its preview)
    ipcMain.handle('backup:import', async () => {
      if (isDemo()) return demoBlocked();
      const { filePaths } = await dialog.showOpenDialog({
        title: shopT('dialog.importBackup'),
        // .sqlite: backups saved by earlier versions of this application
        filters: [{ name: shopT('dialog.backupFiles'), extensions: ['db', 'sqlite'] }],
        properties: ['openFile'],
      });
      if (!filePaths || !filePaths.length) return { success: false, canceled: true };
      const summary = backupService.summarizeDatabase(await sqlJs(), fs.readFileSync(filePaths[0]));
      if (!summary.valid) return { success: false, error: shopT('backup.invalidFile') };
      const backup = backupService.createBackup(backupFolder(), filePaths[0], { kind: 'imported' });
      try { backupService.importImages(filePaths[0], backupFolder()); } catch (error) { console.error('Pictures not imported:', error); }
      return { success: true, backup };
    });

    ipcMain.handle('backup:openFolder', async () => {
      if (isDemo()) return demoBlocked();
      fs.mkdirSync(backupFolder(), { recursive: true });
      const error = await shell.openPath(backupFolder());
      return { success: !error, error };
    });

    ipcMain.handle('backup:reset', async () => {
      if (isDemo()) return demoBlocked();
      const dbPath = databasePath(app.getPath('userData'));
      try {
        if (fs.existsSync(dbPath)) {
          // Keep a copy so an accidental reset can still be recovered
          const safetyCopy = `${dbPath}.before-reset-${new Date().toISOString().replace(/[:.]/g, '-')}`;
          fs.copyFileSync(dbPath, safetyCopy);
          console.log('Database copied before reset:', safetyCopy);
          fs.unlinkSync(dbPath);
        }
        await initDatabase();
        session.clear();
        return { success: true };
      } catch (error) {
        console.error('Reset failed:', error);
        return { success: false, error: backupError(error, 'RESET_FAILED') };
      }
    });

    // Errors seen in the window go into the same log
    ipcMain.handle('log:write', (_, { level = 'error', message = '' } = {}) => {
      logService.write(['error', 'warn', 'info'].includes(level) ? level : 'error', '[window]', String(message).slice(0, 4000));
      return true;
    });

    // Support file: versions, system, the size of the data and the recent log
    // (no customer data, no passwords), saved where the shop chooses
    ipcMain.handle('support:bundle', async () => {
      const count = (table) => { try { return getOne(`SELECT COUNT(*) AS n FROM ${table}`)?.n ?? 0; } catch { return 'n/a'; } };
      const settings = {};
      try {
        for (const row of runQuery('SELECT key, value FROM settings')) {
          try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = row.value; }
        }
      } catch { /* no settings */ }
      // The shop's identity stays out except its name; logos and signatures are images
      for (const key of ['store_config']) {
        if (settings[key] && typeof settings[key] === 'object') {
          const { shopLogo: _l, poSignatureImage: _s, ...rest } = settings[key];
          settings[key] = rest;
        }
      }
      const text = logService.supportBundle({
        version: app.getVersion(),
        electron: process.versions.electron,
        dataPath: app.getPath('userData'),
        counts: {
          demo: isDemo(),
          products: count('products'), variants: count('product_variants'), sales: count('sales'), customers: count('customers'),
          employees: count('employees'), backups: backupService.listBackups(backupFolder()).length,
          databaseBytes: (() => { try { return fs.statSync(getDbPath()).size; } catch { return 'n/a'; } })(),
        },
        migrations: (() => { try { return runQuery('SELECT version, applied_at FROM schema_migrations ORDER BY applied_at'); } catch { return []; } })(),
        settings,
      });
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: shopT('dialog.supportFile'),
        defaultPath: `${BRAND.fileSlug}-support-${new Date().toISOString().slice(0, 10)}.txt`,
        filters: [{ name: 'Text', extensions: ['txt'] }],
      });
      if (canceled || !filePath) return { success: false, canceled: true };
      fs.writeFileSync(filePath, text, 'utf8');
      return { success: true, path: filePath };
    });

    ipcMain.handle('support:openLogs', async () => {
      const folder = path.join(app.getPath('userData'), 'logs');
      fs.mkdirSync(folder, { recursive: true });
      const error = await shell.openPath(folder);
      return { success: !error, error };
    });
};
