// One button for every Excel file of the shop (electron/ipc/exports.js): the
// file is made in the shop's language with its header, then "Save as".
import { useState } from 'react';
import { FileDown } from 'lucide-react';
import { Button } from './Button';
import { toast } from './Toast';
import { useT } from '../../i18n';
import { translateError } from '../../i18n/errors';

export function ExportButton({ kind, args = {}, label, variant = 'secondary', size, className = '', testId }) {
    const { t, lang } = useT();
    const [busy, setBusy] = useState(false);
    const save = async () => {
        setBusy(true);
        try {
            const saved = await window.electronAPI.exports.save({ kind, lang, ...(typeof args === 'function' ? args() : args) });
            if (saved) toast.success(t('export.saved', { n: saved.rows }));
        } catch (error) {
            toast.error(translateError(error));
        } finally {
            setBusy(false);
        }
    };
    return (
        <Button variant={variant} size={size} onClick={save} loading={busy} className={className} data-testid={testId || `export-${kind}`} title={t('export.hint')}>
            <FileDown className="w-4 h-4" /> {label || t('export.excel')}
        </Button>
    );
}

export default ExportButton;
