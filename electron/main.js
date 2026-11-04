const { app, BrowserWindow, ipcMain, dialog, protocol, shell, nativeTheme, Menu, safeStorage, clipboard, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { BRAND, dataDirectory, databasePath } = require('./brand');
const { initDatabase, runQuery, runInsert, runTransaction, getOne, addDatabaseChangeListener, isDemo, getDbPath } = require('./database/init');
const dbApi = require('./database/api');
const catalog = require('./services/catalogService');
const salesStatsService = require('./services/salesStatsService');
const returnService = require('./services/returnService');
const loyaltyService = require('./services/loyaltyService');
const { createWebsiteService } = require('./website/websiteService');
const { createGithubClient } = require('./website/github');
const { createSecureStore } = require('./website/secureStore');
const { createCloudflareClient } = require('./website/cloudflare');
const cloudflareCallbackPage = require('./website/callbackPage');
const session = require('./services/session');
const guard = require('./services/guard');
const ipcGuard = require('./services/ipcGuard');
const i18n = require('./i18n');
const { v4: uuid } = require('uuid');
const ReceiptService = require('./services/receiptService');
const ShiftService = require('./services/shiftService');
const printDocument = require('./services/printDocument');
const SyncManager = require('./sync/SyncManager');
const EcommerceSyncManager = require('./ecommerce/EcommerceSyncManager');

// Before the shop is set up nobody can log in: the setup wizard may do everything
function isFirstSetup() {
  try {
    const row = getOne("SELECT value FROM settings WHERE key = 'setup_completed'");
    if (!row) return true;
    const value = JSON.parse(row.value);
    return !(value === true || value === 'true');
  } catch { return false; }
}
// Every data-changing channel registered from here on is checked against the
// logged-in employee's role (services/ipcGuard.js)
ipcGuard.install(ipcMain, { isFirstSetup });

const receiptService = new ReceiptService();
const shiftService = new ShiftService();

function logSystemAction(actionType, description, details = null, employeeId = null) {
  try {
    runInsert(`
      INSERT INTO system_logs (id, action_type, description, details, employee_id)
      VALUES (?, ?, ?, ?, ?)
    `, [uuid(), actionType, description, details ? JSON.stringify(details) : null, employeeId]);
  } catch (error) {
    console.error('Failed to write system log:', error);
  }
}

// Read one JSON-encoded value from the settings table
function getSettingValue(key) {
  const row = getOne('SELECT value FROM settings WHERE key = ?', [key]);
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

// Save one JSON-encoded value in the settings table
function saveSettingValue(key, value) {
  const json = JSON.stringify(value);
  if (getOne('SELECT key FROM settings WHERE key = ?', [key])) runInsert('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?', [json, key]);
  else runInsert('INSERT INTO settings (key, value) VALUES (?, ?)', [key, json]);
}

// All settings with store_config merged in at top level (the shape the
// receipt/label templates expect)
// Text for native dialogs in the shop's language
function shopT(key, params) {
  let lang;
  try { lang = getStoreSettings().defaultLanguage; } catch { lang = undefined; }
  return i18n.translate(i18n.normalizeLanguage(lang), key, params);
}

function getStoreSettings() {
  const settings = {};
  runQuery('SELECT key, value FROM settings').forEach(row => {
    try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = row.value; }
  });
  Object.assign(settings, settings.store_config || {});
  return settings;
}

let mainWindow;

// Window colours per theme (title bar buttons on Windows, background while loading)
const WINDOW_THEME = {
  dark: { background: '#0b0b0d', bar: '#131316', symbols: '#a1a1aa' },
  light: { background: '#f3f4f7', bar: '#ffffff', symbols: '#52525b' },
};
const themeFile = () => path.join(app.getPath('userData'), 'ui-theme.json');

function savedWindowTheme() {
  try {
    const saved = JSON.parse(fs.readFileSync(themeFile(), 'utf8'));
    return saved.theme === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

// The installed program has no default menu (View › Reload, Toggle
// Developer Tools…). macOS keeps a minimal one so copy/paste and quit work.
function lockMenu() {
  if (!app.isPackaged) return;
  if (process.platform !== 'darwin') { Menu.setApplicationMenu(null); return; }
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }]));
}

