// The home screen's smart cards: at most three a day, the most useful first,
// none that the shop put aside today («ليس اليوم»). Never during a sale (the
// home screen only shows them).

export const MAX_CARDS = 3;
const KEY = 'afus-hanout.cards.hidden';

/** The cards to show: in their order, without the ones hidden today, at most `max`. */
export function pickCards<T extends { id: string }>(candidates: T[], hidden: string[] = [], max = MAX_CARDS): T[] {
    return candidates.filter(c => !hidden.includes(c.id)).slice(0, max);
}

const today = (now: Date) => `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

/** The cards put aside today on this computer (none when the storage is not there). */
export function hiddenToday(now: Date = new Date()): string[] {
    try {
        const saved = JSON.parse(window.localStorage.getItem(KEY) || 'null');
        return saved && saved.day === today(now) && Array.isArray(saved.ids) ? saved.ids : [];
    } catch {
        return [];
    }
}

/** Put a card aside until tomorrow. */
export function hideToday(id: string, now: Date = new Date()): string[] {
    const ids = [...new Set([...hiddenToday(now), id])];
    try { window.localStorage.setItem(KEY, JSON.stringify({ day: today(now), ids })); } catch { /* storage unavailable */ }
    return ids;
}
