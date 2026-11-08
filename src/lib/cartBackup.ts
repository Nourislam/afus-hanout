// The open cart survives a power cut (انقطاع الكهرباء): every change of the
// ticket is kept in a small file next to the shop's database (main process,
// written to the disk at once), and the sales screen puts it back after a
// restart, for the same employee and the same shop day only. A ticket paid or
// put on hold erases it. The browser's own storage writes seconds late and
// loses them in a cut, so it is not used for this.
import { shopDayStart } from '../../electron/shared/shopDay.ts';

export interface CartTicket { items: unknown[]; [key: string]: unknown }
export interface KeptCart { at: number; employeeId: string | null; ticket: CartTicket }

interface CartBridge { keep(payload: KeptCart | null): Promise<unknown>; kept(): Promise<KeptCart | null> }
const bridge = (): CartBridge | null => {
    try { return (window as unknown as { electronAPI?: { cart?: CartBridge } }).electronAPI?.cart || null; } catch { return null; }
};

/** What is kept for this ticket: null (erase) when the cart is empty. */
export function cartPayload(ticket: CartTicket, employeeId: string | null, now: number = Date.now()): KeptCart | null {
    return ticket?.items?.length ? { at: now, employeeId, ticket } : null;
}

/** The cart to put back: this employee's, from this shop day, with lines; else null. */
export function cartToRestore(kept: KeptCart | null, employeeId: string | null, now: Date = new Date()): CartTicket | null {
    if (!kept?.ticket?.items?.length || kept.employeeId !== employeeId) return null;
    if (!(kept.at >= shopDayStart(now).getTime()) || kept.at > now.getTime() + 60000) return null;
    return kept.ticket;
}

export function saveCartBackup(ticket: CartTicket, employeeId: string | null): void {
    bridge()?.keep(cartPayload(ticket, employeeId)).catch(() => { /* the cart stays in memory */ });
}

export async function readCartBackup(employeeId: string | null): Promise<CartTicket | null> {
    try { return cartToRestore((await bridge()?.kept()) ?? null, employeeId); } catch { return null; }
}
