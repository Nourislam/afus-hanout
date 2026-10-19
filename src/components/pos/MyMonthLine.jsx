// Sales screen: the employee's own month (add-on "Commissions and best employee").
// Only their figures, never anyone else's; nothing when they have no goal nor commission.
import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { useT } from '../../i18n';
import { formatMoney } from '../../i18n/format';

export default function MyMonthLine({ refreshKey }) {
    const { t } = useT();
    const [mine, setMine] = useState(null);
    useEffect(() => {
        let alive = true;
        window.electronAPI.commissions?.mine({}).then(r => { if (alive) setMine(r); }).catch(() => {});
        return () => { alive = false; };
    }, [refreshKey]);
    if (!mine) return null;
    const percent = mine.goalPercent;
    return (
        <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 text-xs space-y-1.5" data-testid="pos-my-month">
            <p className="flex flex-wrap items-center gap-x-1.5 text-zinc-300">
                <Target className="w-3.5 h-3.5 text-indigo-300" />
                <span>{t('goals.mine', { sold: formatMoney(mine.net) })}</span>
                {percent !== null && <><span aria-hidden>·</span><span className="font-semibold text-indigo-200">{t('goals.mineGoal', { percent })}</span></>}
                {mine.kind !== 'none' && <><span aria-hidden>·</span><span className="text-emerald-300">{t('goals.mineCommission', { amount: formatMoney(mine.commission) })}</span></>}
            </p>
            {percent !== null && (
                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className={`h-full rounded-full ${percent >= 100 ? 'bg-emerald-400' : 'bg-indigo-400'}`} style={{ width: `${Math.min(100, percent)}%` }} />
                </div>
            )}
        </div>
    );
}
