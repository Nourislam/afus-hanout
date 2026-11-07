// The zakat estimate (حاسبة الزكاة التقديرية), the owner's only. The program
// gathers the shop's figures; how the goods are valued, the nisab and the
// debts counted are the merchant's choice with the one he asks for a ruling.
// Its wording is to be reviewed by a specialist before release (study, phase 8).
import { useEffect, useMemo, useState } from 'react';
import { Landmark, Info } from 'lucide-react';
import { useT } from '../i18n';
import { formatMoney } from '../i18n/format';
import { toast } from '../components/ui/Toast';
import { translateError } from '../i18n/errors';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { zakatEstimate } from '../../electron/shared/zakat.ts';
import { hijriOf } from '../../electron/shared/hijri.ts';

interface Figures { goodsCost: number; goodsRetail: number; receivables: number; payables: number; drawers: number }
interface ZakatSetting { month?: number; day?: number; nisab?: number }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = (): any => (window as any).electronAPI;
const num = (text: string) => Math.max(0, Number(String(text).replace(/\s/g, '').replace(',', '.')) || 0);

export default function ZakatPage() {
    const { t } = useT();
    const [figures, setFigures] = useState<Figures | null>(null);
    const [basis, setBasis] = useState<'' | 'cost' | 'retail'>('');
    const [cash, setCash] = useState('');
    const [withKarni, setWithKarni] = useState(true);
    const [nisab, setNisab] = useState('');
    const [month, setMonth] = useState('9');
    const [day, setDay] = useState('1');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const f: Figures = await api().smart.zakatFigures();
            const saved: ZakatSetting | null = await api().settings.get('zakat');
            if (cancelled) return;
            setFigures(f);
            setCash(String(f.drawers || ''));
            if (saved?.month) setMonth(String(saved.month));
            if (saved?.day) setDay(String(saved.day));
            if (saved?.nisab) setNisab(String(saved.nisab));
        })().catch(error => toast.error(translateError(error)));
        return () => { cancelled = true; };
    }, []);

    const estimate = useMemo(() => (figures && basis ? zakatEstimate({
        goods: basis === 'cost' ? figures.goodsCost : figures.goodsRetail,
        cash: num(cash), receivables: withKarni ? figures.receivables : 0, payables: figures.payables, nisab: num(nisab),
    }) : null), [figures, basis, cash, withKarni, nisab]);

    const saveDay = async () => {
        try {
            await api().settings.set({ key: 'zakat', value: { month: Number(month), day: Number(day), nisab: num(nisab) } });
            toast.success(t('zakat.saved'));
        } catch (error) {
            toast.error(translateError(error));
        }
    };

    const today = hijriOf(new Date());
    const row = (label: string, value: number, sign = '') => (
        <div className="flex justify-between gap-4 py-1.5"><span className="text-zinc-400">{label}</span><span className="tabular text-white">{sign}{formatMoney(value)}</span></div>
    );

    return (
        <div className="page">
            <div className="page-header px-6 py-4 flex items-center gap-3">
                <Landmark className="w-6 h-6 text-indigo-300" />
                <div>
                    <h1 className="text-xl font-bold">{t('zakat.title')}</h1>
                    <p className="text-sm text-zinc-500">{t('zakat.subtitle')}</p>
                </div>
            </div>
            <div className="page-body space-y-4 max-w-4xl">
                <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100" data-testid="zakat-notice">
                    <Info className="w-5 h-5 flex-none text-amber-300" />
                    <p>{t('zakat.notice')}</p>
                </div>

                {figures && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="card space-y-4">
                            <Select label={t('zakat.basis')} value={basis} onChange={(v: string) => setBasis(v as '' | 'cost' | 'retail')} data-testid="zakat-basis"
                                options={[
                                    { value: '', label: t('zakat.basis.choose') },
                                    { value: 'cost', label: t('zakat.basis.cost', { amount: formatMoney(figures.goodsCost) }) },
                                    { value: 'retail', label: t('zakat.basis.retail', { amount: formatMoney(figures.goodsRetail) }) },
                                ]} />
                            <div>
                                <Input label={t('zakat.cash')} value={cash} onChange={(e) => setCash(e.target.value)} inputMode="decimal" dir="ltr" data-testid="zakat-cash" />
                                <p className="text-xs text-zinc-500 mt-1">{t('zakat.cashHint', { amount: formatMoney(figures.drawers) })}</p>
                            </div>
                            <label className="flex items-start gap-3 text-sm cursor-pointer">
                                <input type="checkbox" className="mt-1" checked={withKarni} onChange={(e) => setWithKarni(e.target.checked)} />
                                <span>{t('zakat.karni', { amount: formatMoney(figures.receivables) })}<span className="block text-xs text-zinc-500">{t('zakat.karniHint')}</span></span>
                            </label>
                            <div>
                                <Input label={t('zakat.nisab')} value={nisab} onChange={(e) => setNisab(e.target.value)} inputMode="decimal" dir="ltr" placeholder="0" />
                                <p className="text-xs text-zinc-500 mt-1">{t('zakat.nisabHint')}</p>
                            </div>
                        </div>

                        <div className="card space-y-3" data-testid="zakat-result">
                            {row(t('zakat.row.goods'), basis === 'cost' ? figures.goodsCost : basis === 'retail' ? figures.goodsRetail : 0)}
                            {row(t('zakat.row.cash'), num(cash), '+ ')}
                            {row(t('zakat.row.karni'), withKarni ? figures.receivables : 0, '+ ')}
                            {row(t('zakat.row.suppliers'), figures.payables, '− ')}
                            <div className="h-px bg-dark-border" />
                            {estimate ? (
                                <>
                                    {row(t('zakat.row.base'), estimate.base)}
                                    {estimate.reached === false ? (
                                        <p className="text-emerald-300 font-semibold">{t('zakat.underNisab')}</p>
                                    ) : (
                                        <div className="flex justify-between gap-4 text-lg font-bold">
                                            <span>{t('zakat.row.due')}</span><span className="tabular text-amber-300" data-testid="zakat-due">{formatMoney(estimate.due)}</span>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-sm text-zinc-400">{t('zakat.chooseFirst')}</p>
                            )}
                        </div>
                    </div>
                )}

                <div className="card space-y-3">
                    <h2 className="font-semibold">{t('zakat.dayTitle')}</h2>
                    <p className="text-sm text-zinc-400">{t('zakat.dayText', { today: `${today.day}/${today.month}/${today.year}` })}</p>
                    <div className="flex flex-wrap items-end gap-3">
                        <Select label={t('zakat.month')} value={month} onChange={(v: string) => setMonth(v)}
                            options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: t(`hijri.month.${i + 1}`) }))} />
                        <Select label={t('zakat.day')} value={day} onChange={(v: string) => setDay(v)}
                            options={Array.from({ length: 30 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} />
                        <Button onClick={saveDay}>{t('common.save')}</Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
