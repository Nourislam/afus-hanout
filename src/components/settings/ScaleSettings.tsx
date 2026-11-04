// Settings › Label scale: how the shop's scale writes its barcode, with a field
// to try a real label before selling with it.
import { useEffect, useState } from 'react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { t } from '../../i18n';
import { formatMoney } from '../../i18n/format';
import { weightLabel } from '../../lib/units';
import { decodeScaleBarcode, scaleFormat, type ScaleFormat } from '../../../electron/shared/scaleBarcode.ts';
import type { ArticleRow } from '../../types/electronAPI';

export function ScaleSettings() {
    const [format, setFormat] = useState<ScaleFormat>(scaleFormat(null));
    const [prefixes, setPrefixes] = useState(format.prefixes.join(', '));
    const [articles, setArticles] = useState<ArticleRow[]>([]);
    const [label, setLabel] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const saved = scaleFormat(await window.electronAPI.settings.get('scale_barcode') as Partial<ScaleFormat> | null);
            const list = await window.electronAPI.products.getAll();
            if (cancelled) return;
            setFormat(saved);
            setPrefixes(saved.prefixes.join(', '));
            setArticles(list.filter(a => a.unit === 'kg'));
        })().catch(() => {});
        return () => { cancelled = true; };
    }, []);

    // What the form says now (the prefixes as typed)
    const current = scaleFormat({ ...format, prefixes: prefixes.split(/[\s,;]+/).filter(Boolean) });
    const reading = label.trim() ? decodeScaleBarcode(label, current) : null;
    const article = reading ? articles.find(a => Number(a.plu) === reading.plu) : null;

    const save = async () => {
        setSaving(true);
        try {
            await window.electronAPI.settings.set({ key: 'scale_barcode', value: current });
            setFormat(current);
            setPrefixes(current.prefixes.join(', '));
            toast.success(t('scale.saved'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-5" data-testid="scale-settings">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <Input label={t('scale.prefixes')} value={prefixes} onChange={(e) => setPrefixes(e.target.value)} dir="ltr" data-testid="scale-prefixes" />
                    <p className="text-xs text-zinc-500 mt-1">{t('scale.prefixesHint')}</p>
                </div>
                <Select label={t('scale.pluDigits')} value={String(format.pluDigits)}
                    onChange={(v) => setFormat({ ...format, pluDigits: Number(v) })}
                    options={['4', '5', '6'].map(v => ({ value: v, label: v }))} />
                <Select label={t('scale.value')} value={format.value}
                    onChange={(v) => setFormat(scaleFormat({ ...format, value: v, decimals: v === 'weight' ? 3 : 0 }))}
                    options={[{ value: 'weight', label: t('scale.value.weight') }, { value: 'price', label: t('scale.value.price') }]} />
                {format.value === 'price' && (
                    <Select label={t('scale.decimals')} value={String(format.decimals)}
                        onChange={(v) => setFormat({ ...format, decimals: Number(v) })}
                        options={['0', '1', '2'].map(v => ({ value: v, label: t(`scale.decimals.${v}`) }))} />
                )}
            </div>

            <div className="rounded-xl border border-dark-border p-4 space-y-2">
                <Input label={t('scale.try')} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('scale.tryHint')} dir="ltr" data-testid="scale-try" />
                {label.trim() && (
                    <p className={`text-sm ${reading && article ? 'text-emerald-300' : 'text-amber-300'}`} data-testid="scale-reading">
                        {!reading ? t('scale.notLabel') : (
                            <>
                                {'grams' in reading
                                    ? t('scale.readWeight', { plu: reading.plu, weight: weightLabel(reading.grams) })
                                    : t('scale.readPrice', { plu: reading.plu, price: formatMoney(reading.price) })}
                                {' '}
                                {article ? t('scale.found', { name: article.name }) : t('scale.unknownPlu', { plu: reading.plu })}
                            </>
                        )}
                    </p>
                )}
            </div>

            <Button onClick={save} disabled={saving}>{t('common.save')}</Button>
        </div>
    );
}
