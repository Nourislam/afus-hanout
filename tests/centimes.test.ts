// People in Algeria say prices in centimes: 250 DA is «25 ألف» (25 thousand
// centimes). An option writes it under the amounts, and the «ألف» key turns
// what was typed into dinars (25 then ألف = 250 DA).
import { describe, it, expect } from 'vitest';
import { centimesLabel, thousandKey } from '../electron/shared/grocery';
import { resolvePosControls as resolve } from '../electron/shared/posControls.mjs';

const resolvePosControls = resolve as (saved: object) => Record<string, unknown>;

describe('centimes', () => {
    it('250 DA reads «25 ألف», 1550 DA «155 ألف», 7.50 DA nothing (under 10 DA)', () => {
        expect(centimesLabel(250, 'ar')).toBe('25 ألف');
        expect(centimesLabel(1550, 'ar')).toBe('155 ألف');
        expect(centimesLabel(255, 'ar')).toBe('25.5 ألف');
        expect(centimesLabel(250, 'fr')).toBe('25 mille');
        expect(centimesLabel(250, 'en')).toBe('25 thousand');
        expect(centimesLabel(7.5, 'ar')).toBe('');
        expect(centimesLabel(0, 'ar')).toBe('');
    });

    it('the «ألف» key: 25 → 250 DA, 1.5 → 15 DA, nothing typed stays nothing', () => {
        expect(thousandKey('25')).toBe('250');
        expect(thousandKey('1.5')).toBe('15');
        expect(thousandKey('')).toBe('');
    });

    it('is an option of the sales screen, off by default', () => {
        expect(resolvePosControls({}).showCentimes).toBe(false);
        expect(resolvePosControls({ showCentimes: true }).showCentimes).toBe(true);
    });
});
