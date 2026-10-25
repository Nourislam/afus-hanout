// "Send to the accountant": one Excel file for a month (summary, sales journal,
// kridi paid in, stock), saved, then its folder opened to attach it to an
// e-mail or a WhatsApp message (exportService.js accountantSheets). Owner only.
import { useState } from 'react';
import { Send, FolderOpen } from 'lucide-react';
import { Button } from '../ui/Button';
import { ExcelIcon } from '../ui/ExportButton';
import { Modal, ModalBody, ModalFooter } from '../ui/Modal';
import { Select } from '../ui/Select';
import { toast } from '../ui/Toast';
import { useT } from '../../i18n';
import { translateError } from '../../i18n/errors';

const LOCALE = { ar: 'ar-DZ', fr: 'fr-DZ', en: 'en-GB' };

/** The last 12 months, this one first ("so far"). */
function lastMonths(lang, t) {
    const now = new Date();
    const name = new Intl.DateTimeFormat(LOCALE[lang] || 'fr-DZ', { month: 'long', year: 'numeric' });
    return Array.from({ length: 12 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return { value, label: i === 0 ? `${name.format(d)} (${t('acc.soFar')})` : name.format(d) };
    });
}

export function AccountantFile() {
    const { t, lang } = useT();
    const [open, setOpen] = useState(false);
    const months = lastMonths(lang, t);
    // The month just closed is the one an accountant asks for
    const [month, setMonth] = useState(months[1].value);
    const [busy, setBusy] = useState(false);
    const [saved, setSaved] = useState(null);

    const close = () => { setOpen(false); setSaved(null); };
    const save = async () => {
        setBusy(true);
        try {
            const file = await window.electronAPI.exports.save({ kind: 'accountant', lang, month });
            if (file) setSaved(file);
        } catch (error) {
            toast.error(translateError(error));
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <Button variant="primary" onClick={() => setOpen(true)} data-testid="accountant-open" title={t('acc.hint')}>
                <Send className="w-4 h-4" /> {t('acc.button')}
            </Button>
            <Modal isOpen={open} onClose={close} title={t('acc.title')} size="md">
                <ModalBody className="space-y-4">
                    {!saved ? (
                        <>
                            <Select label={t('acc.month')} value={month} onChange={setMonth} options={months} />
                            <div className="text-sm text-zinc-300 space-y-1">
                                <p className="font-medium">{t('acc.inside')}</p>
                                <ul className="list-disc ps-5 space-y-0.5 text-zinc-400">
                                    <li>{t('acc.part.summary')}</li>
                                    <li>{t('acc.part.journal')}</li>
                                    <li>{t('acc.part.kridi')}</li>
                                    <li>{t('acc.part.stock')}</li>
                                </ul>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-2" data-testid="accountant-saved">
                            <p className="font-semibold text-emerald-300">{t('acc.saved')}</p>
                            <p className="text-sm text-zinc-400 break-all">{saved.filePath}</p>
                            <p className="text-sm text-zinc-300">{t('acc.sendHint')}</p>
                        </div>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="secondary" onClick={close}>{t('common.close')}</Button>
                    {!saved ? (
                        <Button size="icon" onClick={save} loading={busy} data-testid="accountant-save" title={t('acc.save')} aria-label={t('acc.save')}>{!busy && <ExcelIcon />}</Button>
                    ) : (
                        <Button onClick={() => window.electronAPI.exports.showFile(saved.filePath)} data-testid="accountant-folder">
                            <FolderOpen className="w-4 h-4" /> {t('acc.folder')}
                        </Button>
                    )}
                </ModalFooter>
            </Modal>
        </>
    );
}

export default AccountantFile;
