// A customer's account as an Excel file (each kridi, return and payment, what
// is left after each line), and the same file for WhatsApp: the program saves
// it, opens its folder and the customer's chat with a ready message. WhatsApp
// lets no program attach a file: the cashier drags it into the chat, then Send.
import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { ExcelIcon } from '../ui/ExportButton';
import { toast } from '../ui/Toast';
import { useT } from '../../i18n';
import { formatMoney } from '../../i18n/format';
import { translateError } from '../../i18n/errors';
import { whatsappLink } from '../../lib/whatsapp';
import { useSettingsStore } from '../../stores/settingsStore';

export function CustomerStatement({ customer }) {
    const { t, lang } = useT();
    const shopName = useSettingsStore(state => state.settings.businessName);
    const [busy, setBusy] = useState('');

    const saveFile = async () => window.electronAPI.exports.save({ kind: 'customerStatement', lang, customerId: customer.id });

    const save = async () => {
        setBusy('file');
        try {
            const file = await saveFile();
            if (file) toast.success(t('statement.saved'));
        } catch (error) {
            toast.error(translateError(error));
        } finally {
            setBusy('');
        }
    };

    const sendOnWhatsApp = async () => {
        const text = t('statement.message', { name: customer.name || '', shop: shopName || '', amount: formatMoney(customer.owed || 0) });
        const link = whatsappLink(customer.phone, text);
        if (!link) { toast.error(t('whatsapp.noPhone')); return; }
        setBusy('whatsapp');
        try {
            const file = await saveFile();
            if (!file) return;
            await window.electronAPI.exports.showFile(file.filePath);
            const opened = await window.electronAPI.shell.openExternal(link).catch(() => ({ success: false }));
            if (opened?.success === false) toast.error(t('whatsapp.failed'));
            else toast.success(t('statement.dragIt'), 12000);
        } catch (error) {
            toast.error(translateError(error));
        } finally {
            setBusy('');
        }
    };

    return (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-sky-500/25 bg-sky-500/5 px-4 py-3" data-testid="customer-statement">
            <div className="flex-1 min-w-[12rem]">
                <p className="font-semibold">{t('statement.title')}</p>
                <p className="text-xs text-zinc-400">{t('statement.hint')}</p>
            </div>
            <Button variant="secondary" size="iconSm" onClick={save} loading={busy === 'file'} data-testid="statement-file" title={t('statement.file')} aria-label={t('statement.file')}>
                {busy !== 'file' && <ExcelIcon />}
            </Button>
            <Button size="sm" onClick={sendOnWhatsApp} loading={busy === 'whatsapp'} disabled={!customer.phone} title={customer.phone ? '' : t('whatsapp.noPhone')} data-testid="statement-whatsapp">
                <MessageCircle className="w-4 h-4" /> {t('statement.whatsapp')}
            </Button>
        </div>
    );
}

export default CustomerStatement;
