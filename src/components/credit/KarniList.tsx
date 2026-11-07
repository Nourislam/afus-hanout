// The karni (كارني): who owes what, since when; «خلّص بعض» and the statement
// on WhatsApp in two presses. Reads services/karniService.js.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageCircle, Coins, Search, BookOpen, PenLine } from 'lucide-react';
import { Modal, ModalBody, ModalFooter } from '../ui/Modal';
import { Button } from '../ui/Button';
import { NumPad } from '../ui/NumPad';
import { toast } from '../ui/Toast';
import { t, currentLanguage } from '../../i18n';
import { formatMoney, formatDate } from '../../i18n/format';
import { translateError } from '../../i18n/errors';
import { statementText, whatsappLink } from '../../lib/whatsapp';
import { useSettingsStore } from '../../stores/settingsStore';
import type { KarniBalance } from '../../types/electronAPI';

interface Props { onChanged?: () => void }

export default function KarniList({ onChanged }: Props) {
    const [rows, setRows] = useState<KarniBalance[] | null>(null);
    const [query, setQuery] = useState('');
    const [paying, setPaying] = useState<KarniBalance | null>(null);
    const [entering, setEntering] = useState(false);
    const shopName = useSettingsStore((state: { settings: { businessName?: string } }) => state.settings.businessName) || '';

    const load = useCallback(async () => {
        try { setRows(await window.electronAPI.karni.balances()); } catch (error) { toast.error(translateError(error)); setRows([]); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        const digits = q.replace(/\D/g, '');
        return (rows || []).filter(r => !q || r.name.toLowerCase().includes(q) || (digits && String(r.phone || '').replace(/\D/g, '').includes(digits)));
    }, [rows, query]);
    const total = (rows || []).reduce((s, r) => s + r.owed, 0);

    const sendStatement = async (row: KarniBalance) => {
        const lines = await window.electronAPI.karni.lines(row.id);
        const text = statementText({ name: row.name, shop: shopName, lines, owed: row.owed, lang: currentLanguage() });
        const link = whatsappLink(row.phone, text);
        if (!link) { toast.error(t('whatsapp.noPhone')); return; }
        const opened = await window.electronAPI.shell.openExternal(link).catch(() => ({ success: false }));
        if (opened?.success === false) toast.error(t('whatsapp.failed'));
    };

    return (
        <section className="card space-y-3" data-testid="karni">
            <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-semibold flex items-center gap-2"><BookOpen className="w-5 h-5 text-sky-300" /> {t('karni.title')}</h2>
                <Button size="sm" variant="secondary" onClick={() => setEntering(true)} data-testid="karni-old"><PenLine className="w-4 h-4" /> {t('karni.old')}</Button>
                <span className="text-sm text-zinc-400">{t('karni.total', { n: (rows || []).length, amount: formatMoney(total) })}</span>
                <div className="relative ms-auto w-full sm:w-64">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                    <input className="input ps-10 w-full" placeholder={t('karni.search')} value={query} onChange={(e) => setQuery(e.target.value)} data-testid="karni-search" />
                </div>
            </div>
            {rows === null ? <p className="text-zinc-500 py-6 text-center">{t('common.loading')}</p> : shown.length === 0 ? (
                <p className="text-zinc-500 py-6 text-center">{t('karni.none')}</p>
            ) : (
                <ul className="divide-y divide-dark-border" data-testid="karni-list">
                    {shown.map(row => {
                        const over = row.credit_limit > 0 && row.owed > row.credit_limit;
                        return (
                            <li key={row.id} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                                <div className="flex-1 min-w-[180px]">
                                    <p dir="auto" className="font-semibold text-lg leading-tight">{row.name}</p>
                                    <p className="text-xs text-zinc-500">{t('karni.since', { date: formatDate(row.oldest, 'date') })} · {t('karni.last', { date: formatDate(row.last, 'date') })}</p>
                                </div>
                                <div className="text-end">
                                    <p className={`text-xl font-bold tabular ${over ? 'text-red-300' : 'text-amber-200'}`}>{formatMoney(row.owed)}</p>
                                    {row.credit_limit > 0 && <p className={`text-xs ${over ? 'text-red-300' : 'text-zinc-500'}`}>{t('karni.ceiling', { amount: formatMoney(row.credit_limit) })}</p>}
                                </div>
                                <div className="flex gap-2">
                                    <Button size="lg" onClick={() => setPaying(row)} data-testid="karni-pay"><Coins className="w-5 h-5" /> {t('karni.payPart')}</Button>
                                    <Button size="lg" variant="secondary" onClick={() => sendStatement(row)} data-testid="karni-statement"><MessageCircle className="w-5 h-5" /> {t('karni.statement')}</Button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
            <PayPartModal row={paying} onClose={() => setPaying(null)} onPaid={() => { setPaying(null); load(); onChanged?.(); }} />
            <OldKarniModal isOpen={entering} names={(rows || []).map(r => r.name)} onClose={() => { setEntering(false); load(); onChanged?.(); }} />
        </section>
    );
}

/** «خلّص بعض»: what the customer hands over now, against everything they owe. */
function PayPartModal({ row, onClose, onPaid }: { row: KarniBalance | null; onClose: () => void; onPaid: () => void }) {
    const [amount, setAmount] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => { setAmount(''); }, [row?.id]);
    if (!row) return null;
    const value = Number(amount) || 0;
    const pay = async () => {
        if (!(value > 0)) return;
        setBusy(true);
        try {
            const result = await window.electronAPI.karni.payPart({ customerId: row.id, amount: value, method: 'cash' });
            toast.success(t('karni.paid', { amount: formatMoney(result.paid), left: formatMoney(result.left) }));
            onPaid();
        } catch (error) {
            toast.error(translateError(error));
        } finally {
            setBusy(false);
        }
    };
    const half = Math.round(row.owed / 2 / 10) * 10;
    return (
        <Modal isOpen={!!row} onClose={onClose} title={t('karni.payTitle', { name: row.name })} size="sm">
            <ModalBody>
                <p className="text-sm text-zinc-400">{t('karni.owes', { amount: formatMoney(row.owed) })}</p>
                <p className="text-4xl font-bold tabular text-center my-3" data-testid="karni-amount">{formatMoney(value)}</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                    <Button variant="secondary" onClick={() => setAmount(String(row.owed))}>{t('karni.all')}</Button>
                    {half > 0 && half < row.owed && <Button variant="secondary" onClick={() => setAmount(String(half))}>{formatMoney(half)}</Button>}
                </div>
                <NumPad value={amount} onChange={setAmount} onEnter={pay} />
            </ModalBody>
            <ModalFooter>
                <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
                <Button variant="success" onClick={pay} loading={busy} disabled={!(value > 0) || value > row.owed + 0.004} data-testid="karni-confirm">{t('karni.receive')}</Button>
            </ModalFooter>
        </Modal>
    );
}

/** The old paper karni, typed in one name after the other: name, what he owes, since when. */
function OldKarniModal({ isOpen, names, onClose }: { isOpen: boolean; names: string[]; onClose: () => void }) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState('');
    const [added, setAdded] = useState(0);
    const [busy, setBusy] = useState(false);
    useEffect(() => { if (isOpen) { setName(''); setPhone(''); setAmount(''); setDate(''); setAdded(0); } }, [isOpen]);
    const add = async () => {
        const value = Number(amount.replace(',', '.')) || 0;
        if (!name.trim() || !(value > 0)) return;
        setBusy(true);
        try {
            await window.electronAPI.karni.openingDebt({ name, phone, amount: value, date: date || undefined });
            setAdded(n => n + 1);
            // Ready for the next name of the notebook
            setName(''); setPhone(''); setAmount('');
        } catch (error) {
            toast.error(translateError(error));
        } finally {
            setBusy(false);
        }
    };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('karni.oldTitle')} size="md">
            <ModalBody className="space-y-3">
                <p className="text-sm text-zinc-400">{t('karni.oldText')}</p>
                <input className="input w-full" autoFocus list="karni-names" placeholder={t('karni.oldName')} value={name} onChange={(e) => setName(e.target.value)} data-testid="karni-old-name" />
                <datalist id="karni-names">{names.map(n => <option key={n} value={n} />)}</datalist>
                <div className="grid grid-cols-3 gap-2">
                    <input className="input tabular ltr" inputMode="decimal" placeholder={t('karni.oldAmount')} value={amount} onChange={(e) => setAmount(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') add(); }} data-testid="karni-old-amount" />
                    <input className="input ltr" inputMode="tel" placeholder="05 / 06 / 07 …" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    <input className="input ltr" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t('karni.oldDate')} />
                </div>
                {added > 0 && <p className="text-sm text-emerald-300">{t('karni.oldAdded', { n: added })}</p>}
            </ModalBody>
            <ModalFooter>
                <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
                <Button onClick={add} loading={busy} disabled={!name.trim() || !(Number(amount.replace(',', '.')) > 0)} data-testid="karni-old-add">{t('karni.oldAdd')}</Button>
            </ModalFooter>
        </Modal>
    );
}
