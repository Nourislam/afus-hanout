// Settings › Backups: "Check the figures" (the owner's). Every amount and
// quantity computed again from its lines (electron/services/integrityService.js).
import { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { useT } from '../../i18n';
import { formatMoney, formatDate } from '../../i18n/format';
import { translateError } from '../../i18n/errors';

const MONEY_CHECKS = new Set(['sale_lines', 'sale_subtotal', 'sale_total', 'sale_paid', 'kridi_paid', 'customer_debt', 'purchase_orders', 'stock_value']);

function Sample({ id, row }) {
    const { t } = useT();
    const value = (v) => (MONEY_CHECKS.has(id) ? formatMoney(v) : v);
    const what = [row.ticket, row.name, [row.color, row.size].filter(Boolean).join(' / ')].filter(Boolean).join(' · ');
    return (
        <li className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
            <span className="min-w-0 truncate">{what || '—'}</span>
            <span className="text-xs text-zinc-400 flex gap-3">
                {row.saved !== undefined && <span>{t('figures.saved')}: <bdi className="tabular text-rose-300">{value(row.saved)}</bdi></span>}
                {row.expected !== undefined && <span>{t('figures.expected')}: <bdi className="tabular text-emerald-300">{value(row.expected)}</bdi></span>}
            </span>
        </li>
    );
}

export function FiguresCheck() {
    const { t } = useT();
    const [report, setReport] = useState(null);
    const [at, setAt] = useState(null);
    const [running, setRunning] = useState(false);
    // The last automatic check (once a week, on its own)
    const [weekly, setWeekly] = useState(null);
    useEffect(() => { window.electronAPI?.figures?.last?.().then(setWeekly).catch(() => setWeekly(null)); }, []);
    const run = async () => {
        setRunning(true);
        try {
            setReport(await window.electronAPI.figures.check());
            setAt(new Date());
            window.dispatchEvent(new Event('afus:figures-checked'));
        } catch (error) {
            toast.error(translateError(error));
        } finally {
            setRunning(false);
        }
    };
    const wrong = (report?.checks || []).filter(c => !c.ok);
    return (
        <Card className="space-y-4" data-testid="figures-check">
            <div className="flex flex-wrap items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center flex-none"><ShieldCheck className="w-5 h-5" /></div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{t('figures.title')}</h3>
                    <p className="text-sm text-zinc-500">{t('figures.text')}</p>
                </div>
                <Button onClick={run} loading={running} data-testid="figures-run">{t('figures.run')}</Button>
            </div>
            {!report && weekly && (
                <p className={`text-sm ${weekly.ok ? 'text-zinc-400' : 'text-amber-300'}`} data-testid="figures-weekly">
                    {t(weekly.ok ? 'figures.weeklyOk' : 'figures.weeklyBad', { date: formatDate(weekly.at), n: weekly.failed?.length || 0 })}
                </p>
            )}
            {report && (
                <div className="space-y-3">
                    <p className={`flex items-center gap-2 font-semibold ${report.ok ? 'text-emerald-300' : 'text-amber-300'}`} data-testid="figures-result">
                        {report.ok ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                        {report.ok ? t('figures.allGood') : t('figures.problems', { n: wrong.length })}
                        {at && <span className="text-xs font-normal text-zinc-500">· {t('figures.checkedAt', { time: formatDate(at, 'time') })}</span>}
                    </p>
                    <ul className="grid gap-1.5 sm:grid-cols-2">
                        {report.checks.map(c => (
                            <li key={c.id} className="flex items-start gap-2 text-sm" data-testid={`figures-${c.id}`}>
                                {c.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-none text-emerald-400" /> : <AlertTriangle className="w-4 h-4 mt-0.5 flex-none text-amber-400" />}
                                <span className={c.ok ? 'text-zinc-300' : 'text-amber-200'}>{t(`figures.check.${c.id}`)}{!c.ok && c.count > 0 ? ` (${c.count})` : ''}</span>
                            </li>
                        ))}
                    </ul>
                    {wrong.map(c => (
                        <div key={c.id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                            <p className="text-sm font-medium text-amber-200">{t(`figures.check.${c.id}`)}</p>
                            {c.error ? <p className="text-xs text-zinc-400 mt-1">{t('figures.error')}</p> : (
                                <ul className="divide-y divide-dark-border mt-1">
                                    {c.samples.slice(0, 5).map((row, i) => <Sample key={i} id={c.id} row={row} />)}
                                </ul>
                            )}
                            {c.count > 5 && <p className="text-xs text-zinc-500 mt-1">{t('figures.more', { n: c.count - 5 })}</p>}
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}

export default FiguresCheck;
