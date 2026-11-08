// A power cut in the middle of a ticket: after the restart the sales screen
// puts the open cart back, for the same employee and the same shop day.
import { describe, it, expect, beforeEach } from 'vitest';
import { saveCartBackup, readCartBackup, clearCartBackup } from '../src/lib/cartBackup';

const store = new Map<string, string>();
beforeEach(() => {
    store.clear();
    (globalThis as unknown as { window: unknown }).window = {
        localStorage: {
            getItem: (k: string) => store.get(k) ?? null,
            setItem: (k: string, v: string) => { store.set(k, v); },
            removeItem: (k: string) => { store.delete(k); },
        },
    };
});

const ticket = { items: [{ id: 'milk', quantity: 2 }], customer: null, discount: 0 };
const at = (h: number, d = 7) => new Date(2026, 10, d, h, 0);

describe('the open cart after a power cut', () => {
    it('comes back for the same employee on the same shop day', () => {
        saveCartBackup(ticket, 'amina', at(20).getTime());
        expect(readCartBackup('amina', at(21))).toEqual(ticket);
        // 01:00: still the shop day that began at 04:00
        expect(readCartBackup('amina', at(1, 8))).toEqual(ticket);
    });

    it('not for another employee, not the next shop day', () => {
        saveCartBackup(ticket, 'amina', at(20).getTime());
        expect(readCartBackup('karim', at(21))).toBeNull();
        expect(readCartBackup('amina', at(9, 8))).toBeNull();
    });

    it('a ticket paid or put on hold (empty cart) leaves nothing', () => {
        saveCartBackup(ticket, 'amina', at(20).getTime());
        saveCartBackup({ items: [] }, 'amina', at(20).getTime());
        expect(readCartBackup('amina', at(21))).toBeNull();
        saveCartBackup(ticket, 'amina', at(20).getTime());
        clearCartBackup();
        expect(readCartBackup('amina', at(21))).toBeNull();
    });

    it('a damaged copy or no storage: nothing comes back, nothing breaks', () => {
        store.set('afus-hanout.open-cart', '{not json');
        expect(readCartBackup('amina', at(21))).toBeNull();
        (globalThis as unknown as { window: unknown }).window = { get localStorage() { throw new Error('blocked'); } };
        expect(() => saveCartBackup(ticket, 'amina')).not.toThrow();
        expect(readCartBackup('amina')).toBeNull();
    });
});
