import { useEffect, useState } from 'react';
import { Clock, CalendarDays, Moon, Sparkles, ShoppingBag, Plus, Trash2, TrendingUp } from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { MiniTabs, Spinner, Empty } from '../dashboard/parts';
import { useT } from '../../i18n';
import { formatDate, formatNumber } from '../../i18n/format';

const WEEKS = [4, 12, 26, 52];
const LOCALE = { ar: 'ar-DZ', fr: 'fr-DZ', en: 'en-GB' };
// 4 October 2026 is a Sunday: day 0 of the shop's week numbers
const dayName = (lang, day, style = 'long') => new Intl.DateTimeFormat(LOCALE[lang] || 'ar-DZ', { weekday: style }).format(new Date(2026, 9, 4 + day));
const hourText = (h) => `${String(h).padStart(2, '0')}:00`;

/**
 * What the shop's own sales teach: the busy hours and days (who should be in
 * the shop, when), the coming occasions of the Algerian year and, before
 * each one, what sold last time and what to buy now.
 */
export default function ShopIntelligence() {
    const { t, lang } = useT();
    const [weeks, setWeeks] = useState(12);
    const [rhythm, setRhythm] = useState(null);
    const [occasions, setOccasions] = useState(null);
    const [events, setEvents] = useState([]);
    const load = () => {
        window.electronAPI.insights.calendar().then(setOccasions).catch(() => setOccasions([]));
        window.electronAPI.insights.events().then(setEvents).catch(() => setEvents([]));
    };
    useEffect(() => {
        let alive = true;
        setRhythm(null);
        window.electronAPI.insights.rhythm({ weeks }).then(r => { if (alive) setRhythm(r); }).catch(() => { if (alive) setRhythm({ tickets: 0 }); });
        return () => { alive = false; };
    }, [weeks]);
    useEffect(load, []);

    return (
        <div className="space-y-4" data-testid="shop-intelligence">
            <section className="card space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="font-semibold flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-300" /> {t('smart.rhythmTitle')}</h2>
                        <p className="text-xs text-zinc-500">{t('smart.rhythmHint')}</p>
                    </div>
                    <MiniTabs value={String(weeks)} onChange={(v) => setWeeks(Number(v))} tabs={WEEKS.map(w => ({ id: String(w), label: t('smart.weeks', { n: w }) }))} />
                </div>
                {!rhythm ? <Spinner /> : !rhythm.tickets ? <Empty>{t('smart.noSales')}</Empty> : <Rhythm r={rhythm} t={t} lang={lang} />}
            </section>

            <section className="card space-y-4">
                <div>
                    <h2 className="font-semibold flex items-center gap-2"><CalendarDays className="w-4 h-4 text-indigo-300" /> {t('smart.occasionsTitle')}</h2>
                    <p className="text-xs text-zinc-500">{t('smart.occasionsHint')}</p>
                </div>
                {!occasions ? <Spinner /> : !occasions.length ? <Empty>{t('smart.noOccasion')}</Empty> : (
                    <div className="grid gap-3 xl:grid-cols-2">
                        {occasions.map(o => <Occasion key={`${o.id}-${o.date}`} o={o} t={t} lang={lang} />)}
                    </div>
                )}
            </section>

            <OwnEvents events={events} onChange={load} t={t} lang={lang} />
        </div>
    );
}

