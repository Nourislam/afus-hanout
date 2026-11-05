// Every period of the reports and of the home screen's charts follows the
// shop's day (04:00 to 04:00), not midnight.
import { describe, it, expect } from 'vitest';
import { reportRange } from '../src/lib/reportRanges';
import { chartBuckets, toDb } from '../src/lib/dashboard';

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m, d, h, min);

describe('report periods', () => {
    const now = at(2026, 10, 5, 15);
    it('today, yesterday, the month and the last 30 days start and end at 04:00', () => {
        expect(reportRange('today', now)).toEqual({ startDate: toDb(at(2026, 10, 5, 4)), endDate: toDb(new Date(2026, 10, 6, 3, 59, 59, 999)) });
        expect(reportRange('yesterday', now).startDate).toBe(toDb(at(2026, 10, 4, 4)));
        expect(reportRange('month', now)).toEqual({ startDate: toDb(at(2026, 10, 1, 4)), endDate: toDb(new Date(2026, 11, 1, 3, 59, 59, 999)) });
        expect(reportRange('last30', now).startDate).toBe(toDb(at(2026, 9, 6, 4)));
        expect(reportRange('last3months', now).startDate).toBe(toDb(at(2026, 8, 1, 4)));
    });

    it('at 00:30 «today» is still the day of the evening', () => {
        expect(reportRange('today', at(2026, 10, 6, 0, 30)).startDate).toBe(toDb(at(2026, 10, 5, 4)));
    });
});

describe('chart buckets', () => {
    it('the week from Saturday 04:00 has its Saturday, up to today', () => {
        const period = { startDate: toDb(at(2026, 9, 31, 4)), endDate: toDb(at(2026, 10, 5, 15)) };
        const keys = chartBuckets([], period, 'day', at(2026, 10, 5, 15)).map(b => b.key);
        expect(keys).toEqual(['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
    });

    it('the hours of a shop day run from the morning past midnight: at 00:30 the hours of the evening are there', () => {
        const rows = [{ bucket: '10', total: 500, count: 1 }, { bucket: '23', total: 300, count: 1 }, { bucket: '00', total: 100, count: 1 }];
        const keys = chartBuckets(rows, null, 'hour', at(2026, 10, 6, 0, 30)).map(b => b.key);
        expect(keys[0]).toBe('09');
        expect(keys.slice(-3)).toEqual(['22', '23', '00']);
        expect(keys).toContain('10');
    });
});
