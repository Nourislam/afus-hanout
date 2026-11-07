import { describe, it, expect } from 'vitest';
import { secondsLeft, countdown } from '../src/lib/devices';

describe('the pairing code countdown', () => {
    it('counts whole seconds down to 0', () => {
        expect(secondsLeft(10_000, 0)).toBe(10);
        expect(secondsLeft(10_001, 0)).toBe(11);
        expect(secondsLeft(5_000, 9_000)).toBe(0);
    });

    it('writes minutes and seconds', () => {
        expect(countdown(600)).toBe('10:00');
        expect(countdown(545)).toBe('9:05');
        expect(countdown(0)).toBe('0:00');
        expect(countdown(-3)).toBe('0:00');
    });
});
