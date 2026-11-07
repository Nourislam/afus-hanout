/**
 * The Hijri calendar for the shop's seasons (Ramadan, the two Eids), from the
 * system's own calendar (ICU, Umm al-Qura). Algeria fixes the month by the
 * moon, a day apart at most: enough to prepare three weeks before.
 * Used by the main process (seasonService) and the screens.
 */

export interface HijriDate { year: number; month: number; day: number }
export interface Season { id: SeasonId; start: Date; end: Date }
export type SeasonId = 'ramadan' | 'eidFitr' | 'eidAdha' | 'rentree';

const FORMAT = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
const DAY = 86400000;
/** Days before a season when its preparation list is shown. */
export const PREPARE_DAYS = 21;

const utcNoon = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12));
const local = (d: Date) => new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/** The Hijri date of a day (its local calendar day). */
export function hijriOf(date: Date): HijriDate {
    const parts = FORMAT.formatToParts(utcNoon(date));
    const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
    return { year: get('year'), month: get('month'), day: get('day') };
}

/** The local day (midnight) of a Hijri date. */
export function gregorianOf(year: number, month: number, day: number): Date {
    // About 354.367 days a Hijri year from 16 July 622; then find the exact day near it
    const guess = Date.UTC(622, 6, 16, 12) + ((year - 1) * 354.367 + (month - 1) * 29.53 + (day - 1)) * DAY;
    for (let k = 0; k <= 40; k++) {
        for (const sign of k ? [1, -1] : [1]) {
            const d = new Date(guess + sign * k * DAY);
            const h = hijriOf(local(d));
            if (h.year === year && h.month === month && h.day === day) return local(d);
        }
    }
    throw new Error(`No day for ${year}-${month}-${day} AH`);
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/**
 * A season of a Hijri year (or of a Gregorian year for the school start):
 *   ramadan  1 → 29 Ramadan
 *   eidFitr  the last week of Ramadan (cakes, new clothes for the house) → 3 Shawwal
 *   eidAdha  1 → 13 Dhu al-Hijja
 *   rentree  1 → 25 September
 */
export function seasonOf(id: SeasonId, year: number): Season {
    if (id === 'rentree') return { id, start: new Date(year, 8, 1), end: new Date(year, 8, 25) };
    if (id === 'ramadan') return { id, start: gregorianOf(year, 9, 1), end: addDays(gregorianOf(year, 10, 1), -1) };
    if (id === 'eidFitr') return { id, start: addDays(gregorianOf(year, 10, 1), -8), end: gregorianOf(year, 10, 3) };
    return { id, start: gregorianOf(year, 12, 1), end: gregorianOf(year, 12, 13) };
}

const IDS: SeasonId[] = ['ramadan', 'eidFitr', 'eidAdha', 'rentree'];

/** The same season one year before (the Hijri year for the Hijri seasons). */
export function lastYear(season: Season): Season {
    if (season.id === 'rentree') return seasonOf('rentree', season.start.getFullYear() - 1);
    return seasonOf(season.id, hijriOf(season.start).year - 1);
}

/**
 * The seasons to prepare now: running, or starting within PREPARE_DAYS,
 * the nearest first, with the days until they start (0 when running).
 */
export function seasonsAhead(now: Date = new Date()): (Season & { daysLeft: number })[] {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const hy = hijriOf(today).year;
    const candidates: Season[] = [];
    for (const id of IDS) {
        if (id === 'rentree') candidates.push(seasonOf(id, today.getFullYear()));
        else for (const y of [hy, hy + 1]) candidates.push(seasonOf(id, y));
    }
    return candidates
        .filter(s => s.end >= today && (s.start.getTime() - today.getTime()) / DAY <= PREPARE_DAYS)
        .map(s => ({ ...s, daysLeft: Math.max(0, Math.round((s.start.getTime() - today.getTime()) / DAY)) }))
        .sort((a, b) => a.start.getTime() - b.start.getTime());
}
