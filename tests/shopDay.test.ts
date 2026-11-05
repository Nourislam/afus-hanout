// In Ramadan and in summer a hanout sells after midnight: a sale at 00:30
// belongs to the shop's day that began the morning before. The shop day runs
// from 04:00 to 04:00, on the screens and in the reports.
import { describe, it, expect } from 'vitest';
import { shopDayStart, shopDayEnd, SHOP_DAY_SQL } from '../electron/shared/shopDay';
import { dashboardRanges, toDb } from '../src/lib/dashboard';
import { createShop } from './helpers/shop';


describe('the shop day', () => {
    it('00:30 is still the day before; 09:00 is today; it ends at 03:59:59', () => {
        expect(shopDayStart(new Date(2026, 10, 5, 0, 30))).toEqual(new Date(2026, 10, 4, 4, 0));
        expect(shopDayStart(new Date(2026, 10, 5, 9, 0))).toEqual(new Date(2026, 10, 5, 4, 0));
        expect(shopDayStart(new Date(2026, 10, 5, 4, 0))).toEqual(new Date(2026, 10, 5, 4, 0));
        expect(shopDayEnd(new Date(2026, 10, 5, 9, 0))).toEqual(new Date(2026, 10, 6, 3, 59, 59, 999));
    });

    it('the home screen\'s «today» at 00:30 is the evening\'s day', () => {
        const ranges = dashboardRanges(new Date(2026, 10, 5, 0, 30));
        expect(ranges.today).toBe('2026-11-04');
        expect(ranges.periods.today.current.startDate).toBe(toDb(new Date(2026, 10, 4, 4, 0)));
    });

    it('in the database: a sale at 00:30 is counted in the day before', async () => {
        const { api } = await createShop();
        const at = (d: Date) => api.get(`SELECT date(?, 'localtime', ${SHOP_DAY_SQL}) AS d`, [toDb(d)]).d;
        expect(at(new Date(2026, 10, 5, 0, 30))).toBe('2026-11-04');
        expect(at(new Date(2026, 10, 5, 4, 30))).toBe('2026-11-05');
    });
});
