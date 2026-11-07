// The distributors (الموزعون): the days each one comes by, the order to give
// him today (sent on WhatsApp), and the quick receiving of what he brought.
// Rules in electron/services/visitOrderService.js and receiveService.js.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Truck, MessageCircle, PackagePlus, Trash2, AlertTriangle } from 'lucide-react';
import { Modal, ModalBody, ModalFooter } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import { t, currentLanguage } from '../i18n';
import { formatMoney } from '../i18n/format';
import { translateError } from '../i18n/errors';
import { orderText, whatsappLink } from '../lib/whatsapp';
import { weightLabel } from '../lib/units';
import { useSettingsStore } from '../stores/settingsStore';
import type { ArticleRow } from '../types/electronAPI';

interface Distributor { id: string; name: string; phone?: string | null; weekdays: number[] }
interface OrderLine { product_id: string; name: string; unit: string; stock: number; quantity: number; cartons?: number; carton_qty?: number; cost: number }
interface ReceiveLine { productId: string; name: string; weighed: boolean; cartonQty: number; quantity: string; byCarton: boolean; unitCost: string; expiresOn: string; invoiceName?: string }

/** Algerian week order: Saturday first (0 = Sunday … 6 = Saturday). */
const WEEK = [6, 0, 1, 2, 3, 4, 5];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = (): any => (window as any).electronAPI.hanout;

