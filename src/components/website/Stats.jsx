// Website orders page: visits and figures.
import { useEffect, useState } from 'react';
import { Globe, ShoppingBag, BarChart3 } from 'lucide-react';
import { Tabs } from '../ui/Tabs';
import { StatTile } from '../ui/StatTile';
import { formatDate, formatNumber } from '../../i18n/format';
import { useT } from '../../i18n';

/** Visits of the website and its orders, day by day and by article (the counts sent by the website). */
export function WebsiteStats() {
    const { t } = useT();
    const [days, setDays] = useState(7);
    const [data, setData] = useState(null);
    useEffect(() => { window.electronAPI.website.stats({ days }).then(setData).catch(() => setData(null)); }, [days]);
    const max = Math.max(1, ...(data?.perDay || []).map(d => d.views));
    return (
        <section className="card space-y-3 xl:col-span-3" data-testid="website-stats">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold flex items-center gap-2"><BarChart3 className="w-4 h-4 text-indigo-300" /> {t('website.stats.title')}</h2>
                <Tabs tabs={[7, 14, 30].map(n => ({ id: String(n), label: t('website.stats.days', { n }) }))} value={String(days)} onChange={(v) => setDays(Number(v))} testId="website-stats-days" />
            </div>
            <p className="text-xs text-zinc-500">{t('website.stats.hint')}</p>
            {data && (
                <>
                    <div className="grid fit-grid-sm gap-3">
                        <StatTile icon={Globe} label={t('website.stats.views')} value={formatNumber(data.totalViews)} />
                        <StatTile icon={ShoppingBag} label={t('website.stats.orders')} value={formatNumber(data.totalOrders)} iconTone="bg-emerald-500/15 text-emerald-300" />
                        <StatTile icon={BarChart3} label={t('website.stats.rate')} value={data.rate === null ? '—' : `${data.rate}%`} iconTone="bg-amber-500/15 text-amber-300" />
                    </div>
                    <div className="flex items-end gap-1 h-28" aria-label={t('website.stats.views')}>
                        {data.perDay.map(d => (
                            <div key={d.day} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0" title={`${d.day}: ${d.views} / ${d.orders}`}>
                                <div className="w-full rounded-t bg-indigo-500/60" style={{ height: `${Math.max(2, (d.views / max) * 96)}px` }} />
                                <span className="text-[10px] text-zinc-500">{d.day.slice(8)}</span>
                            </div>
                        ))}
                    </div>
                    {data.products.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm" data-testid="website-stats-products">
                                <thead className="text-zinc-500 text-xs"><tr>{['article', 'views', 'orders', 'rate'].map(k => <th key={k} className="text-start font-medium py-1.5 px-2">{t(`website.stats.col.${k}`)}</th>)}</tr></thead>
                                <tbody>
                                    {data.products.map(p => (
                                        <tr key={p.id} className="border-t border-dark-border">
                                            <td className="py-1.5 px-2"><bdi>{p.name}</bdi></td>
                                            <td className="py-1.5 px-2">{formatNumber(p.views)}</td>
                                            <td className="py-1.5 px-2">{formatNumber(p.orders)}</td>
                                            <td className={`py-1.5 px-2 ${p.views >= 20 && !p.orders ? 'text-amber-300' : ''}`}>{p.rate === null ? '—' : `${p.rate}%`}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {data.viewsAt && <p className="text-xs text-zinc-500">{t('website.stats.at', { when: formatDate(data.viewsAt, 'datetime') })}</p>}
                </>
            )}
        </section>
    );
}
