// A power cut in the middle of a ticket: after the restart the sales screen
// puts the open cart back, for the same employee and the same shop day. The
// cart is kept in a file written whole at each change.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { cartPayload, cartToRestore } from '../src/lib/cartBackup';

const require = createRequire(import.meta.url);
const { keepCart, keptCart } = require('../electron/services/cartFile');

const ticket = { items: [{ id: 'milk', quantity: 2 }], customer: null, discount: 0 };
const at = (h: number, d = 7) => new Date(2026, 10, d, h, 0);

describe('the open cart after a power cut', () => {
    it('comes back for the same employee on the same shop day (01:00 is still the evening\'s)', () => {
        const kept = cartPayload(ticket, 'amina', at(20).getTime());
        expect(cartToRestore(kept, 'amina', at(21))).toEqual(ticket);
        expect(cartToRestore(kept, 'amina', at(1, 8))).toEqual(ticket);
    });

    it('not for another employee, not the next shop day, not an empty cart', () => {
        const kept = cartPayload(ticket, 'amina', at(20).getTime());
        expect(cartToRestore(kept, 'karim', at(21))).toBeNull();
        expect(cartToRestore(kept, 'amina', at(9, 8))).toBeNull();
        expect(cartPayload({ items: [] }, 'amina')).toBeNull();
        expect(cartToRestore(null, 'amina')).toBeNull();
    });
});

describe('the file on the disk', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afus-cart-'));
    const file = path.join(dir, 'afus-hanout.db.open-cart.json');

    it('is written whole and read back; null erases it', () => {
        keepCart(file, cartPayload(ticket, 'amina', at(20).getTime()));
        expect(fs.existsSync(`${file}.tmp`)).toBe(false);
        expect(keptCart(file)).toEqual({ at: at(20).getTime(), employeeId: 'amina', ticket });
        keepCart(file, null);
        expect(fs.existsSync(file)).toBe(false);
        expect(keptCart(file)).toBeNull();
        keepCart(file, null); // nothing to erase: no error
    });

    it('a damaged file gives nothing back', () => {
        fs.writeFileSync(file, '{"at": 1, "tick');
        expect(keptCart(file)).toBeNull();
    });
});
