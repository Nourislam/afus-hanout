// The open cart survives a power cut (انقطاع الكهرباء): every change is kept
// on this computer, and the sales screen puts it back after a restart, for the
// same employee and the same shop day only. A ticket paid or put on hold
// leaves nothing behind (the cart is empty then).
import { shopDayStart } from '../../electron/shared/shopDay.ts';

const KEY = 'afus-hanout.open-cart';

export interface CartTicket { items: unknown[]; [key: string]: unknown }
interface Saved { at: number; employeeId: string | null; ticket: CartTicket }

function storage(): Storage | null {
    try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}

/** Keep the cart as it is now (an empty cart erases the copy). */
export function saveCartBackup(ticket: CartTicket, employeeId: string | null, now: number = Date.now()): void {
    const store = storage();
    if (!store) return;
    try {
        if (!ticket?.items?.length) store.removeItem(KEY);
        else store.setItem(KEY, JSON.stringify({ at: now, employeeId, ticket } satisfies Saved));
    } catch { /* storage full or unavailable: the cart stays in memory */ }
}

/** The cart left open by this employee today (shop day), or null. */
export function readCartBackup(employeeId: string | null, now: Date = new Date()): CartTicket | null {
    const store = storage();
    if (!store) return null;
    try {
        const saved = JSON.parse(store.getItem(KEY) || 'null') as Saved | null;
        if (!saved?.ticket?.items?.length || saved.employeeId !== employeeId) return null;
        if (saved.at < shopDayStart(now).getTime() || saved.at > now.getTime() + 60000) return null;
        return saved.ticket;
    } catch {
        return null;
    }
}

export function clearCartBackup(): void {
    try { storage()?.removeItem(KEY); } catch { /* nothing to clear */ }
}