function createWindow() {
  const colors = WINDOW_THEME[savedWindowTheme()];
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    // Native window buttons on every system, drawn over our own title bar:
    // macOS keeps its traffic lights, Windows/Linux get the standard
    // minimise / maximise / close buttons. No duplicated buttons.
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 13 } }
      : { titleBarStyle: 'hidden', titleBarOverlay: { color: colors.bar, symbolColor: colors.symbols, height: 40 } }),
    backgroundColor: colors.background,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // The installed program has no developer tools: the shop's data is
      // reached only through the screens (and the checks behind them)
      devTools: !app.isPackaged,
      preload: path.join(__dirname, 'preload.js')
    },
    // public/ is copied into dist/ by Vite; only dist/ is packaged
    icon: path.join(__dirname, app.isPackaged ? '../dist/icon.ico' : '../public/icon.ico')
  });

  // Links with target="_blank" open in the user's browser, never inside the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // The window shows only the program: no navigation to another page
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (app.isPackaged ? !url.startsWith('file://') : !url.startsWith('http://localhost:5173')) event.preventDefault();
  });

  // Load the app. Only the packaged state decides: an installed copy always
  // loads its bundled files, even if NODE_ENV is set on the customer's PC.
  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    SyncManager.setWindow(null);
    EcommerceSyncManager.setWindow(null);
  });

  SyncManager.setWindow(mainWindow);
  EcommerceSyncManager.setWindow(mainWindow);
}


// ------------------------------------------------------------------
// Data folder
// ------------------------------------------------------------------
// The program has its own folder (database, images, settings, browser
// storage and cache): %APPDATA%\Afus<Product>, ~/Library/Application
// Support/Afus<Product> on macOS (dataDirName in electron/shared/brand.json).
// Each Afus product has its own folder and data is never taken from another
// application.
function configureDataDirectory() {
  app.setName(BRAND.productName);
  app.setPath('userData', dataDirectory(app.getPath('appData')));
  // Same id as the installer's shortcuts: taskbar grouping and notifications
  if (process.platform === 'win32') app.setAppUserModelId(BRAND.appId);
}

configureDataDirectory();
// The program's own log (data folder › logs), for support
const logService = require('./services/logService');
logService.init(app.getPath('userData'));

// Register scheme as privileged
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true } }
]);

