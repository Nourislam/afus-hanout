// One button for every Excel file of the shop (electron/ipc/exports.js): the
// file is made in the shop's language with its header, then "Save as".
// An icon only (a green sheet with an arrow down: "download the Excel file"),
// with its name in the tooltip and for screen readers.
import { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from './Button';
import { toast } from './Toast';
import { useT } from '../../i18n';
import { translateError } from '../../i18n/errors';

/** The Excel sheet, with an arrow down (a file made) or up (a file read). */
export function ExcelIcon({ direction = 'down' }) {
    const Arrow = direction === 'up' ? ArrowUp : ArrowDown;
    return (
        <span className="relative inline-flex flex-none" aria-hidden="true">
            <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
            <span className="absolute -bottom-1 -end-1.5 rounded-full bg-dark-tertiary p-px leading-none">
                <Arrow className="w-3 h-3 text-zinc-100" strokeWidth={3} />
            </span>
        </span>
    );
}

/** Makes the file and offers "Save as" (one place for every Excel button). */
function useExport() {
    const { t, lang } = useT();
    const [busy, setBusy] = useState('');
    const save = async ({ kind, args = {} }) => {
        setBusy(kind);
        try {
            const saved = await window.electronAPI.exports.save({ kind, lang, ...(typeof args === 'function' ? args() : args) });
            if (saved) toast.success(t('export.saved', { n: saved.rows }));
        } catch (error) {
            toast.error(translateError(error));
        } finally {
            setBusy('');
        }
    };
    return { busy, save };
}

export function ExportButton({ kind, args = {}, label, variant = 'secondary', className = '', testId }) {
    const { t } = useT();
    const { busy, save } = useExport();
    const name = label || t('export.excel');
    return (
        <Button variant={variant} size="icon" onClick={() => save({ kind, args })} loading={!!busy} className={className} data-testid={testId || `export-${kind}`} title={name} aria-label={name}>
            {!busy && <ExcelIcon />}
        </Button>
    );
}

/**
 * Several Excel files of one screen behind one Excel button: the list opens
 * with the name of each file (two same icons side by side cannot be told apart).
 * files: [{ kind, args, label, testId }]
 */
export function ExportMenu({ files, label, className = '', testId = 'export-menu' }) {
    const { t } = useT();
    const { busy, save } = useExport();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const name = label || t('export.excel');
    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
    }, [open]);
    return (
        <div ref={ref} className={`relative ${className}`}>
            <Button variant="secondary" size="icon" onClick={() => setOpen(v => !v)} loading={!!busy} title={name} aria-label={name}
                aria-haspopup="menu" aria-expanded={open} data-testid={testId}>
                {!busy && <ExcelIcon />}
            </Button>
            {open && (
                <div role="menu" className="absolute top-full end-0 mt-1 z-40 min-w-[13rem] p-1 rounded-lg bg-dark-secondary border border-dark-border shadow-xl shadow-black/40 flex flex-col">
                    {files.map(file => (
                        <button key={file.kind} type="button" role="menuitem" data-testid={file.testId || `export-${file.kind}`}
                            onClick={() => { setOpen(false); save(file); }}
                            className="flex items-center gap-2 h-9 px-3 rounded-md text-sm text-start whitespace-nowrap text-zinc-300 hover:bg-dark-tertiary hover:text-white">
                            <ExcelIcon /> <span className="flex-1">{file.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default ExportButton;
