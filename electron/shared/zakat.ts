/**
 * The zakat estimate (حاسبة الزكاة التقديرية): the program gathers the
 * shop's figures and shows 2.5 % of what the merchant chose to count. How the
 * goods are valued, the nisab and which debts are counted are the merchant's
 * decision with the one he asks for a ruling; the screen says so. Its wording
 * is to be reviewed by a specialist before it is released (study, phase 8).
 */

export const ZAKAT_RATE = 0.025;

export interface ZakatInput {
    /** The goods' value as the merchant chose to count them (purchase or sale price). */
    goods: number;
    /** Cash in the drawers, at home and in the bank, as typed. */
    cash: number;
    /** What customers owe (the karni) that he counts. */
    receivables: number;
    /** What the shop owes its suppliers. */
    payables: number;
    /** The nisab in dinars, as he was told (0 = not given). */
    nisab: number;
}

export interface ZakatEstimate { base: number; reached: boolean | null; due: number }

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100 + 0;

export function zakatEstimate(input: ZakatInput): ZakatEstimate {
    const base = Math.max(0, r2((input.goods || 0) + (input.cash || 0) + (input.receivables || 0) - (input.payables || 0)));
    const reached = input.nisab > 0 ? base >= input.nisab : null;
    return { base, reached, due: reached === false ? 0 : r2(base * ZAKAT_RATE) };
}

/** Days from today to the merchant's zakat day (Hijri month and day) in the current Hijri year or the next. */
export function daysToZakatDay(todayHijri: { year: number; month: number; day: number }, chosen: { month: number; day: number }): number {
    // Hijri months alternate 30 and 29 days: close enough for a reminder a week before
    const dayOfYear = (m: number, d: number) => (m - 1) * 29.5 + d;
    const diff = dayOfYear(chosen.month, chosen.day) - dayOfYear(todayHijri.month, todayHijri.day);
    return Math.round(diff >= 0 ? diff : diff + 354);
}
