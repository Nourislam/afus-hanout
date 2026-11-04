// IPC handlers: app. Moved out of main.js unchanged; main.js passes what they use.
module.exports = function register(ctx) {
    const {
        BrowserWindow,
        EcommerceSyncManager,
        PROFILE,
        WINDOW_THEME,
        app,
        catalog,
        dbApi,
        fs,
        getDbPath,
        getSettingValue,
        ipcMain,
        isDemo,
        logSystemAction,
        nativeTheme,
        path,
        refreshTrial,
        saveSettingValue,
        session,
        shell,
        themeFile,
        trialService,
    } = ctx;

    const { nextReceiptNumber } = require('../services/receiptNumber');

    // Window controls IPC
    ipcMain.handle('window:minimize', () => {
      ctx.mainWindow?.minimize();
    });

    ipcMain.handle('window:maximize', () => {
      if (ctx.mainWindow?.isMaximized()) {
        ctx.mainWindow.unmaximize();
      } else {
        ctx.mainWindow?.maximize();
      }
    });

    ipcMain.handle('window:close', () => {
      ctx.mainWindow?.close();
    });

    // Shell (for opening external URLs)
    ipcMain.handle('shell:openExternal', async (_, url) => {
      // Only web pages, e-mail and WhatsApp links (never a file or a program)
      if (!/^(https?:|mailto:|whatsapp:)/i.test(String(url || ''))) return { success: false, error: 'Unsupported link' };
      try {
        await shell.openExternal(url);
        return { success: true };
      } catch (error) {
        console.error('Failed to open external URL:', error);
        return { success: false, error: error.message };
      }
    });

    // Light / dark theme chosen in Settings
    ipcMain.handle('app:setTheme', (_, { theme, preference } = {}) => {
      const value = theme === 'light' ? 'light' : 'dark';
      const colors = WINDOW_THEME[value];
      nativeTheme.themeSource = preference === 'system' ? 'system' : value;
      for (const win of BrowserWindow.getAllWindows()) {
        win.setBackgroundColor(colors.background);
        if (process.platform !== 'darwin' && typeof win.setTitleBarOverlay === 'function') {
          try { win.setTitleBarOverlay({ color: colors.bar, symbolColor: colors.symbols, height: 40 }); } catch { /* no overlay on this window */ }
        }
      }
      try { fs.writeFileSync(themeFile(), JSON.stringify({ theme: value, preference })); } catch { /* only the start-up colour */ }
      return true;
    });
    const licenseService = require('../services/licenseService');
    const updateService = require('../services/updateService');
    function licenseStatus() {
      return licenseService.check((getSettingValue('license') || {}).key, PROFILE.licensePublicKey);
    }
    ipcMain.handle('about:info', () => ({
      version: app.getVersion(),
      reseller: PROFILE.reseller || '',
      supportPhone: PROFILE.supportPhone || '',
      supportEmail: PROFILE.supportEmail || '',
      supportWebsite: /^https?:\/\//i.test(PROFILE.supportWebsite || '') ? PROFILE.supportWebsite : '',
      updatesConfigured: !!PROFILE.updateUrl,
      license: licenseStatus(),
    }));
    // The licence never blocks anything: it is only checked and shown
    ipcMain.handle('license:set', (_, key) => {
      const result = licenseService.check(key, PROFILE.licensePublicKey);
      if (result.status !== 'valid') return result;
      saveSettingValue('license', { key: String(key).trim() });
      return result;
    });
    ipcMain.handle('update:check', () => updateService.checkForUpdate(PROFILE.updateUrl, app.getVersion()));
    ipcMain.handle('update:open', async (_, url) => {
      if (!/^https?:\/\//i.test(String(url || ''))) return { success: false };
      await shell.openExternal(url);
      return { success: true };
    });

    ipcMain.handle('app:getInfo', () => ({
      version: app.getVersion(),
      dataPath: app.getPath('userData'),
      databasePath: getDbPath(),
      demo: isDemo(),
      platform: process.platform,
      electron: process.versions.electron,
    }));

    // ------------------------------------------------------------------
    // Demo shop (services/demoService.js): its own folder and database file.
    // Entering, starting again and leaving end the session (log in again); the
    // online store only ever sees the shop's own data.
    // ------------------------------------------------------------------
    const demoService = require('../services/demoService');
    const { demoStaff } = require('../services/groceryDemo.ts');
    // The demo shop is tried on the Afus website (the web demo runs this same
    // program): the installed program no longer offers it. Its data, if any,
    // stays until the owner deletes it from Settings › About
    const webDemo = () => !!globalThis.__AFUS_WEB_DEMO__;
    function trialStatus() {
      const clock = ctx.trialClock || { installedAt: Date.now(), now: Date.now() };
      const status = trialService.status({ installedAt: clock.installedAt, now: Math.max(Date.now(), clock.now) });
      return webDemo() ? status : { ...status, demo: { ...status.demo, available: false, daysLeft: 0 } };
    }
    // The demo shop's data stays on disk after its 3 months (only opening it is
    // refused); the owner removes it when they choose, from Settings › About
    function demoDataSize() {
      const folder = demoService.demoFolder();
      if (!fs.existsSync(folder)) return 0;
      let total = 0;
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full); else { try { total += fs.statSync(full).size; } catch { /* gone */ } }
        }
      };
      try { walk(folder); } catch { /* unreadable */ }
      return total;
    }
    ipcMain.handle('demo:data', () => ({ exists: fs.existsSync(demoService.demoFolder()), bytes: demoDataSize() }));
    // Explicit: the owner asked to delete the demo shop's data (never the shop's own)
    ipcMain.handle('demo:discard', async () => {
      if (isDemo()) throw catalog.codedError('DEMO_ACTIVE', {});
      await demoService.discard();
      logSystemAction('demo_discarded', 'Demo shop data deleted by the owner', null, session.getEmployee()?.id || null);
      return { success: true };
    });
    ipcMain.handle('trial:status', () => trialStatus());

    function afterShopSwitch() {
      session.clear();
      refreshTrial();
      EcommerceSyncManager.loadConnections();
      EcommerceSyncManager.refreshSchedule();
    }
    ipcMain.handle('demo:status', () => {
      const lang = (getSettingValue('store_config') || {}).defaultLanguage || 'ar';
      return { active: isDemo(), staff: isDemo() ? demoStaff(lang) : [] };
    });
    ipcMain.handle('demo:enter', async (_, { lang } = {}) => {
      if (!trialStatus().demo.available) throw catalog.codedError('TRIAL_DEMO_ENDED', {});
      const result = await demoService.enter({ lang: ['ar', 'fr', 'en'].includes(lang) ? lang : 'ar' });
      afterShopSwitch();
      return { success: true, created: result.created };
    });
    ipcMain.handle('demo:reset', async (_, { lang } = {}) => {
      if (!isDemo()) throw catalog.codedError('DEMO_NOT_ACTIVE', {});
      const current = (getSettingValue('store_config') || {}).defaultLanguage;
      await demoService.reset({ lang: ['ar', 'fr', 'en'].includes(lang) ? lang : current || 'ar' });
      afterShopSwitch();
      return { success: true };
    });
    ipcMain.handle('demo:exit', async () => {
      const result = await demoService.exit();
      afterShopSwitch();
      return { success: true, exited: result.exited };
    });

    // Generate receipt number
    ipcMain.handle('db:generateReceiptNumber', () => nextReceiptNumber(dbApi));
};
