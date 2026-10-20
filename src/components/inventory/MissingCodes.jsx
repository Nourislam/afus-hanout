// Stock lines that the scanner cannot find (no QR, reference or barcode),
// shown before a count with one button: "Create codes" gives each a reference
// (electron/services/codesService.js); their labels are then printed from Labels.
import { useEffect, useState } from 'react';
import { ScanLine, Wand2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { useT } from '../../i18n';
import { translateError } from '../../i18n/errors';
import { useAuthStore } from '../../stores/authStore';
import { PERMISSIONS } from '../../lib/permissions';

export function MissingCodes({ onChange, className = '' }) {
    const { t } = useT();
    const canEdit = useAuthStore(state => state.hasPermission(PERMISSIONS.PRODUCTS_EDIT));
    const [lines, setLines] = useState([]);
    const [busy, setBusy] = useState(false);
    const load = () => window.electronAPI?.figures?.withoutCode?.().then(setLines).catch(() => setLines([]));
    useEffect(() => { load(); }, []);

    const create = async () => {
        setBusy(true);
        try {
            const made = await window.electronAPI.figures.createCodes();
            toast.success(t('codes.made', { n: made.length }), 10000, { to: '/labels', label: 'codes.printLabels' });
            await load();
            onChange?.();
        } catch (error) {
            toast.error(translateError(error));
        } finally {
            setBusy(false);
        }
    };

    if (!lines.length) return null;
    const label = (l) => [l.name, [l.color, l.size].filter(Boolean).join(' / ')].filter(Boolean).join(' · ');
    return (
        <div className={`p-4 rounded-xl bg-sky-500/10 border border-sky-500/30 space-y-2 ${className}`} data-testid="missing-codes">
            <div className="flex flex-wrap items-center gap-3">
                <ScanLine className="w-5 h-5 text-sky-300 flex-none" />
                <div className="flex-1 min-w-[14rem]">
                    <p className="font-semibold text-sky-200">{t('codes.title', { n: lines.length })}</p>
                    <p className="text-xs text-zinc-400">{t('codes.why')}</p>
                </div>
                {canEdit && (
                    <Button size="sm" onClick={create} loading={busy} data-testid="missing-codes-create">
                        <Wand2 className="w-4 h-4" /> {t('codes.create')}
                    </Button>
                )}
            </div>
            <p className="text-sm text-zinc-300">
                {lines.slice(0, 6).map(label).join('، ')}{lines.length > 6 ? ` ${t('count.importMore', { n: lines.length - 6 })}` : ''}
            </p>
        </div>
    );
}

export default MissingCodes;