function Rhythm({ r, t, lang }) {
    const hours = r.byHour.filter(h => h.tickets > 0).map(h => h.hour);
    const from = Math.max(0, Math.min(...hours));
    const to = Math.min(23, Math.max(...hours));
    const span = Array.from({ length: to - from + 1 }, (_, i) => from + i);
    const max = Math.max(1, ...r.grid.flat().map(c => c.tickets));
    // The shop's week starts on Saturday (Algeria): Sat, Sun ... Fri
    const order = [6, 0, 1, 2, 3, 4, 5];
    const facts = [
        r.peak && { icon: TrendingUp, tone: 'text-emerald-300 bg-emerald-500/15', label: t('smart.peak'), value: `${hourText(r.peak.from)} – ${hourText(r.peak.to)}`, hint: t('smart.peakHint') },
        r.busiestDay && { icon: CalendarDays, tone: 'text-indigo-300 bg-indigo-500/15', label: t('smart.busiestDay'), value: dayName(lang, r.busiestDay.day), hint: t('smart.busiestDayHint') },
        r.quietHour && { icon: Moon, tone: 'text-amber-300 bg-amber-500/15', label: t('smart.quiet'), value: `${r.quietDay ? `${dayName(lang, r.quietDay.day)} · ` : ''}${hourText(r.quietHour.hour)}`, hint: t('smart.quietHint') },
    ].filter(Boolean);
    return (
        <div className="space-y-4">
            {!r.enough && <p className="text-xs text-amber-300">{t('smart.notEnough')}</p>}
            <div className="grid gap-3 md:grid-cols-3">
                {facts.map(f => (
                    <div key={f.label} className="rounded-xl border border-dark-border p-3 flex gap-3 items-start">
                        <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-none ${f.tone}`}><f.icon className="w-4 h-4" /></span>
                        <span className="min-w-0">
                            <span className="block text-xs text-zinc-500">{f.label}</span>
                            <span className="block font-semibold">{f.value}</span>
                            <span className="block text-xs text-zinc-500 mt-0.5">{f.hint}</span>
                        </span>
                    </div>
                ))}
            </div>
            <div className="overflow-x-auto" dir="ltr">
                <table className="text-[11px] border-separate" style={{ borderSpacing: 3 }} data-testid="smart-heatmap" aria-label={t('smart.rhythmTitle')}>
                    <thead><tr><th />{span.map(h => <th key={h} className="font-normal text-zinc-500 px-0.5">{h}</th>)}</tr></thead>
                    <tbody>
                        {order.map(d => (
                            <tr key={d}>
                                <th className="font-normal text-zinc-400 text-end pe-2 whitespace-nowrap">{dayName(lang, d, 'short')}</th>
                                {span.map(h => {
                                    const c = r.grid[d][h];
                                    const level = c.tickets / max;
                                    return <td key={h} title={`${dayName(lang, d)} ${hourText(h)} · ${t('smart.tickets', { n: c.tickets })}`}
                                        className="w-7 h-7 rounded" style={{ background: c.tickets ? `rgba(99,102,241,${0.15 + level * 0.85})` : 'rgba(127,127,127,.08)' }} />;
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="text-xs text-zinc-500">{t('smart.heatmapHint', { n: formatNumber(r.tickets), d: r.daysWorked })}</p>
        </div>
    );
}

function Occasion({ o, t, lang }) {
    const h = o.history;
    const name = o.kind === 'own' ? o.name : t(`smart.occ.${o.id}`);
    return (
        <article className={`rounded-xl border p-4 space-y-3 ${o.preparing ? 'border-amber-500/40 bg-amber-500/5' : 'border-dark-border'}`} data-testid={`smart-occasion-${o.id}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="font-semibold flex items-center gap-2">{o.kind === 'own' ? <Sparkles className="w-4 h-4 text-pink-300" /> : <CalendarDays className="w-4 h-4 text-indigo-300" />} {name}</h3>
                    <p className="text-xs text-zinc-500">{formatDate(o.date, lang, false)} · {o.days === 0 ? t('smart.today') : t('smart.inDays', { n: o.days })}</p>
                </div>
                {o.preparing
                    ? <span className="text-xs font-semibold text-amber-300 bg-amber-500/15 rounded-full px-2.5 py-1 whitespace-nowrap">{t('smart.prepareNow')}</span>
                    : <span className="text-xs text-zinc-500 whitespace-nowrap">{t('smart.prepareFrom', { date: formatDate(o.prepareFrom, lang, false) })}</span>}
            </div>
            {!h ? <p className="text-xs text-zinc-500">{t('smart.noHistory')}</p> : (
                <>
                    {h.change !== null && (
                        <p className="text-sm">
                            {t(h.change >= 0 ? 'smart.lastUp' : 'smart.lastDown', { n: Math.abs(h.change), days: o.before })}
                        </p>
                    )}
                    {h.toBuy.length ? (
                        <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5"><ShoppingBag className="w-3.5 h-3.5" /> {t('smart.toBuy')}</p>
                            <table className="w-full text-xs">
                                <thead className="text-zinc-500"><tr><th className="text-start font-normal py-1">{t('smart.article')}</th><th className="font-normal">{t('smart.soldLast')}</th><th className="font-normal">{t('smart.stockNow')}</th><th className="font-normal">{t('smart.buy')}</th></tr></thead>
                                <tbody>
                                    {h.toBuy.slice(0, 6).map(x => (
                                        <tr key={`${x.productId}-${x.variantId}`} className="border-t border-dark-border">
                                            <td className="py-1.5">{x.name}{(x.color || x.size) && <span className="text-zinc-500"> · {[x.color, x.size].filter(Boolean).join(' / ')}</span>}</td>
                                            <td className="text-center tabular-nums">{x.sold}</td>
                                            <td className="text-center tabular-nums">{Math.max(0, x.stock)}</td>
                                            <td className="text-center tabular-nums font-semibold text-emerald-300">{x.buy}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : <p className="text-xs text-emerald-300">{t('smart.stockReady')}</p>}
                </>
            )}
        </article>
    );
}

function OwnEvents({ events, onChange, t, lang }) {
    const [form, setForm] = useState({ name: '', date: '', daysBefore: 14, yearly: true });
    const add = async () => {
        const r = await window.electronAPI.insights.eventAdd(form);
        if (!r?.success) { toast.error(t(r?.error === 'EVENT_NAME_REQUIRED' ? 'smart.nameRequired' : 'smart.dateInvalid')); return; }
        setForm({ name: '', date: '', daysBefore: 14, yearly: true });
        toast.success(t('smart.eventSaved'));
        onChange();
    };
    const remove = async (id) => { await window.electronAPI.insights.eventDelete(id); onChange(); };
    return (
        <section className="card space-y-3" data-testid="smart-own-events">
            <div>
                <h2 className="font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-pink-300" /> {t('smart.ownTitle')}</h2>
                <p className="text-xs text-zinc-500">{t('smart.ownHint')}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto_auto] items-end">
                <label className="space-y-1"><span className="text-xs text-zinc-400">{t('smart.eventName')}</span>
                    <input className="input w-full" value={form.name} maxLength={60} placeholder={t('smart.eventNamePlaceholder')} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} data-testid="smart-event-name" /></label>
                <label className="space-y-1"><span className="text-xs text-zinc-400">{t('smart.eventDate')}</span>
                    <input type="date" className="input w-full" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} data-testid="smart-event-date" /></label>
                <label className="space-y-1"><span className="text-xs text-zinc-400">{t('smart.daysBefore')}</span>
                    <input type="number" min={1} max={60} className="input w-full" value={form.daysBefore} onChange={(e) => setForm(f => ({ ...f, daysBefore: e.target.value }))} /></label>
                <label className="h-11 inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.yearly} onChange={(e) => setForm(f => ({ ...f, yearly: e.target.checked }))} /> {t('smart.yearly')}</label>
                <Button onClick={add} data-testid="smart-event-add"><Plus className="w-4 h-4" /> {t('common.add')}</Button>
            </div>
            {events.length > 0 && (
                <ul className="divide-y divide-dark-border">
                    {events.map(e => (
                        <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
                            <span className="flex-1 min-w-0 truncate">{e.name}</span>
                            <span className="text-zinc-500 text-xs">{formatDate(e.date, lang, false)}{e.yearly ? ` · ${t('smart.yearly')}` : ''}</span>
                            <Button size="sm" variant="ghost" onClick={() => remove(e.id)} aria-label={t('common.delete')} title={t('common.delete')}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
