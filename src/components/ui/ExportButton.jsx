// One button for every Excel file of the shop (electron/ipc/exports.js): the
// file is made in the shop's language with its header, then "Save as".
// An icon only (a green sheet with an arrow down: "download the Excel file"),
// with its name (and what is in the file) in the tooltip and for screen readers.
import { useRef, useState } from 'react';
import { FileSpreadsheet, ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from './Button';
import { Menu, MenuItem } from './Menu';
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

export function ExportButton({ kind, args = {}, label, variant = 'secondary', size = 'icon', className = '', testId }) {
    const { t } = useT();
    const { busy, save } = useExport();
    const name = label || t('export.excel');
    return (
        <Button variant={variant} size={size} onClick={() => save({ kind, args })} loading={!!busy} className={className}
            data-testid={testId || `export-${kind}`} title={`${name}\n${t('export.hint')}`} aria-label={name}>
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
    return (
        <div ref={ref} className={className}>
            <Button variant="secondary" size="icon" onClick={() => setOpen(v => !v)} loading={!!busy} title={`${name}\n${t('export.hint')}`} aria-label={name}
                aria-haspopup="menu" aria-expanded={open} data-testid={testId}>
                {!busy && <ExcelIcon />}
            </Button>
            <Menu open={open} onClose={() => setOpen(false)} anchorRef={ref} className="min-w-[13rem]">
                {files.map(file => (
                    <MenuItem key={file.kind} testId={file.testId || `export-${file.kind}`} onClick={() => { setOpen(false); save(file); }}>
                        <ExcelIcon /> <span className="flex-1">{file.label}</span>
                    </MenuItem>
                ))}
            </Menu>
        </div>
    );
}

export default ExportButton;
