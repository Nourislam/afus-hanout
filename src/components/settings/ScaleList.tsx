// Settings › Label scale › the scale's articles: each article sold by weight
// with its number in the scale (PLU) and its price per kg. The scale prints
// the price the till charges, so what changed since the scale was last
// updated is marked until the owner says it is up to date.
import { useEffect, useState } from 'react';
import { FileSpreadsheet, FileText, Printer, CheckCircle2, Hash } from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { useT } from '../../i18n';
import { translateError } from '../../i18n/errors';
import { formatDate, formatMoney } from '../../i18n/format';
import { useAuthStore } from '../../stores/authStore';
import { PERMISSIONS } from '../../lib/permissions';

export interface ScaleRow { id: string; plu: number; name: string; price: number; change: null | 'new' | 'price' | 'name'; before?: number; beforeName?: string }
export interface ScaleListData { rows: ScaleRow[]; missing: { id: string; name: string }[]; gone: { plu: number; name: string }[]; changed: number; sentAt: string | null }
interface ScaleBridge {
    plu(): Promise<ScaleListData>;
    assignNumbers(): Promise<{ given: number; list: ScaleListData }>;
    markSent(): Promise<ScaleListData>;
    saveFile(format: 'csv' | 'xlsx'): Promise<{ filePath: string; rows: number } | null>;
    printSheet(onlyChanged: boolean): Promise<boolean>;
}
const bridge = (): ScaleBridge => (window as unknown as { electronAPI: { scale: ScaleBridge } }).electronAPI.scale;

export function ScaleList() {
    const { t, lang } = useT();
    const canEdit = useAuthStore(state => state.hasPermission(PERMISSIONS.PRODUCTS_EDIT));
    const [list, setList] = useState<ScaleListData | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        bridge().plu().then(l => { if (!cancelled) setList(l); }).catch(() => {});
        return () => { cancelled = true; };
    }, []);

    const run = async (fn: () => Promise<void>) => {
        setBusy(true);
        try { await fn(); } catch (error) { toast.error(translateError(error)); } finally { setBusy(false); }
    };
    const assign = () => run(async () => {
        const { given, list: next } = await bridge().assignNumbers();
        setList(next);
        toast.success(t('scaleList.given', { n: given }));
    });
    const save = (format: 'csv' | 'xlsx') => run(async () => {
        const saved = await bridge().saveFile(format);
        if (saved) toast.success(t('scaleList.saved', { n: saved.rows }));
    });
    const print = (onlyChanged: boolean) => run(async () => { await bridge().printSheet(onlyChanged); });
    const sent = () => run(async () => {
        setList(await bridge().markSent());
        toast.success(t('scaleList.upToDate'));
    });

    if (!list) return null;
    const note = (r: ScaleRow) => {
        if (!list.sentAt || !r.change) return null;
        if (r.change === 'price') return t('scaleList.was', { price: formatMoney(r.before ?? 0) });
        if (r.change === 'name') return t('scaleList.renamed');
        return t('scaleList.new');
    };

    return (
        <div className="space-y-4" data-testid="scale-list">
            <p className={`text-sm ${list.sentAt && list.changed ? 'text-amber-300' : 'text-zinc-400'}`} data-testid="scale-list-state">
                {!list.sentAt ? t('scaleList.never')
                    : list.changed ? t('scaleList.changed', { n: list.changed, date: formatDate(list.sentAt) })
                        : t('scaleList.same', { date: formatDate(list.sentAt) })}
            </p>

            {list.missing.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3" data-testid="scale-missing">
                    <p className="text-sm text-amber-200">{t('scaleList.missing', { n: list.missing.length, names: list.missing.slice(0, 4).map(m => m.name).join(lang === 'ar' ? '، ' : ', ') })}</p>
                    {canEdit && <Button size="sm" variant="secondary" onClick={assign} disabled={busy} data-testid="scale-assign"><Hash className="w-4 h-4" />{t('scaleList.assign')}</Button>}
                </div>
            )}

            {list.rows.length === 0 && list.gone.length === 0 ? (
                <p className="text-sm text-zinc-500">{t('scaleList.empty')}</p>
            ) : (
                <div className="rounded-xl border border-dark-border overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-white/5 text-zinc-400">
                            <tr>
                                <th className="px-3 py-2 text-start w-20">PLU</th>
                                <th className="px-3 py-2 text-start">{t('scaleList.article')}</th>
                                <th className="px-3 py-2 text-start">{t('scaleList.pricePerKg')}</th>
                                <th className="px-3 py-2 text-start" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {list.rows.map(r => (
                                <tr key={r.id} className={note(r) ? 'bg-amber-500/5' : ''}>
                                    <td className="px-3 py-2 font-mono text-white" dir="ltr">{r.plu}</td>
                                    <td className="px-3 py-2 text-white">{r.name}</td>
                                    <td className="px-3 py-2 text-white whitespace-nowrap">{formatMoney(r.price)}</td>
                                    <td className="px-3 py-2 text-amber-300 text-xs">{note(r)}</td>
                                </tr>
                            ))}
                            {list.gone.map(g => (
                                <tr key={`gone-${g.plu}`} className="bg-amber-500/5">
                                    <td className="px-3 py-2 font-mono text-zinc-500" dir="ltr">{g.plu}</td>
                                    <td className="px-3 py-2 text-zinc-500 line-through">{g.name}</td>
                                    <td className="px-3 py-2 text-zinc-500">—</td>
                                    <td className="px-3 py-2 text-amber-300 text-xs">{t('scaleList.gone')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => save('csv')} disabled={busy || !list.rows.length} data-testid="scale-csv"><FileText className="w-4 h-4" />{t('scaleList.csv')}</Button>
                <Button variant="secondary" onClick={() => save('xlsx')} disabled={busy || !list.rows.length}><FileSpreadsheet className="w-4 h-4" />{t('scaleList.excel')}</Button>
                <Button variant="secondary" onClick={() => print(false)} disabled={busy || !list.rows.length}><Printer className="w-4 h-4" />{t('scaleList.print')}</Button>
                {list.sentAt && list.changed > 0 && (
                    <Button variant="secondary" onClick={() => print(true)} disabled={busy}><Printer className="w-4 h-4" />{t('scaleList.printChanged', { n: list.changed })}</Button>
                )}
                {canEdit && (list.changed > 0 || !list.sentAt) && list.rows.length > 0 && (
                    <Button onClick={sent} disabled={busy} data-testid="scale-sent"><CheckCircle2 className="w-4 h-4" />{t('scaleList.markSent')}</Button>
                )}
            </div>
            <p className="text-xs text-zinc-500">{t('scaleList.hint')}</p>
        </div>
    );
}
