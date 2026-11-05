// The payment window's rules: cash is the default and the big button (or
// Enter) with nothing typed means "the exact amount"; Baridi Pay has its minimum.
import { describe, it, expect } from 'vitest';
import { cashReceived, baridiPayProblem } from '../src/lib/payments';

describe('paying', () => {
    it('nothing typed in cash = the exact amount; a typed amount is what was handed over', () => {
        expect(cashReceived('', 815)).toBe(815);
        expect(cashReceived('   ', 815)).toBe(815);
        expect(cashReceived('1000', 815)).toBe(1000);
        expect(cashReceived('500', 815)).toBe(500);
    });

    it('Baridi Pay: under 100 DA it is refused, otherwise the SMS must have arrived', () => {
        expect(baridiPayProblem(75, true)).toBe('pay.baridiMin');
        expect(baridiPayProblem(150, false)).toBe('pay.baridiSms');
        expect(baridiPayProblem(150, true)).toBeNull();
        // 128.20 − 28.20 left after a gift card is 100 DA, not 99.999…
        expect(baridiPayProblem(128.2 - 28.2, true)).toBeNull();
    });
});
