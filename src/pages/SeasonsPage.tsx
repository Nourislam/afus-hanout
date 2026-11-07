// Preparing the seasons (التحضير للمواسم): Ramadan, the two Eids and the school
// start, by the Hijri calendar. What the shop sold in the same season last
// year, minus its stock, in cartons or kg; or, with no year behind it, the
// general list of what groceries sell more of then (seasonService.js).
import { useEffect, useState } from 'react';
import { MoonStar, Moon, Sparkles, Beef, BookOpen } from 'lucide-react';
import { useT } from '../i18n';
import { formatDate } from '../i18n/format';
import { translateError } from '../i18n/errors';
import { toast } from '../components/ui/Toast';
import { weightLabel } from '../lib/units';

type SeasonId = 'ramadan' | 'eidFitr' | 'eidAdha' | 'rentree';
interface PrepLine { product_id: string; name: string; unit: 'kg' | 'piece'; sold: number; stock: number; quantity: number; cartons?: number; carton_qty?: number; uplift: number | null }
interface General { label: { ar: string; fr: string; en: string }; articles: { id: string; name: string; unit: 'kg' | 'piece'; stock: number }[] }
interface Prep {
    season: { id: SeasonId; start: string; end: string; daysLeft: number };
    last: { start: string; end: string };
    source: 'lastYear' | 'general';
    compared: boolean;
    lines: PrepLine[];
    general: General[];
}
interface SmartBridge { upcomingSeasons(): Promise<{ id: SeasonId; daysLeft: number }[]>; seasonPrep(id: SeasonId): Promise<Prep> }
const smart = (): SmartBridge => (window as unknown as { electronAPI: { smart: SmartBridge } }).electronAPI.smart;

const SEASONS: { id: SeasonId; icon: typeof Moon }[] = [
    { id: 'ramadan', icon: MoonStar },
    { id: 'eidFitr', icon: Sparkles },
    { id: 'eidAdha', icon: Beef },
    { id: 'rentree', icon: BookOpen },
];

export default function SeasonsPage() {
    const { t, lang } = useT();
    const [id, setId] = useState<SeasonId | null>(null);
    const [prep, setPrep] = useState<Prep | null>(null);

    // The season coming first is opened (Ramadan when none is near)
    useEffect(() => {
        smart().upcomingSeasons().then(list => setId(list[0]?.id || 'ramadan')).catch(() => setId('ramadan'));
    }, []);
    useEffect(() => {
        if (!id) return undefined;
        let cancelled = false;
        smart().seasonPrep(id).then(p => { if (!cancelled) setPrep(p); }).catch(error => toast.error(translateError(error)));
        return () => { cancelled = true; };
    }, [id]);

    const qty = (n: number, unit: string) => (unit === 'kg' ? weightLabel(n) : String(n));
    const date = (d: string) => formatDate(`${d}T12:00:00`);

    return (
        <div className="page">
            <div className="page-header px-6 py-4 flex items-center gap-3">
                <MoonStar className="w-6 h-6 text-indigo-300" />
                <div>
                    <h1 className="text-xl font-bold">{t('seasons.title')}</h1>
                    <p className="text-sm text-zinc-500">{t('seasons.subtitle')}</p>
                </div>
            </div>
            <div className="page-body space-y-4">
                <div className="flex flex-wrap gap-2" role="tablist">
                    {SEASONS.map(({ id: s, icon: Icon }) => (
                        <button key={s} type="button" role="tab" aria-selected={id === s} onClick={() => setId(s)} data-testid={`season-${s}`}
                            className={`btn h-11 px-4 ${id === s ? 'btn-primary' : 'btn-secondary'}`}>
                            <Icon className="w-5 h-5" /> {t(`season.${s}`)}
                        </button>
                    ))}
                </div>

                {prep && (
                    <div className="card space-y-4" data-testid="season-prep">
                        <div>
                            <h2 className="text-lg font-semibold">
                                {prep.season.daysLeft > 0 ? t('seasons.startsIn', { season: t(`season.${prep.season.id}`), n: prep.season.daysLeft, date: date(prep.season.start) })
                                    : t('seasons.running', { season: t(`season.${prep.season.id}`), date: date(prep.season.end) })}
                            </h2>
                            <p className="text-sm text-zinc-400">
                                {prep.source === 'lastYear' ? t('seasons.fromLastYear', { from: date(prep.last.start), to: date(prep.last.end) }) : t('seasons.general')}
                            </p>
                        </div>

                        {prep.source === 'lastYear' && (prep.lines.length === 0 ? (
                            <p className="text-emerald-300 text-sm">{t('seasons.enough')}</p>
                        ) : (
                            <div className="rounded-xl border border-dark-border overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-white/5 text-zinc-400">
                                        <tr>
                                            <th className="px-3 py-2 text-start">{t('seasons.col.article')}</th>
                                            <th className="px-3 py-2 text-start">{t('seasons.col.soldLast')}</th>
                                            <th className="px-3 py-2 text-start">{t('seasons.col.more')}</th>
                                            <th className="px-3 py-2 text-start">{t('seasons.col.stock')}</th>
                                            <th className="px-3 py-2 text-start">{t('seasons.col.buy')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-dark-border">
                                        {prep.lines.map(l => (
                                            <tr key={l.product_id}>
                                                <td className="px-3 py-2 text-white">{l.name}</td>
                                                <td className="px-3 py-2 tabular">{qty(l.sold, l.unit)}</td>
                                                <td className="px-3 py-2 tabular text-zinc-400">{l.uplift ? `×${l.uplift}` : prep.compared ? t('seasons.onlySeason') : '—'}</td>
                                                <td className="px-3 py-2 tabular">{qty(l.stock, l.unit)}</td>
                                                <td className="px-3 py-2 tabular font-semibold text-amber-300">
                                                    {l.cartons ? t('seasons.cartons', { n: l.cartons, qty: l.carton_qty ?? 0 }) : qty(l.quantity, l.unit)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}

                        {prep.source === 'general' && (
                            <ul className="divide-y divide-dark-border rounded-xl border border-dark-border">
                                {prep.general.map(g => (
                                    <li key={g.label.fr} className="px-3 py-2 flex flex-wrap items-baseline justify-between gap-2">
                                        <span className="font-medium text-white">{g.label[lang as 'ar' | 'fr' | 'en'] || g.label.ar}</span>
                                        <span className="text-sm text-zinc-400">
                                            {g.articles.length
                                                ? g.articles.slice(0, 4).map(a => `${a.name} (${qty(a.stock, a.unit)})`).join(lang === 'ar' ? '، ' : ', ')
                                                : t('seasons.notSold')}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p className="text-xs text-zinc-500">{t('seasons.hint')}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
