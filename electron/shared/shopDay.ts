// The shop's day: a hanout sells after midnight in Ramadan and in summer, so
// its day runs from 04:00 to 04:00. A sale at 00:30 belongs to the day that
// began the morning before, on the screens (local time) and in SQL.

/** Hour the shop's day starts (and the day before ends). */
export const SHOP_DAY_STARTS_AT = 4;

/** SQLite date modifier: `date(created_at, 'localtime', ${SHOP_DAY_SQL})` is the shop day. */
export const SHOP_DAY_SQL = `'-${SHOP_DAY_STARTS_AT} hours'`;

/** Start (04:00 local) of the shop day that contains this moment. */
export function shopDayStart(at: Date): Date {
    const shifted = new Date(at.getTime());
    shifted.setHours(shifted.getHours() - SHOP_DAY_STARTS_AT);
    return new Date(shifted.getFullYear(), shifted.getMonth(), shifted.getDate(), SHOP_DAY_STARTS_AT, 0, 0, 0);
}

/** Last millisecond of that shop day (03:59:59.999 the next morning). */
export function shopDayEnd(at: Date): Date {
    const start = shopDayStart(at);
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, SHOP_DAY_STARTS_AT, 0, 0, -1);
}
