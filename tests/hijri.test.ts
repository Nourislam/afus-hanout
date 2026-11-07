// The Hijri calendar of the shop's seasons: Ramadan moves about 11 days a
// year, so the program compares Ramadan with Ramadan, not March with March.
import { describe, it, expect } from 'vitest';
import { hijriOf, gregorianOf, seasonOf, lastYear, seasonsAhead } from '../electron/shared/hijri.ts';

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('the Hijri calendar', () => {
    it('reads the Hijri date of a day', () => {
        expect(hijriOf(new Date(2026, 1, 18))).toEqual({ year: 1447, month: 9, day: 1 });
        expect(hijriOf(new Date(2026, 4, 27))).toEqual({ year: 1447, month: 12, day: 10 });
    });

    it('finds the day of a Hijri date, both ways', () => {
        expect(ymd(gregorianOf(1447, 9, 1))).toBe('2026-02-18');
        expect(ymd(gregorianOf(1448, 9, 1))).toBe('2027-02-08');
        for (const [y, m, d] of [[1446, 9, 1], [1447, 10, 1], [1450, 12, 10], [1460, 1, 1]]) {
            expect(hijriOf(gregorianOf(y, m, d))).toEqual({ year: y, month: m, day: d });
        }
    });
});

describe('the seasons', () => {
    it('Ramadan, the two Eids and the school start', () => {
        const r = seasonOf('ramadan', 1448);
        expect([ymd(r.start), ymd(r.end)]).toEqual(['2027-02-08', ymd(new Date(gregorianOf(1448, 10, 1).getTime() - 86400000))]);
        const fitr = seasonOf('eidFitr', 1448);
        expect(ymd(fitr.end)).toBe(ymd(gregorianOf(1448, 10, 3)));
        expect(fitr.start < gregorianOf(1448, 10, 1)).toBe(true);
        expect(ymd(seasonOf('eidAdha', 1447).start)).toBe(ymd(gregorianOf(1447, 12, 1)));
        expect(ymd(seasonOf('rentree', 2027).start)).toBe('2027-09-01');
    });

    it('last year\'s same season: Ramadan by the Hijri year (11 days earlier), the school start by the year', () => {
        const last = lastYear(seasonOf('ramadan', 1448));
        expect(ymd(last.start)).toBe('2026-02-18');
        expect(ymd(lastYear(seasonOf('rentree', 2027)).start)).toBe('2026-09-01');
    });

    it('three weeks before Ramadan it is shown, with the days left; not two months before', () => {
        const ahead = seasonsAhead(new Date(2027, 0, 20));
        expect(ahead.map(s => s.id)).toEqual(['ramadan']);
        expect(ahead[0].daysLeft).toBe(19);
        expect(seasonsAhead(new Date(2026, 11, 1)).map(s => s.id)).toEqual([]);
        // During Ramadan: still shown (0 days), and the Eid preparation comes with it
        const during = seasonsAhead(new Date(2027, 1, 20));
        expect(during[0]).toMatchObject({ id: 'ramadan', daysLeft: 0 });
        expect(during.map(s => s.id)).toContain('eidFitr');
        // August: the school start
        expect(seasonsAhead(new Date(2027, 7, 15)).map(s => s.id)).toContain('rentree');
    });
});