export default function DistributorsPage() {
    const [rows, setRows] = useState<Distributor[] | null>(null);
    const [order, setOrder] = useState<{ who: Distributor; lines: OrderLine[] } | null>(null);
    const [receiving, setReceiving] = useState<{ who: Distributor; lines?: OrderLine[] } | null>(null);
    const shopName = useSettingsStore((state: { settings: { businessName?: string } }) => state.settings.businessName) || '';
    const today = new Date().getDay();

    const load = useCallback(async () => {
        try { setRows(await api().visits()); } catch (error) { toast.error(translateError(error)); setRows([]); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const toggleDay = async (who: Distributor, day: number) => {
        const weekdays = who.weekdays.includes(day) ? who.weekdays.filter(d => d !== day) : [...who.weekdays, day];
        try {
            const saved = await api().setVisits({ supplierId: who.id, weekdays });
            setRows(list => (list || []).map(r => (r.id === who.id ? { ...r, weekdays: saved } : r)));
        } catch (error) { toast.error(translateError(error)); }
    };

    const openOrder = async (who: Distributor) => {
        try { setOrder({ who, lines: await api().suggestedOrder(who.id) }); } catch (error) { toast.error(translateError(error)); }
    };

    const sendOrder = async () => {
        if (!order) return;
        const text = orderText({ supplier: order.who.name, shop: shopName, lang: currentLanguage(), lines: order.lines });
        const link = whatsappLink(order.who.phone, text);
        if (!link) { toast.error(t('whatsapp.noPhone')); return; }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const opened = await (window as any).electronAPI.shell.openExternal(link).catch(() => ({ success: false }));
        if (opened?.success === false) toast.error(t('whatsapp.failed'));
    };

    return (
        <div className="page">
            <div className="page-header px-6 py-4 flex items-center gap-3">
                <Truck className="w-6 h-6 text-indigo-300" />
                <div>
                    <h1 className="text-xl font-bold">{t('dist.title')}</h1>
                    <p className="text-sm text-zinc-500">{t('dist.subtitle')}</p>
                </div>
            </div>
            <div className="page-body space-y-3">
                {rows === null ? <p className="text-zinc-500">{t('common.loading')}</p> : rows.length === 0 ? (
                    <p className="text-zinc-500">{t('dist.none')}</p>
                ) : rows.map(who => (
                    <section key={who.id} className="card space-y-3" data-testid="distributor">
                        <div className="flex flex-wrap items-center gap-3">
                            <h2 dir="auto" className="font-semibold text-lg flex-1 min-w-[160px]">
                                {who.name}
                                {who.weekdays.includes(today) && <span className="ms-2 badge bg-emerald-500/20 text-emerald-300">{t('dist.today')}</span>}
                            </h2>
                            <Button variant="secondary" onClick={() => openOrder(who)} data-testid="dist-order"><MessageCircle className="w-4 h-4" /> {t('dist.order')}</Button>
                            <Button onClick={() => setReceiving({ who })} data-testid="dist-receive"><PackagePlus className="w-4 h-4" /> {t('dist.receive')}</Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('dist.days')}>
                            {WEEK.map(day => (
                                <button key={day} type="button" onClick={() => toggleDay(who, day)} aria-pressed={who.weekdays.includes(day)}
                                    className={`px-3 py-1.5 rounded-lg text-sm border ${who.weekdays.includes(day) ? 'border-indigo-400 bg-indigo-500/20 text-indigo-100' : 'border-dark-border text-zinc-400 hover:bg-dark-tertiary'}`}>
                                    {t(`dist.day.${day}`)}
                                </button>
                            ))}
                        </div>
                    </section>
                ))}
            </div>

            <Modal isOpen={!!order} onClose={() => setOrder(null)} title={order ? t('dist.orderTitle', { name: order.who.name }) : ''} size="md">
                <ModalBody>
                    {order && order.lines.length === 0 ? <p className="text-zinc-400">{t('dist.orderNothing')}</p> : (
                        <ul className="divide-y divide-dark-border" data-testid="dist-order-lines">
                            {order?.lines.map(l => (
                                <li key={l.product_id} className="py-2 flex items-center gap-3">
                                    <span dir="auto" className="flex-1">{l.name}</span>
                                    <span className="text-xs text-zinc-500">{t('dist.left', { n: l.unit === 'kg' ? weightLabel(l.stock) : l.stock })}</span>
                                    <span className="font-semibold tabular">{l.cartons ? t('order.cartons', { n: l.cartons }) : l.unit === 'kg' ? weightLabel(l.quantity) : l.quantity}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="secondary" onClick={() => { if (order) setReceiving({ who: order.who, lines: order.lines }); setOrder(null); }} disabled={!order?.lines.length}>{t('dist.receiveOrder')}</Button>
                    <Button onClick={sendOrder} disabled={!order?.lines.length} data-testid="dist-send"><MessageCircle className="w-4 h-4" /> {t('dist.send')}</Button>
                </ModalFooter>
            </Modal>

            <QuickReceive state={receiving} onClose={() => setReceiving(null)} onDone={() => { setReceiving(null); load(); }} />
        </div>
    );
}

/** What the distributor brought: scan or search, quantity, price, expiry; what is paid now. */
function QuickReceive({ state, onClose, onDone }: { state: { who: Distributor; lines?: OrderLine[] } | null; onClose: () => void; onDone: () => void }) {
    const [articles, setArticles] = useState<ArticleRow[]>([]);
    const [lines, setLines] = useState<ReceiveLine[]>([]);
    const [query, setQuery] = useState('');
    const [paid, setPaid] = useState('');
    const [rises, setRises] = useState<{ productId: string; before: number; now: number; percent: number }[]>([]);
    // The name as written on his invoice, already linked to an article of the shop
    const [remembered, setRemembered] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const who = state?.who;

    const lineOf = useCallback(async (p: ArticleRow & { carton_qty?: number | null; cost?: number }, quantity = ''): Promise<ReceiveLine> => {
        const last = who ? await api().lastCost({ supplierId: who.id, productId: p.id }).catch(() => null) : null;
        const weighed = p.unit === 'kg';
        return {
            productId: p.id, name: p.name, weighed, cartonQty: Number(p.carton_qty) > 1 ? Number(p.carton_qty) : 0,
            quantity, byCarton: false, unitCost: String(last ?? p.cost ?? ''), expiresOn: '',
        };
    }, [who]);

    useEffect(() => {
        if (!state) return;
        setQuery(''); setPaid(''); setRises([]);
        (async () => {
            const all = await window.electronAPI.products.getAll();
            setArticles(all.filter(a => a.unit !== 'service'));
            // From the suggested order: its lines, ready to check
            const first = await Promise.all((state.lines || []).map(async l => {
                const p = all.find(a => a.id === l.product_id);
                if (!p) return null;
                const line = await lineOf(p, String(l.unit === 'kg' ? l.quantity / 1000 : l.cartons || l.quantity));
                return { ...line, byCarton: !!l.cartons };
            }));
            setLines(first.filter((x): x is ReceiveLine => !!x));
        })().catch(() => {});
    }, [state, lineOf]);

    useEffect(() => {
        const q = query.trim();
        if (!who || q.length < 2) { setRemembered(null); return undefined; }
        let cancelled = false;
        api().matchName({ supplierId: who.id, name: q }).then((id: string | null) => { if (!cancelled) setRemembered(id); }).catch(() => {});
        return () => { cancelled = true; };
    }, [who, query]);

    const found = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        const byName = articles.filter(a => a.name.toLowerCase().includes(q) || String(a.barcode || '') === q);
        // The article this name on his invoice was linked to last time comes first
        const known = remembered ? articles.find(a => a.id === remembered) : null;
        return (known ? [known, ...byName.filter(a => a.id !== known.id)] : byName).slice(0, 6);
    }, [articles, query, remembered]);

    // Units in stock terms: grams, or pieces (× carton)
    const unitsOf = (l: ReceiveLine) => {
        const q = Number(String(l.quantity).replace(',', '.')) || 0;
        return l.weighed ? Math.round(q * 1000) : Math.round(q * (l.byCarton && l.cartonQty ? l.cartonQty : 1));
    };
    // Price per piece (a carton's price divided) or per kg
    const costOf = (l: ReceiveLine) => {
        const c = Number(String(l.unitCost).replace(',', '.')) || 0;
        return l.byCarton && l.cartonQty ? c / l.cartonQty : c;
    };
    const total = lines.reduce((s, l) => s + (l.weighed ? unitsOf(l) / 1000 : unitsOf(l)) * costOf(l), 0);

    useEffect(() => {
        if (!who || !lines.length) { setRises([]); return; }
        api().priceRises({ supplierId: who.id, lines: lines.map(l => ({ productId: l.productId, unitCost: costOf(l) })) }).then(setRises).catch(() => setRises([]));
    }, [who, lines]);

    const add = async (p: ArticleRow) => {
        const typed = query.trim();
        setQuery('');
        if (lines.some(l => l.productId === p.id)) return;
        // What was typed (his invoice's name) is remembered for this supplier, unless it was a barcode
        const invoiceName = typed && typed !== String(p.barcode || '') ? typed : undefined;
        setLines([...lines, { ...(await lineOf(p, '1')), invoiceName }]);
    };
    const update = (i: number, patch: Partial<ReceiveLine>) => setLines(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));

    const save = async () => {
        if (!who) return;
        setSaving(true);
        try {
            const result = await api().receive({
                supplierId: who.id,
                paid: paid === '' ? Math.round(total * 100) / 100 : Number(paid) || 0,
                lines: lines.filter(l => unitsOf(l) > 0).map(l => ({ productId: l.productId, quantity: unitsOf(l), unitCost: Math.round(costOf(l) * 100) / 100, expiresOn: l.expiresOn || undefined, invoiceName: l.invoiceName })),
            });
            toast.success(t('dist.received', { total: formatMoney(result.total), owed: formatMoney(result.owed) }));
            onDone();
        } catch (error) {
            toast.error(translateError(error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={!!state} onClose={onClose} title={who ? t('dist.receiveTitle', { name: who.name }) : ''} size="xl" closeOnOverlay={false}>
            <ModalBody className="space-y-3">
                <div className="relative">
                    <input className="input w-full" autoFocus placeholder={t('dist.searchInvoice')} value={query} onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && found[0]) add(found[0]); }} data-testid="receive-search" />
                    {found.length > 0 && (
                        <ul className="absolute z-10 mt-1 w-full card p-1 shadow-xl">
                            {found.map(a => (
                                <li key={a.id}><button type="button" className="w-full text-start px-3 py-2 rounded hover:bg-dark-tertiary" onClick={() => add(a)}>
                                    {a.name}{a.id === remembered && <span className="ms-2 text-xs text-emerald-300">{t('dist.fromInvoice')}</span>}
                                </button></li>
                            ))}
                        </ul>
                    )}
                </div>
                {lines.length === 0 ? <p className="text-zinc-500 text-sm">{t('dist.receiveEmpty')}</p> : (
                    <table className="w-full text-sm" data-testid="receive-lines">
                        <thead><tr className="text-zinc-500 text-xs">
                            <th className="text-start p-1">{t('dist.article')}</th><th className="p-1">{t('dist.quantity')}</th>
                            <th className="p-1">{t('dist.cost')}</th><th className="p-1">{t('dist.expiry')}</th><th />
                        </tr></thead>
                        <tbody>
                            {lines.map((l, i) => (
                                <tr key={l.productId} className="border-t border-dark-border">
                                    <td className="p-1" dir="auto">{l.name}</td>
                                    <td className="p-1 whitespace-nowrap">
                                        <input className="input w-20 tabular ltr" inputMode="decimal" value={l.quantity} onChange={(e) => update(i, { quantity: e.target.value })} />
                                        <span className="ms-1 text-xs text-zinc-400">
                                            {l.weighed ? t('pos.kg') : l.cartonQty ? (
                                                <button type="button" className="underline" onClick={() => update(i, { byCarton: !l.byCarton })}>{l.byCarton ? t('dist.cartonsOf', { n: l.cartonQty }) : t('dist.pieces')}</button>
                                            ) : t('dist.pieces')}
                                        </span>
                                    </td>
                                    <td className="p-1"><input className="input w-24 tabular ltr" inputMode="decimal" value={l.unitCost} onChange={(e) => update(i, { unitCost: e.target.value })} /></td>
                                    <td className="p-1"><input className="input w-36 ltr" type="date" value={l.expiresOn} onChange={(e) => update(i, { expiresOn: e.target.value })} /></td>
                                    <td className="p-1"><button type="button" className="text-zinc-500 hover:text-red-400" aria-label={t('common.delete')} onClick={() => setLines(lines.filter((_, k) => k !== i))}><Trash2 className="w-4 h-4" /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {rises.map(r => (
                    <p key={r.productId} className="text-sm text-amber-300 flex items-center gap-2" data-testid="price-rise">
                        <AlertTriangle className="w-4 h-4" /> {t('dist.rise', { name: lines.find(l => l.productId === r.productId)?.name || '', before: formatMoney(r.before), now: formatMoney(r.now), percent: r.percent })}
                    </p>
                ))}
                <div className="flex flex-wrap items-end justify-between gap-3 border-t border-dark-border pt-3">
                    <p className="text-lg">{t('dist.total')}: <span className="font-bold tabular">{formatMoney(total)}</span></p>
                    <label className="text-sm text-zinc-400 flex items-center gap-2">{t('dist.paid')}
                        <input className="input w-32 tabular ltr" inputMode="decimal" placeholder={String(Math.round(total * 100) / 100)} value={paid} onChange={(e) => setPaid(e.target.value)} data-testid="receive-paid" />
                    </label>
                </div>
            </ModalBody>
            <ModalFooter>
                <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
                <Button variant="success" onClick={save} loading={saving} disabled={!lines.some(l => unitsOf(l) > 0)} data-testid="receive-save">{t('dist.save')}</Button>
            </ModalFooter>
        </Modal>
    );
}
