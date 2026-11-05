// The periods of the Reports page, on the shop's day (04:00 to 04:00): a sale
// at 00:30 belongs to the evening before, in every period. The week starts on
// Saturday, as Algerian shops count it (same as the home screen).
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subMonths } from 'date-fns';
import { shopDayStart, shopDayEnd, SHOP_DAY_STARTS_AT } from '../../electron/shared/shopDay.ts';
import { toDb } from './dashboard';

/** 04:00 of that date (the start of its shop day). */
const at4 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), SHOP_DAY_STARTS_AT);
/** The last moment of the shop day of that date. */
const endOf = (d) => shopDayEnd(at4(d));
const range = (from, to) => ({ startDate: toDb(from), endDate: toDb(to) });

/** { startDate, endDate } of a period of the Reports page, as stored times (UTC). */
export function reportRange(kind, now = new Date()) {
    const today = shopDayStart(now);
    switch (kind) {
        case 'today': return range(today, endOf(today));
        case 'yesterday': return range(at4(subDays(today, 1)), endOf(subDays(today, 1)));
        case 'week': return range(at4(startOfWeek(today, { weekStartsOn: 6 })), endOf(endOfWeek(today, { weekStartsOn: 6 })));
        case 'last7': return range(at4(subDays(today, 7)), endOf(today));
        case 'last30': return range(at4(subDays(today, 30)), endOf(today));
        case 'last3months': return range(at4(startOfMonth(subMonths(today, 2))), endOf(today));
        case 'month':
        default: return range(at4(startOfMonth(today)), endOf(endOfMonth(today)));
    }
}
