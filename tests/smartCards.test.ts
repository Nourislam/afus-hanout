// At most three smart cards a day, the most useful first, and the one put
// aside («ليس اليوم») comes back tomorrow.
import { describe, it, expect, beforeEach } from 'vitest';
import { pickCards, hiddenToday, hideToday } from '../src/lib/smartCards';

const store = new Map<string, string>();
beforeEach(() => {
    store.clear();
    (globalThis as unknown as { window: unknown }).window = {
        localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } },
    };
});

describe('the smart cards', () => {
    it('three at most, in their order, without the ones put aside', () => {
        const cards = ['odd', 'visits', 'season', 'soon', 'scale'].map(id => ({ id }));
        expect(pickCards(cards).map(c => c.id)).toEqual(['odd', 'visits', 'season']);
        expect(pickCards(cards, ['visits']).map(c => c.id)).toEqual(['odd', 'season', 'soon']);
    });

    it('a card put aside today comes back tomorrow', () => {
        const day = new Date(2026, 10, 7, 9);
        hideToday('season', day);
        hideToday('odd', day);
        expect(hiddenToday(day)).toEqual(['season', 'odd']);
        expect(hiddenToday(new Date(2026, 10, 8, 9))).toEqual([]);
    });

    it('no storage: nothing is hidden, nothing breaks', () => {
        (globalThis as unknown as { window: unknown }).window = { localStorage: { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } } };
        expect(hiddenToday()).toEqual([]);
        expect(hideToday('x')).toEqual(['x']);
    });
});
