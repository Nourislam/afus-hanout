// Official prices (الأسعار المسقّفة): the subsidised goods to review with
// today's official price (the sale is refused above it), and a limit per
// customer when one runs short. Rules in electron/services/cappedService.js.
import { useCallback, useEffect, useState } from 'react';
import { Landmark } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { t } from '../../i18n';
import { formatMoney } from '../../i18n/format';
import { translateError } from '../../i18n/errors';

interface Row { id: string; name: string; price: number; capped_price?: number | null; max_per_customer?: number | null }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hanout = (): any => (window as any).electronAPI.hanout;

export function OfficialPrices() {
    const [rows, setRows] = useState<Row[]>([]);
    const [drafts, setDrafts] = useState<Record<string, { cap: string; limit: string }>>({});
    const load = useCallback(async () => {
        const review = await hanout().capped();
        const list: Row[] = [...review.capped, ...review.suggested];
        setRows(list);
        setDrafts(Object.fromEntries(list.map(r => [r.id, { cap: r.capped_price ? String(r.capped_price) : '', limit: r.max_per_customer ? String(r.max_per_customer) : '' }])));
    }, []);
    useEffect(() => { load().catch(() => {}); }, [load]);

    const save = async (row: Row) => {
        const d = drafts[row.id] || { cap: '', limit: '' };
        try {
            await hanout().setCap({ productId: row.id, cap: Number(d.cap.replace(',', '.')) || 0, limit: Number(d.limit) || 0 });
            toast.success(t('capped.saved', { name: row.name }));
            load();
        } catch (error) { toast.error(translateError(error)); }
    };

    return (
        <Card className="space-y-3" onClick={undefined} data-testid="official-prices">
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/15 text-emerald-300 flex items-center justify-center flex-none"><Landmark className="w-5 h-5" /></div>
                <div className="min-w-0">
                    <h3 className="font-semibold">{t('capped.title')}</h3>
                    <p className="text-sm text-zinc-500">{t('capped.text')}</p>
                </div>
            </div>
            {rows.length === 0 ? <p className="text-sm text-zinc-500">{t('capped.none')}</p> : (
                <ul className="divide-y divide-dark-border">
                    {rows.map(row => {
                        const d = drafts[row.id] || { cap: '', limit: '' };
                        return (
                            <li key={row.id} className="py-2 flex flex-wrap items-end gap-3">
                                <span className="flex-1 min-w-[160px]" dir="auto">{row.name} <span className="text-xs text-zinc-500">({formatMoney(row.price)})</span></span>
                                <label className="text-xs text-zinc-400">{t('capped.cap')}
                                    <input className="input w-24 tabular ltr block" inputMode="decimal" value={d.cap} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...d, cap: e.target.value } })} />
                                </label>
                                <label className="text-xs text-zinc-400">{t('capped.limit')}
                                    <input className="input w-20 tabular ltr block" inputMode="numeric" value={d.limit} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...d, limit: e.target.value.replace(/\D/g, '') } })} />
                                </label>
                                <Button size="sm" variant="secondary" onClick={() => save(row)}>{t('common.save')}</Button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Card>
    );
}
