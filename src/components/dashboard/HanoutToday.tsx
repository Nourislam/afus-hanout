// The grocery's morning: who comes by today (with what is missing for his
// order), what to sell before it goes off, and scale prices the scale does
// not have yet. At most these three cards, never during a sale (the home
// screen only).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Clock, Scale } from 'lucide-react';
import { t } from '../../i18n';
import { weightLabel } from '../../lib/units';

interface Visit { supplier_id: string; name: string; lines: number }
interface Soon { product_id: string; name: string; left: number; days_left: number; unit: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hanout = (): any => (window as any).electronAPI?.hanout;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const scale = (): any => (window as any).electronAPI?.scale;

export default function HanoutToday({ canOrder }: { canOrder: boolean }) {
    const navigate = useNavigate();
    const [visits, setVisits] = useState<Visit[]>([]);
    const [soon, setSoon] = useState<Soon[]>([]);
    const [scaleChanges, setScaleChanges] = useState(0);

    useEffect(() => {
        let cancelled = false;
        if (!hanout()) return undefined;
        if (canOrder) hanout().visitsToday().then((v: Visit[]) => { if (!cancelled) setVisits(v.filter(x => x.lines > 0)); }).catch(() => {});
        hanout().sellSoon(3).then((s: Soon[]) => { if (!cancelled) setSoon(s); }).catch(() => {});
        // Only once the shop keeps its scale from the program (it said so once)
        scale()?.plu().then((l: { sentAt: string | null; changed: number }) => { if (!cancelled && l.sentAt) setScaleChanges(l.changed); }).catch(() => {});
        return () => { cancelled = true; };
    }, [canOrder]);

    if (!visits.length && !soon.length && !scaleChanges) return null;
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="hanout-today">
            {visits.length > 0 && (
                <button type="button" onClick={() => navigate('/distributors')} className="card text-start hover:bg-dark-tertiary/60 flex gap-3 items-start" data-testid="card-visits">
                    <Truck className="w-6 h-6 text-indigo-300 flex-none" />
                    <span>
                        <span className="block font-semibold">{t('home.visitsTitle')}</span>
                        {visits.map(v => <span key={v.supplier_id} className="block text-sm text-zinc-300">{t('home.visitLine', { name: v.name, n: v.lines })}</span>)}
                    </span>
                </button>
            )}
            {soon.length > 0 && (
                <div className="card flex gap-3 items-start" data-testid="card-sell-soon">
                    <Clock className="w-6 h-6 text-amber-300 flex-none" />
                    <span>
                        <span className="block font-semibold">{t('home.sellSoonTitle')}</span>
                        {soon.slice(0, 4).map(s => (
                            <span key={`${s.product_id}-${s.days_left}`} className={`block text-sm ${s.days_left < 0 ? 'text-red-300' : 'text-zinc-300'}`}>
                                {t(s.days_left < 0 ? 'home.expired' : 'home.sellSoonLine', { name: s.name, n: s.unit === 'kg' ? weightLabel(s.left) : s.left, days: Math.abs(s.days_left) })}
                            </span>
                        ))}
                    </span>
                </div>
            )}
            {scaleChanges > 0 && (
                <button type="button" onClick={() => navigate('/settings?tab=scale')} className="card text-start hover:bg-dark-tertiary/60 flex gap-3 items-start" data-testid="card-scale">
                    <Scale className="w-6 h-6 text-amber-300 flex-none" />
                    <span>
                        <span className="block font-semibold">{t('home.scaleTitle')}</span>
                        <span className="block text-sm text-zinc-300">{t('home.scaleLine', { n: scaleChanges })}</span>
                    </span>
                </button>
            )}
        </div>
    );
}
