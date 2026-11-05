// The 1541 communes of the 58 wilayas, shipped with the program for the shop's
// address (Settings › Shop).
import { describe, it, expect } from 'vitest';
import COMMUNES from '../electron/shared/communes.json';

type Commune = [latin: string, arabic: string];
const LIST = COMMUNES as unknown as Record<string, Commune[]>;

describe('communes', () => {
    it('58 wilayas, 1541 communes, each with its Latin and Arabic name', () => {
        expect(Object.keys(LIST).map(Number).sort((a, b) => a - b)).toEqual(Array.from({ length: 58 }, (_, i) => i + 1));
        const all = Object.values(LIST).flat();
        expect(all.length).toBe(1541);
        for (const [latin, arabic] of all) {
            expect(latin).toMatch(/^[A-Za-z][A-Za-z' .()-]*$/);
            expect(arabic).toMatch(/[؀-ۿ]/);
        }
        expect(LIST['16'].some(([l, a]) => l === 'Kouba' && a === 'القبة')).toBe(true);
    });
});
