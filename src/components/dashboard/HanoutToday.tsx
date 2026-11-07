// The grocery's smart cards on the home screen: at most three a day, the most
// useful first, one button each, and «ليس اليوم» puts a card aside until
// tomorrow. Never during a sale (the home screen only). Candidates, in order:
// what looks odd (the owner), who comes by today, the season to prepare, the
// zakat day (the owner), what to sell before it goes off, the scale behind.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Clock, Scale, MoonStar, Landmark, AlertTriangle, X } from 'lucide-react';
import { useT } from '../../i18n';
import { formatMoney } from '../../i18n/format';
import { weightLabel } from '../../lib/units';
import { pickCards, hiddenToday, hideToday } from '../../lib/smartCards';
import { useAuthStore } from '../../stores/authStore';
import { hijriOf } from '../../../electron/shared/hijri.ts';
import { daysToZakatDay } from '../../../electron/shared/zakat.ts';

interface Visit { supplier_id: string; name: string; lines: number }
interface Soon { product_id: string; name: string; left: number; days_left: number; unit: string }
interface Oddity { kind: 'cash' | 'belowCost' | 'refunds'; employee?: string; difference?: number; name?: string; lines?: number; lost?: number; count?: number }
interface Card { id: string; icon: typeof Truck; tone: string; title: string; lines: ReactNode[]; action?: { label: string; to: string } }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bridge = (): any => (window as any).electronAPI;

export default function HanoutToday({ canOrder }: { canOrder: boolean }) {
    const { t } = useT();
    const navigate = useNavigate();
    const isOwner = useAuthStore(state => state.currentEmployee?.role === 'admin');
    const [visits, setVisits] = useState<Visit[]>([]);
    const [soon, setSoon] = useState<Soon[]>([]);
    const [scaleChanges, setScaleChanges] = useState(0);
    const [season, setSeason] = useState<{ id: string; daysLeft: number } | null>(null);
    const [odd, setOdd] = useState<Oddity[]>([]);
    const [zakatIn, setZakatIn] = useState<number | null>(null);
    const [hidden, setHidden] = useState<string[]>(() => hiddenToday());

    useEffect(() => {
        let cancelled = false;
        const api = bridge();
        if (!api?.hanout) return undefined;
        const set = <T,>(fn: (v: T) => void) => (v: T) => { if (!cancelled) fn(v); };
        if (canOrder) {
            api.hanout.visitsToday().then(set((v: Visit[]) => setVisits(v.filter(x => x.lines > 0)))).catch(() => {});
            api.smart?.upcomingSeasons().then(set((list: { id: string; daysLeft: number }[]) => setSeason(list[0] || null))).catch(() => {});
        }
        api.hanout.sellSoon(3).then(set(setSoon)).catch(() => {});
        // Only once the shop keeps its scale from the program (it said so once)
        api.scale?.plu().then(set((l: { sentAt: string | null; changed: number }) => setScaleChanges(l.sentAt ? l.changed : 0))).catch(() => {});
        if (isOwner) {
            api.smart?.oddities().then(set(setOdd)).catch(() => {});
            api.settings.get('zakat').then(set((z: { month?: number; day?: number } | null) => {
                if (z?.month && z?.day) setZakatIn(daysToZakatDay(hijriOf(new Date()), { month: z.month, day: z.day }));
            })).catch(() => {});
        }
        return () => { cancelled = true; };
    }, [canOrder, isOwner]);

    const oddLine = (o: Oddity) => {
        if (o.kind === 'cash') return t((o.difference || 0) < 0 ? 'home.oddCashShort' : 'home.oddCashOver', { name: o.employee || '', amount: formatMoney(Math.abs(o.difference || 0)) });
        if (o.kind === 'belowCost') return t('home.oddBelowCost', { name: o.name || '', n: o.lines || 0, amount: formatMoney(o.lost || 0) });
        return t('home.oddRefunds', { name: o.employee || '', n: o.count || 0, amount: formatMoney((o as { total?: number }).total || 0) });
    };

    const cards = useMemo(() => {
        const all: Card[] = [];
        if (odd.length) all.push({ id: 'odd', icon: AlertTriangle, tone: 'text-red-300', title: t('home.oddTitle'), lines: odd.slice(0, 3).map(oddLine) });
        if (visits.length) all.push({ id: 'visits', icon: Truck, tone: 'text-indigo-300', title: t('home.visitsTitle'), lines: visits.map(v => t('home.visitLine', { name: v.name, n: v.lines })), action: { label: t('home.seeOrder'), to: '/distributors' } });
        if (season) all.push({ id: `season-${season.id}`, icon: MoonStar, tone: 'text-amber-300', title: season.daysLeft > 0 ? t('home.seasonIn', { season: t(`season.${season.id}`), n: season.daysLeft }) : t('home.seasonNow', { season: t(`season.${season.id}`) }), lines: [t('home.seasonLine')], action: { label: t('home.seasonOpen'), to: '/seasons' } });
        if (zakatIn !== null && zakatIn <= 7) all.push({ id: 'zakat', icon: Landmark, tone: 'text-emerald-300', title: t('home.zakatTitle'), lines: [zakatIn === 0 ? t('home.zakatToday') : t('home.zakatIn', { n: zakatIn })], action: { label: t('home.zakatOpen'), to: '/zakat' } });
        if (soon.length) all.push({ id: 'soon', icon: Clock, tone: 'text-amber-300', title: t('home.sellSoonTitle'), lines: soon.slice(0, 4).map(s => <span key={`${s.product_id}-${s.days_left}`} className={s.days_left < 0 ? 'text-red-300' : ''}>{t(s.days_left < 0 ? 'home.expired' : 'home.sellSoonLine', { name: s.name, n: s.unit === 'kg' ? weightLabel(s.left) : s.left, days: Math.abs(s.days_left) })}</span>) });
        if (scaleChanges > 0) all.push({ id: 'scale', icon: Scale, tone: 'text-amber-300', title: t('home.scaleTitle'), lines: [t('home.scaleLine', { n: scaleChanges })], action: { label: t('home.scaleOpen'), to: '/settings?tab=scale' } });
        return pickCards(all, hidden);
    }, [odd, visits, season, zakatIn, soon, scaleChanges, hidden, t]);

    if (!cards.length) return null;
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" data-testid="hanout-today">
            {cards.map(card => {
                const Icon = card.icon;
                return (
                    <div key={card.id} className="card flex gap-3 items-start relative" data-testid={`card-${card.id.split('-')[0]}`}>
                        <Icon className={`w-6 h-6 flex-none ${card.tone}`} />
                        <div className="flex-1 min-w-0 space-y-1">
                            <div className="font-semibold pe-6">{card.title}</div>
                            {card.lines.map((line, i) => <div key={i} className="text-sm text-zinc-300">{line}</div>)}
                            {card.action && (
                                <button type="button" onClick={() => navigate(card.action!.to)} className="text-sm text-indigo-300 hover:text-indigo-200 pt-1">{card.action.label}</button>
                            )}
                        </div>
                        <button type="button" onClick={() => setHidden(hideToday(card.id))} title={t('home.notToday')} aria-label={t('home.notToday')}
                            className="absolute top-2 end-2 p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-white/5">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
