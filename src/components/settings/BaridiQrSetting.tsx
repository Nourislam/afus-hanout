// Settings › Sales screen › Baridi Pay: the shop's own QR code from Algérie
// Poste (a picture). The payment window shows it large when «بريدي باي» is
// chosen, so the customer scans it from the till's screen.
import { useEffect, useState, type ChangeEvent } from 'react';
import { QrCode, Upload, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { useT } from '../../i18n';
import { translateError } from '../../i18n/errors';
import { resizeImageDataUrl } from '../../lib/imageResize';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = (): any => (window as any).electronAPI;

export function BaridiQrSetting() {
    const { t } = useT();
    const [file, setFile] = useState<string | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        api().settings.get('baridi_qr').then((name: string | null) => { if (!cancelled) setFile(name || null); }).catch(() => {});
        return () => { cancelled = true; };
    }, []);
    useEffect(() => {
        let cancelled = false;
        if (!file) { setPreview(null); return undefined; }
        api().images.get(file).then((data: string | null) => { if (!cancelled) setPreview(data || null); }).catch(() => {});
        return () => { cancelled = true; };
    }, [file]);

    const save = async (name: string | null) => {
        await api().settings.set({ key: 'baridi_qr', value: name });
        setFile(name);
    };
    const choose = (e: ChangeEvent<HTMLInputElement>) => {
        const picked = e.target.files?.[0];
        e.target.value = '';
        if (!picked) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            setBusy(true);
            try {
                // PNG keeps the code sharp; 600 px is plenty to scan from the screen
                const base64Data = await resizeImageDataUrl(String(event.target?.result), { maxSize: 600, type: 'image/png' });
                const result = await api().images.saveLogo({ base64Data, originalName: `baridi-${picked.name}` });
                if (!result?.success) throw new Error(result?.error || 'PHOTO');
                await save(result.fileName);
                toast.success(t('baridi.saved'));
            } catch (error) {
                toast.error(translateError(error));
            } finally {
                setBusy(false);
            }
        };
        reader.readAsDataURL(picked);
    };

    return (
        <div className="flex flex-col sm:flex-row gap-4 items-start" data-testid="baridi-qr-setting">
            <div className="w-32 h-32 flex-none rounded-xl border border-dark-border bg-white flex items-center justify-center overflow-hidden">
                {preview ? <img src={preview} alt={t('baridi.title')} className="w-full h-full object-contain p-1" /> : <QrCode className="w-12 h-12 text-zinc-400" />}
            </div>
            <div className="space-y-2 min-w-0">
                <p className="font-medium text-white">{t('baridi.title')}</p>
                <p className="text-sm text-zinc-400">{t('baridi.text')}</p>
                <div className="flex flex-wrap gap-2">
                    <label className={`btn btn-secondary h-9 px-3 text-sm cursor-pointer ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
                        <Upload className="w-4 h-4" /> {t(file ? 'baridi.change' : 'baridi.add')}
                        <input type="file" accept="image/*" className="hidden" onChange={choose} data-testid="baridi-qr-file" />
                    </label>
                    {file && <Button size="sm" variant="ghost" onClick={() => save(null)}><Trash2 className="w-4 h-4" /> {t('baridi.remove')}</Button>}
                </div>
            </div>
        </div>
    );
}
