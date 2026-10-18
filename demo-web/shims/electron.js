// Electron, played in the browser for the web demo: the program's own main
// process code runs in the page; its window channels are plain functions.
// Nothing leaves the page (no file, no network, no printer).
const handlers = new Map();
const listeners = new Map(); // main -> window events
const mainListeners = new Map(); // window -> main (ipcRenderer.send)
let windowCreated;
export const whenWindow = new Promise((r) => { windowCreated = r; });

const noop = () => {};
/** An object that accepts any call (parts of Electron the demo never needs). */
const anything = () => new Proxy(function () {}, { get: (t, k) => (k === 'then' ? undefined : k === Symbol.toPrimitive ? () => '' : anything()), apply: () => undefined });

const emit = (channel, args) => (listeners.get(channel) || []).forEach(cb => { try { cb({ sender: null }, ...args); } catch (e) { console.error(e); } });
const clone = (v) => { try { return structuredClone(v); } catch { return v === undefined ? v : JSON.parse(JSON.stringify(v)); } };

export const ipcMain = {
    handle(channel, fn) { handlers.set(channel, fn); },
    removeHandler(channel) { handlers.delete(channel); },
    on(channel, fn) { if (!mainListeners.has(channel)) mainListeners.set(channel, []); mainListeners.get(channel).push(fn); },
    once(channel, fn) { this.on(channel, fn); },
    removeAllListeners: noop,
};

const webContents = {
    send: (channel, ...args) => emit(channel, clone(args)),
    on: noop, once: noop, setWindowOpenHandler: noop, openDevTools: noop, closeDevTools: noop, isDestroyed: () => false,
    print: (o, cb) => cb?.(false, 'demo'), printToPDF: async () => new Uint8Array(), getPrintersAsync: async () => [], session: anything(),
};
export class BrowserWindow {
    constructor() { this.webContents = webContents; BrowserWindow._all = [this]; setTimeout(() => windowCreated(this), 0); }
    static getAllWindows() { return BrowserWindow._all || []; }
    static getFocusedWindow() { return (BrowserWindow._all || [])[0] || null; }
    static fromWebContents() { return (BrowserWindow._all || [])[0] || null; }
    loadURL() { return Promise.resolve(); }
    loadFile() { return Promise.resolve(); }
    on() {} once() {} show() {} focus() {} restore() {} minimize() {} maximize() {} unmaximize() {} close() {} destroy() {}
    isMinimized() { return false; } isMaximized() { return false; } isDestroyed() { return false; } isFocused() { return true; }
    setTitleBarOverlay() {} setBackgroundColor() {} setContentSize() {} getContentSize() { return [window.innerWidth, window.innerHeight]; }
}

const paths = { userData: '/afus/userData', appData: '/afus/appData', temp: '/afus/temp', home: '/afus/home', documents: '/afus/documents', downloads: '/afus/downloads', desktop: '/afus/desktop', logs: '/afus/logs', exe: '/afus/app' };
export const app = {
    isPackaged: true,
    name: 'Afus Boutique',
    getPath: (name) => paths[name] || `/afus/${name}`,
    setPath: (name, value) => { paths[name] = value; },
    setName: noop, setAppUserModelId: noop, getName: () => 'Afus Boutique',
    getVersion: () => (typeof __AFUS_VERSION__ !== 'undefined' ? __AFUS_VERSION__ : '1.0.0'),
    getLocale: () => 'ar', getSystemLocale: () => 'ar',
    whenReady: () => Promise.resolve(),
    isReady: () => true,
    requestSingleInstanceLock: () => true,
    on: noop, once: noop, quit: noop, exit: noop, relaunch: noop, focus: noop,
    setLoginItemSettings: noop, getLoginItemSettings: () => ({}),
};

export const dialog = {
    showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
    showSaveDialog: async () => ({ canceled: true }),
    showMessageBox: async () => ({ response: 0 }),
    showErrorBox: (t, m) => console.error(t, m),
    showMessageBoxSync: () => 0,
};
// Links leave the demo only by a click of the visitor, in a new tab (WhatsApp, a help page)
export const shell = {
    openExternal: async (url) => { if (/^https:\/\//.test(String(url))) window.open(url, '_blank', 'noopener'); },
    openPath: async () => '', showItemInFolder: noop, beep: noop,
};
export const protocol = { registerSchemesAsPrivileged: noop, registerFileProtocol: noop, handle: noop, registerBufferProtocol: noop };
export const nativeTheme = { shouldUseDarkColors: false, themeSource: 'system', on: noop };
export const Menu = { setApplicationMenu: noop, buildFromTemplate: () => ({}) };
export const safeStorage = { isEncryptionAvailable: () => false, encryptString: (s) => new TextEncoder().encode(s), decryptString: (b) => new TextDecoder().decode(b), getSelectedStorageBackend: () => 'basic_text', setUsePlainTextEncryption: noop };
export const clipboard = { writeText: (t) => { try { navigator.clipboard?.writeText(t); } catch { /* not allowed */ } }, readText: () => '' };
export class Notification { static isSupported() { return false; } on() {} show() {} }
export const net = { fetch: async () => { throw new Error('demo: offline'); }, request: () => anything() };
export const screen = { getPrimaryDisplay: () => ({ workAreaSize: { width: 1400, height: 900 } }) };
export const powerMonitor = { on: noop };
export const globalShortcut = { register: noop, unregisterAll: noop };

// The window side
export const contextBridge = { exposeInMainWorld: (key, api) => { window[key] = api; } };
export const ipcRenderer = {
    invoke(channel, ...args) {
        const fn = handlers.get(channel);
        if (!fn) return Promise.reject(new Error(`Error invoking remote method '${channel}': Error: No handler registered for '${channel}'`));
        return Promise.resolve()
            .then(() => fn({ sender: webContents }, ...clone(args)))
            .then(clone, (e) => { throw new Error(`Error invoking remote method '${channel}': ${e instanceof Error ? `Error: ${e.message}` : e}`); });
    },
    on(channel, cb) { if (!listeners.has(channel)) listeners.set(channel, []); listeners.get(channel).push(cb); return ipcRenderer; },
    once(channel, cb) { const w = (...a) => { ipcRenderer.removeListener(channel, w); cb(...a); }; return ipcRenderer.on(channel, w); },
    removeListener(channel, cb) { listeners.set(channel, (listeners.get(channel) || []).filter(x => x !== cb)); return ipcRenderer; },
    removeAllListeners(channel) { listeners.delete(channel); },
    send(channel, ...args) { (mainListeners.get(channel) || []).forEach(fn => fn({ sender: webContents, reply: noop }, ...clone(args))); },
    sendSync: () => null,
};

export const demoChannels = () => [...handlers.keys()];
export default { app, BrowserWindow, ipcMain, dialog, shell, protocol, nativeTheme, Menu, safeStorage, clipboard, Notification, net, screen, powerMonitor, globalShortcut, contextBridge, ipcRenderer };
