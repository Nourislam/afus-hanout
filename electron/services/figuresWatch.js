/**
 * "Check the figures" on its own once a week (integrityService.js), on the
 * shop's own data only (never the demo shop). The last result is kept in the
 * settings (figures_watch); the owner sees a bar only when something does not
 * add up, until a new check (weekly or by hand) finds everything right.
 */
const integrity = require('./integrityService');

const KEY = 'figures_watch';
const WEEK = 7 * 86400000;

/** What is kept: when, right or not, and which checks found what. */
function summarize(report, at = new Date()) {
    const failed = report.checks.filter(c => !c.ok).map(c => ({ id: c.id, count: c.count }));
    return { at: at.toISOString(), ok: report.ok, failed };
}

/** A week (or more) since the last check, or never checked. */
function due(last, now = Date.now()) {
    const at = last?.at ? new Date(last.at).getTime() : NaN;
    return !Number.isFinite(at) || now - at >= WEEK || at > now + 86400000; // a clock set back: check again
}

/** Run it when due; returns the result kept (or the last one). */
function runIfDue(api, { getSetting, saveSetting, now = Date.now() }) {
    const last = getSetting(KEY);
    if (!due(last, now)) return last;
    const result = summarize(integrity.check(api), new Date(now));
    saveSetting(KEY, result);
    return result;
}

/** Keep the result of a check made by hand (Settings › Backup). */
function remember(report, { saveSetting, now = Date.now() }) {
    const result = summarize(report, new Date(now));
    saveSetting(KEY, result);
    return result;
}

module.exports = { KEY, WEEK, summarize, due, runIfDue, remember };
