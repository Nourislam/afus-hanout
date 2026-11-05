// Simple mode shows only the everyday screens of a grocery shop; full mode
// shows every module. Saved for the whole shop in the settings table
// (key ui_mode). A new shop starts in simple mode (set by the setup wizard);
// a shop set up before this option existed keeps the full menu.
export const UI_MODES = ['simple', 'full'];

/** Menu entries kept in simple mode by default (Settings stays reachable in both). */
export const SIMPLE_PATHS = ['/pos', '/products', '/inventory', '/labels', '/credit-sales', '/reports'];

/** The sales screen is always in the simple menu. */
export const SIMPLE_LOCKED = '/pos';

/** The pages the owner chose for the simple menu (key ui_simple_pages). */
export function resolveSimplePages(saved) {
    const list = Array.isArray(saved) ? saved.filter(p => typeof p === 'string' && p.startsWith('/')) : SIMPLE_PATHS;
    return [SIMPLE_LOCKED, ...new Set(list.filter(p => p !== SIMPLE_LOCKED))];
}

/** Save the simple menu's pages for the shop and apply them at once. */
export async function saveSimplePages(pages) {
    const value = resolveSimplePages(pages);
    await window.electronAPI.settings.set({ key: 'ui_simple_pages', value });
    const { useSettingsStore } = await import('../stores/settingsStore');
    await useSettingsStore.getState().loadSettings();
    return value;
}

export function resolveUiMode(saved) {
    return UI_MODES.includes(saved) ? saved : 'full';
}

/** Save the mode for the shop and apply it at once. */
export async function saveUiMode(mode) {
    const value = resolveUiMode(mode);
    await window.electronAPI.settings.set({ key: 'ui_mode', value });
    const { useSettingsStore } = await import('../stores/settingsStore');
    await useSettingsStore.getState().loadSettings();
    return value;
}