// Request single instance lock - prevents multiple app instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running, quit this one
  app.quit();
} else {
  // A second launch (e.g. double-clicking the shortcut again) focuses the running window
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // App lifecycle
  app.whenReady().then(async () => {
    lockMenu();
    printDocument.cleanTempFiles();
    // Initialize database. If it cannot be opened, tell the user instead of
    // hanging without a window.
    try {
      await initDatabase();
    } catch (error) {
      console.error('Database initialization failed:', error);
      // The shop's language is not known yet: show the message in the three languages
      const lines = ['ar', 'fr', 'en'].map(l => `${i18n.translate(l, 'dialog.dbFailed')}\n${i18n.translate(l, 'dialog.dataFolder')}: ${app.getPath('userData')}`);
      dialog.showErrorBox(i18n.translate('fr', 'dialog.startFailed', { app: BRAND.productName }),
        `${lines.join('\n\n')}\n\n${error.message}`);
      app.quit();
      return;
    }

    // Install date, demo shop window (an expired demo is only closed, its data kept)
    refreshTrial();
    setInterval(refreshTrial, 60 * 60 * 1000);
    // Website info typed by an older version: copied once to Settings › Shop
    website.moveContactToShop();

    // Daily backup copy (on unless turned off in Settings › Backup)
    runDailyBackup();
    setInterval(runDailyBackup, 60 * 60 * 1000);
    // "Check the figures" once a week, on the shop's own data (services/figuresWatch.js)
    runWeeklyFiguresCheck();
    setInterval(runWeeklyFiguresCheck, 60 * 60 * 1000);

    // Initialize the (optional, currently disabled) sync boundary
    await SyncManager.init();

    // Online store connections (optional module): started once the database is
    // open so the saved connections are loaded; the window is given by createWindow()
    // Never with the demo shop either (its stock is not the shop's)
    EcommerceSyncManager.init({ isEnabled: () => !isDemo() && (getSettingValue('features') || {}).ecommerce === true, isDemo });


  // Register app protocol for serving images
  protocol.registerFileProtocol('app', (request, callback) => {
    let url = request.url.substr(6); // Remove 'app://'
    // Remove trailing slashes
    url = url.replace(/\/+$/, '');
    // Decode URL to handle spaces and special characters
    let decodedUrl = '';
    try { decodedUrl = decodeURI(url); } catch { decodedUrl = ''; }
    // Only a picture of the images folder (never "../" another file)
    const filePath = require('./services/imageService').safeImagePath(decodedUrl);
    if (!filePath) { callback({ error: -6 }); return; }
    callback({ path: filePath });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  });
}

// App lifecycle


// Register Global DB Change Listener for Auto-Sync
addDatabaseChangeListener(() => {
  // Debounce or just trigger
  // SyncManager handles its own "isSyncing" lock so calling frequently is safe
  SyncManager.triggerSync();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ==========================================
// BACKUP & RESTORE
// ==========================================
const backupService = require('./services/backupService');
const backupFolder = () => backupService.backupDir(app.getPath('userData'));
function getBackupSettings() {
  return backupService.resolveSettings(getSettingValue('backup_settings'));
}
// The shop's own pictures (backups are never made of the demo shop)
const shopImagesDir = () => path.join(app.getPath('userData'), 'images');

// Last copy to the other folder: kept in a small file next to the backups,
// so writing it never touches the shop's data
const externalStatusFile = () => path.join(backupFolder(), 'external-copy.json');
function readExternalStatus() {
  try { return JSON.parse(fs.readFileSync(externalStatusFile(), 'utf8')); } catch { return null; }
}
function writeExternalStatus(status) {
  try { fs.mkdirSync(backupFolder(), { recursive: true }); fs.writeFileSync(externalStatusFile(), JSON.stringify(status)); } catch { /* status only */ }
}

/**
 * Made a backup: keep the pictures with it, and the second copy in the other
 * folder when one is chosen. A missing USB key never makes the backup fail;
 * the shop is told in Settings and on the dashboard.
 */
function afterBackup(backup, settings = getBackupSettings()) {
  try { backupService.backupImages(backupFolder(), shopImagesDir()); } catch (error) { console.error('Backup of pictures failed:', error); }
  if (!settings.externalFolder || !backup) return null;
  try {
    backupService.copyToExternal(backupFolder(), backup.name, settings.externalFolder, shopImagesDir(), settings.keepAuto);
    const status = { ok: true, at: new Date().toISOString(), folder: settings.externalFolder };
    writeExternalStatus(status);
    return status;
  } catch (error) {
    console.error('External backup copy failed:', error);
    const status = { ok: false, at: new Date().toISOString(), folder: settings.externalFolder, error: backupError(error) };
    writeExternalStatus(status);
    return status;
  }
}

// A backup that failed: what happened and what to do, in the shop's words
function backupError(error, action = 'BACKUP_FAILED') {
  const code = error && error.code;
  if (code === 'ENOSPC') return catalog.coded('BACKUP_DISK_FULL', {});
  if (code === 'EXTERNAL_MISSING') return catalog.coded('BACKUP_EXTERNAL_MISSING', {});
  if (code === 'EACCES' || code === 'EPERM' || code === 'EROFS') return catalog.coded('BACKUP_NO_ACCESS', {});
  if (code === 'ENOENT' || /not found/i.test(String(error && error.message))) return catalog.coded('BACKUP_NOT_FOUND', {});
  return catalog.coded(action, {});
}

/**
 * Daily automatic backup (on unless the shop turned it off): one copy per
 * day, made when the program starts and checked again every hour for a
 * program left open overnight; the oldest automatic copies beyond `keepAuto`
 * are removed. Copies made by the shop are never removed.
 */
function runDailyBackup() {
  // The shop's settings are read from the shop's data only
  if (isDemo()) return;
  try {
    const settings = getBackupSettings();
    if (!settings.autoDaily) return;
    const dir = backupFolder();
    if (backupService.autoBackupDue(backupService.listBackups(dir))) {
      const backup = backupService.createBackup(dir, databasePath(app.getPath('userData')), { kind: 'auto' });
      afterBackup(backup, settings);
    }
    for (const old of backupService.autoBackupsToPrune(backupService.listBackups(dir), settings.keepAuto)) {
      backupService.deleteBackup(dir, old.name);
    }
  } catch (error) {
    console.error('Daily backup failed:', error);
  }
}
function runWeeklyFiguresCheck() {
  if (isDemo()) return;
  try {
    require('./services/figuresWatch').runIfDue(dbApi, { getSetting: getSettingValue, saveSetting: saveSettingValue });
  } catch (error) {
    console.error('Weekly figures check failed:', error);
  }
}

// Installer profile of the reseller (scripts/use-profile.mjs), licence, updates
const PROFILE = (() => { try { return require('./shared/profile.json'); } catch { return {}; } })();
// How long the demo shop (3 months) is offered, from the install date
// (services/trialService.js). Worked out from the shop's own data only:
// never while the demo shop is open.
const trialService = require('./services/trialService');
let trialClock = null;
function refreshTrial() {
  if (isDemo()) return;
  try { trialClock = trialService.refresh(app.getPath('userData'), dbApi); } catch (error) { console.error('Trial dates:', error); }
}

// Website Manager (electron/website/): the shop's website, kept in the
// settings table (key "website"); the catalogue is only read. Changes: the
// owner only (services/ipcGuard.js).
//
// GitHub is linked with the shop's own account: the installer profile only
// holds the public id of the AFUS GitHub app (no secret); the key GitHub
// gives stays in this process, encrypted by the system (<userData>/secure).
// In development only, a local test server may stand in for GitHub.
const githubTestBase = () => {
  const base = process.env.AFUS_GITHUB_TEST_BASE || '';
  return !app.isPackaged && /^http:\/\/127\.0\.0\.1:\d+$/.test(base) ? base : null;
};
let githubClient = null;
// Cloudflare: the same, with the public id of the AFUS OAuth client and the
// local ports registered with it (http://127.0.0.1:<port>/oauth/callback)
const cloudflareTestBase = () => {
  const base = process.env.AFUS_CLOUDFLARE_TEST_BASE || '';
  return !app.isPackaged && /^http:\/\/127\.0\.0\.1:\d+$/.test(base) ? base : null;
};
const CLOUDFLARE_PORTS = (Array.isArray(PROFILE.cloudflareRedirectPorts) ? PROFILE.cloudflareRedirectPorts : [47651, 47652, 47653])
  .map(Number).filter(p => Number.isInteger(p) && p >= 1024 && p <= 65535).slice(0, 5);
let cloudflareClient = null;
const websiteSecureStore = createSecureStore({
  dir: path.join(app.getPath('userData'), 'secure'),
  safeStorage,
  // Development tests on a Linux without a secret service only
  allowWeak: !app.isPackaged && process.env.AFUS_TEST_WEAK_STORAGE === '1',
});
const bringBack = () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
};
const website = createWebsiteService({
  api: dbApi, getSetting: getSettingValue, saveSetting: saveSettingValue, codedError: catalog.codedError,
  blockedMode: () => (isDemo() ? 'demo' : null),
  currentEmployee: () => session.getEmployee(),
  github: {
    get client() {
      if (!githubClient) {
        const testBase = githubTestBase();
        githubClient = createGithubClient({
          clientId: PROFILE.githubClientId || (!app.isPackaged ? process.env.AFUS_GITHUB_CLIENT_ID : '') || '',
          ...(testBase ? { webBase: testBase, apiBase: `${testBase}/api` } : {}),
        });
      }
      return githubClient;
    },
    store: websiteSecureStore,
    // GitHub's page in the browser, the short code ready to paste
    openPage: async (url, userCode) => {
      if (!String(url).startsWith(`${githubClient.webBase}/`)) return;
      if (userCode) clipboard.writeText(userCode);
      await shell.openExternal(url);
    },
    // Back to the program once the shop agreed on GitHub
    onConnected: bringBack,
  },
  cloudflare: {
    get client() {
      if (!cloudflareClient) {
        const testBase = cloudflareTestBase();
        cloudflareClient = createCloudflareClient({
          clientId: PROFILE.cloudflareClientId || (!app.isPackaged ? process.env.AFUS_CLOUDFLARE_CLIENT_ID : '') || '',
          scopes: Array.isArray(PROFILE.cloudflareScopes) && PROFILE.cloudflareScopes.length ? PROFILE.cloudflareScopes : undefined,
          ...(testBase ? { dashBase: testBase, apiBase: `${testBase}/client/v4`, workerUrl: (name) => `${testBase}/w/${name}` } : {}),
        });
      }
      return cloudflareClient;
    },
    store: websiteSecureStore,
    ports: CLOUDFLARE_PORTS,
    // Cloudflare's page in the browser (only Cloudflare's own address)
    openPage: async (url) => {
      if (!String(url).startsWith(`${cloudflareClient.dashBase}/oauth2/auth?`)) return;
      await shell.openExternal(url);
    },
    onConnected: bringBack,
    // The page the browser shows once it came back, in the shop's language
    callbackPage: (kind) => cloudflareCallbackPage(kind, (getSettingValue('store_config') || {}).defaultLanguage),
  },
  // Own domain (optional): the providers Afus has affiliate links with (profile.json ›
  // domainProviders); the shop buys its domain there, for itself
  domain: {
    providers: Array.isArray(PROFILE.domainProviders) && PROFILE.domainProviders.length ? PROFILE.domainProviders
      : (!app.isPackaged && process.env.AFUS_DOMAIN_PROVIDERS_TEST ? (() => { try { return JSON.parse(process.env.AFUS_DOMAIN_PROVIDERS_TEST); } catch { return []; } })() : []),
    // The provider's page in the shop's browser (the link was checked: https, the provider's own address)
    openExternal: (url) => shell.openExternal(url),
  },
  // Create Website: the shop's pictures (images folder only), the log of each step (no key)
  publish: {
    readImage: (name) => {
      const file = require('./services/imageService').safeImagePath(name);
      return file && fs.existsSync(file) ? fs.readFileSync(file) : null;
    },
    log: (entry) => logService.write('info', `website ${JSON.stringify(entry)}`),
    // The shop's API is https only; plain http only for the local test server (development)
    allowHttp: !!cloudflareTestBase(),
  },
});
// Shops link: the owner's other shops (electron/shops), on the owner's Cloudflare
const { createShopsService } = require('./shops/shopsService');
const shops = createShopsService({
  api: dbApi, getSetting: getSettingValue, saveSetting: saveSettingValue, codedError: catalog.codedError,
  store: websiteSecureStore,
  cloudflare: {
    get client() { return website.cloudflareClient(); },
    websiteAccess: () => website.cloudflareKeys(),
    websiteLinked: () => website.cloudflareLinked(),
  },
  workerSource: fs.readFileSync(path.join(__dirname, 'shops', 'worker', 'link.mjs'), 'utf8'),
  schemaSql: fs.readFileSync(path.join(__dirname, 'shops', 'worker', 'schema.sql'), 'utf8'),
  blockedMode: () => (isDemo() ? 'demo' : null),
  shopName: () => (getSettingValue('store_config') || {}).businessName || '',
  employee: () => session.getEmployee()?.id || null,
});
// The website's orders come into SQLite by themselves while the program is open
// (first a little after it starts, then when the last sync says it is time)
function websiteOrdersTick() {
  website.syncIfDue()
    .then((r) => {
      if (r?.reason && !['idle', 'later'].includes(r.reason)) logService.write('warn', `website orders sync: ${r.reason}`);
      // New orders from the website: said at once (the owner can turn it off, Website › Settings › Messages)
      if (r?.received > 0) notifyNewOrders(r.received);
    })
    .catch(() => logService.write('warn', 'website orders sync failed'))
    .finally(() => {
      // The own domain, when it is time to look again (its records, GitHub's certificate)
      website.domainCheckIfDue().catch(() => logService.write('warn', 'website domain check failed'));
      setTimeout(websiteOrdersTick, 60 * 1000).unref?.();
    });
}
setTimeout(websiteOrdersTick, 20 * 1000).unref?.();
function notifyNewOrders(n) {
  try {
    if (!website.view().tools?.notify || !Notification.isSupported()) return;
    const lang = getShopSettingsForPrint().defaultLanguage;
    const title = lang === 'fr' ? 'Nouvelle commande du site' : lang === 'en' ? 'New website order' : 'طلب جديد من الموقع';
    const body = lang === 'fr' ? `${n} commande(s) à appeler pour confirmer.` : lang === 'en' ? `${n} order(s) to call and confirm.` : `${n} طلب جديد للاتصال والتأكيد.`;
    const note = new Notification({ title, body, silent: false });
    note.on('click', () => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) { win.show(); win.focus(); win.webContents.send('navigate', '/website-orders'); }
    });
    note.show();
  } catch (e) {
    logService.write('warn', `website notification: ${e?.message || e}`);
  }
}
const { testEmailConnection, sendTestEmail, initEmailService } = require('./services/emailService');

// ==========================================
// RECEIPTS
// ==========================================

const DEFAULT_PRINTER_SETTINGS = {
  receipt: { printerName: '', paperWidthMm: 80, copies: 1, autoPrint: false, silent: false },
  label: { printerName: '', copies: 1, silent: false, dpi: 0 },
};

function getPrinterSettings() {
  const saved = getSettingValue('printer_settings') || {};
  return {
    receipt: { ...DEFAULT_PRINTER_SETTINGS.receipt, ...(saved.receipt || {}) },
    label: { ...DEFAULT_PRINTER_SETTINGS.label, ...(saved.label || {}) },
  };
}

// Shop settings plus the logo as a data URI, for receipts and labels
function getShopSettingsForPrint() {
  const settings = getStoreSettings();
  const { getImageBase64: imageAsBase64 } = require('./services/imageService');
  settings.shopLogoDataUri = settings.shopLogo ? imageAsBase64(settings.shopLogo) : null;
  settings.receiptPaperWidthMm = getPrinterSettings().receipt.paperWidthMm;
  settings.demo = isDemo();
  return settings;
}

// A printer removed or renamed in Windows/macOS: say so in the shop's language
function printerError(error, printerName) {
  const message = String(error && error.message || error);
  if (/deviceName|printer.*not found|no printer/i.test(message)) return catalog.codedError('PRINTER_NOT_FOUND', { name: printerName || '' });
  // Already explained (e.g. no code on a label): keep it
  if (/^[A-Z][A-Z0-9_]+\|/.test(message.replace(/^Error: /, ''))) return error;
  // Anything else from the printer driver: say what to do, keep the detail in the log
  console.error('Printing failed:', message);
  return catalog.codedError('PRINT_FAILED', { name: printerName || '' });
}

// ==========================================
// QR LABELS
// ==========================================
const labelService = require('./services/labelService');

function getLabelSettings(overrides = {}) {
  return { ...labelService.DEFAULT_LABEL_SETTINGS, ...(getSettingValue('label_settings') || {}), ...overrides };
}

// ===== EXCEL SERVICE =====
const excelService = require('./services/excelService');



// Helper to get settings object
async function getSettings() {
  // Includes the shop information (store_config) at the top level
  return getStoreSettings();
}

// ==========================================
// CREDIT SALES HANDLERS
// ==========================================

// Kridi invoices (services/creditSaleService.js)
const creditSales = require('./services/creditSaleService');
const generateInvoiceNumber = () => creditSales.nextInvoiceNumber(dbApi);
/** A customer's debt for one sale (inside the caller's transaction). */
const createCreditSale = (creditSale) => creditSales.createCreditSale(dbApi, creditSale);

// End of file

// IPC handlers live in ./ipc, one file per topic.
const ipcContext = {
    shops,
    BRAND,
    BrowserWindow,
    EcommerceSyncManager,
    PROFILE,
    ReceiptService,
    SyncManager,
    WINDOW_THEME,
    afterBackup,
    app,
    backupError,
    backupFolder,
    backupService,
    catalog,
    createCreditSale,
    databasePath,
    dbApi,
    dialog,
    excelService,
    externalStatusFile,
    fs,
    generateInvoiceNumber,
    getBackupSettings,
    getDbPath,
    getLabelSettings,
    getOne,
    getPrinterSettings,
    getSettingValue,
    getSettings,
    getShopSettingsForPrint,
    getStoreSettings,
    githubTestBase,
    guard,
    i18n,
    initDatabase,
    initEmailService,
    ipcGuard,
    ipcMain,
    isDemo,
    isFirstSetup,
    labelService,
    logService,
    logSystemAction,
    loyaltyService,
    get mainWindow() { return mainWindow; },
    set mainWindow(value) { mainWindow = value; },
    nativeTheme,
    path,
    printDocument,
    printerError,
    readExternalStatus,
    receiptService,
    refreshTrial,
    returnService,
    runInsert,
    runQuery,
    runTransaction,
    salesStatsService,
    saveSettingValue,
    sendTestEmail,
    session,
    shell,
    shiftService,
    shopImagesDir,
    shopT,
    testEmailConnection,
    themeFile,
    get trialClock() { return trialClock; },
    set trialClock(value) { trialClock = value; },
    trialService,
    uuid,
    website,
};
require('./ipc/website')(ipcContext);
require('./ipc/backup')(ipcContext);
require('./ipc/reports')(ipcContext);
require('./ipc/catalog')(ipcContext);
require('./ipc/printing')(ipcContext);
require('./ipc/sales')(ipcContext);
require('./ipc/credit')(ipcContext);
require('./ipc/offers')(ipcContext);
require('./ipc/people')(ipcContext);
require('./ipc/stockCount')(ipcContext);
require('./ipc/staff')(ipcContext);
require('./ipc/email')(ipcContext);
require('./ipc/sync')(ipcContext);
require('./ipc/settings')(ipcContext);
require('./ipc/app')(ipcContext);
require('./ipc/shops')(ipcContext);
require('./ipc/charges')(ipcContext);
require('./ipc/commissions')(ipcContext);
require('./ipc/figures')(ipcContext);
require('./ipc/exports')(ipcContext);
