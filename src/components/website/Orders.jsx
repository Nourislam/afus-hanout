// Website orders page: the orders, the customers and their history, statuses and labels.
import { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle2, Tag, PackageCheck, XCircle, ShoppingBag, Users, Undo2, Printer, PhoneCall, FileDown } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { StatTile } from '../ui/StatTile';
import { toast } from '../ui/Toast';
import { translateError } from '../../i18n/errors';
import { formatDate, formatMoney, formatNumber } from '../../i18n/format';
import { useT } from '../../i18n';

/** The order requests customers sent from the website, newest first (read from the website). */
export function WebsiteOrders() {
    const { t } = useT();
    const [tab, setTab] = useState('orders');
    const [status, setStatus] = useState(null);
    const [state, setState] = useState({ loading: false, data: null });
    const [history, setHistory] = useState(null);
    const [confirming, setConfirming] = useState(null);
    const [labelFor, setLabelFor] = useState(null);
    const load = (st = status) => {
        setState(s => ({ ...s, loading: true }));
        window.electronAPI.website.orders({ status: st }).then((data) => setState({ loading: false, data }), () => setState({ loading: false, data: { ok: false, reason: 'network', orders: [] } }));
    };
    useEffect(() => { load(status); }, [status]);
    const data = state.data;
    const counts = data?.counts || {};
    const all = Object.values(counts).reduce((n, x) => n + x, 0);
    return (
        <section className="card space-y-3 xl:col-span-3" data-testid="website-orders">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-indigo-300" /> {t('website.orders.title')}</h2>
                <div className="flex flex-wrap gap-2">
                    {['orders', 'customers'].map(k => (
                        <Button key={k} size="sm" variant={tab === k ? 'primary' : 'ghost'} onClick={() => setTab(k)} data-testid={`website-orders-tab-${k}`}>
                            {k === 'orders' ? <ShoppingBag className="w-4 h-4" /> : <Users className="w-4 h-4" />} {t(`website.orders.tab.${k}`)}
                        </Button>
                    ))}
                    <Button size="sm" variant="secondary" onClick={() => load()} loading={state.loading} data-testid="website-orders-refresh"><RefreshCw className="w-4 h-4" /> {t('website.orders.refresh')}</Button>
                </div>
            </div>
            <p className="text-xs text-zinc-500">{t('website.orders.hint')}</p>
            {data?.sync?.lastAt && (
                <p className="text-xs text-zinc-400" data-testid="website-orders-sync" data-ok={data.sync.ok ? '1' : '0'}>
                    {data.sync.ok
                        ? t('website.orders.syncOk', { when: formatDate(data.sync.lastAt, 'datetime') })
                        : t('website.orders.syncRetry', { when: formatDate(data.sync.nextAt, 'datetime') })}
                    {data.sync.waiting > 0 && <span className="ms-2 text-amber-300">{t('website.orders.syncWaiting', { n: data.sync.waiting })}</span>}
                    {data.sync.legacy && <span className="block text-amber-300">{t('website.orders.syncLegacy')}</span>}
                </p>
            )}
            {data && (!data.ok || data.synced === false) && data.reason && <p className="text-sm text-amber-300">{t(`website.orders.reason.${data.reason || 'network'}`)}</p>}

            {tab === 'customers' ? <WebsiteCustomers onOpen={setHistory} /> : (
                <>
                    {/* One status at a time, with how many orders are in it */}
                    <div className="flex flex-wrap gap-1.5" data-testid="website-orders-filters">
                        <button type="button" className={`badge cursor-pointer ${!status ? 'bg-indigo-500/20 text-indigo-200' : 'bg-dark-tertiary text-zinc-400'}`} onClick={() => setStatus(null)} data-testid="website-orders-filter-all">
                            {t('website.orders.filterAll')} <bdi>{formatNumber(all)}</bdi>
                        </button>
                        {ORDER_STATUSES.map(st => (
                            <button key={st} type="button" className={`badge cursor-pointer ${status === st ? 'bg-indigo-500/20 text-indigo-200' : 'bg-dark-tertiary text-zinc-400'}`}
                                onClick={() => setStatus(st)} data-testid={`website-orders-filter-${st}`}>
                                {t(`website.orders.status.${st}`)} <bdi>{formatNumber(counts[st] || 0)}</bdi>
                            </button>
                        ))}
                    </div>
                    {data?.ok && data.orders.length === 0 && <p className="text-sm text-zinc-500">{t('website.orders.none')}</p>}
                    {data?.ok && data.orders.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm" data-testid="website-orders-table">
                                <thead className="text-zinc-500 text-xs">
                                    <tr>{['date', 'customer', 'phone', 'article', 'options', 'quantity', 'where', 'status'].map(k => <th key={k} className="text-start font-medium py-2 px-2 whitespace-nowrap">{t(`website.orders.col.${k}`)}</th>)}</tr>
                                </thead>
                                <tbody>
                                    {data.orders.map(o => (
                                <tr key={o.id} className="border-t border-dark-border align-top">
                                    <td className="py-2 px-2 whitespace-nowrap">{formatDate(o.createdAt, 'datetime')}</td>
                                    <td className="py-2 px-2">
                                        <bdi>{o.customerName}</bdi>
                                        {o.customer && <CustomerBadge c={o.customer} onOpen={() => setHistory(o.phoneKey)} />}
                                    </td>
                                    <td className="py-2 px-2"><bdi dir="ltr" className="font-mono">{o.phone}</bdi></td>
                                    {o.items?.length ? (
                                        <td className="py-2 px-2" colSpan={3} data-testid="website-order-items">
                                            <ul className="space-y-1">
                                                {o.items.map((i, n) => (
                                                    <li key={n} className="flex flex-wrap gap-x-2">
                                                        <bdi>{i.productName || i.productId}</bdi>
                                                        {(i.size || i.color) && <span className="text-zinc-400">{[i.size, i.color].filter(Boolean).join(' · ')}</span>}
                                                        <span className="text-zinc-400">× {i.quantity}</span>
                                                        {i.unitPrice !== null && <span className="text-zinc-500"><bdi dir="ltr">{formatMoney(i.unitPrice * i.quantity)}</bdi></span>}
                                                    </li>
                                                ))}
                                            </ul>
                                        </td>
                                    ) : (
                                        <>
                                            <td className="py-2 px-2"><bdi>{o.productName}</bdi></td>
                                            <td className="py-2 px-2 whitespace-nowrap">{[o.size, o.color].filter(Boolean).join(' · ')}</td>
                                            <td className="py-2 px-2">{o.quantity}</td>
                                        </>
                                    )}
                                    <td className="py-2 px-2">
                                        {[o.wilaya, o.commune, o.delivery !== 'office' && o.address].filter(Boolean).join(' — ')}
                                        {o.delivery && <span className="block text-xs text-indigo-300">{t(`website.orders.delivery.${o.delivery}`)}</span>}
                                        {o.courier && (
                                            <span className="block text-xs text-zinc-300" data-testid="website-order-courier">
                                                <bdi>{o.courier.company}</bdi> — <bdi>{o.courier.office}</bdi>
                                                <span className="block text-zinc-500">{[o.courier.wilaya, o.courier.commune].filter(Boolean).join(' — ')}</span>
                                            </span>
                                        )}
                                        {o.note && <span className="block text-xs text-zinc-500">{o.note}</span>}
                                        {/* The money: delivery price, coupon, what the courier collects */}
                                        <span className="block text-xs text-zinc-400 mt-1" data-testid="website-order-money">
                                            {o.deliveryFee !== null && <span className="block">{t('website.orders.deliveryFee')}: <bdi dir="ltr">{formatMoney(o.deliveryFee)}</bdi></span>}
                                            {o.coupon && <span className="block text-emerald-300">{t('website.orders.coupon')} <bdi dir="ltr">{o.coupon.code}</bdi>: <bdi dir="ltr">-{formatMoney(o.coupon.discount)}</bdi></span>}
                                            <span className="block font-semibold text-zinc-200">{t('website.orders.toCollect')}: <bdi dir="ltr">{formatMoney(o.toCollect)}</bdi></span>
                                        </span>
                                    </td>
                                    <td className="py-2 px-2 space-y-2">
                                        <OrderStatus order={o} onChanged={() => load()} onConfirm={setConfirming} onLabel={setLabelFor} />
                                        <OrderTools order={o} onChanged={() => load()} />
                                    </td>
                                </tr>
                            ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
            {history && <CustomerHistory phone={history} onClose={() => setHistory(null)} />}
            {confirming && <ConfirmOrder order={confirming} onClose={() => setConfirming(null)} onDone={(o) => { setConfirming(null); load(); if (o) setLabelFor(o); }} />}
            {labelFor && <ShippingLabel order={labelFor} onClose={() => { setLabelFor(null); load(); }} />}
        </section>
    );
}

/** A customer's figures in one line, under their name (AFUS only). */
function CustomerBadge({ c, onOpen }) {
    const { t } = useT();
    return (
        <button type="button" onClick={onOpen} className="mt-1 flex flex-wrap gap-x-2 text-xs text-start text-zinc-400 hover:text-indigo-200" data-testid="website-order-customer">
            <span>{t('website.customers.ordersN', { n: c.orders })}</span>
            {c.successful > 0 && <span className="text-emerald-300">{t('website.customers.successfulN', { n: c.successful })}</span>}
            {c.returned > 0 && <span className="text-amber-300">{t('website.customers.returnedN', { n: c.returned })}</span>}
            {c.cancelled > 0 && <span className="text-zinc-500">{t('website.customers.cancelledN', { n: c.cancelled })}</span>}
        </button>
    );
}

/** The website's customers, one per phone number; search by name or phone. */
function WebsiteCustomers({ onOpen }) {
    const { t } = useT();
    const [search, setSearch] = useState('');
    const [list, setList] = useState(null);
    useEffect(() => {
        const timer = setTimeout(() => {
            window.electronAPI.website.customers({ search }).then(setList, (e) => { toast.error(translateError(e)); setList([]); });
        }, 200);
        return () => clearTimeout(timer);
    }, [search]);
    return (
        <div className="space-y-3" data-testid="website-customers">
            <input className="input w-full max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('website.customers.search')} data-testid="website-customers-search" />
            {list && list.length === 0 && <p className="text-sm text-zinc-500">{t('website.customers.none')}</p>}
            {list && list.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="website-customers-table">
                        <thead className="text-zinc-500 text-xs">
                            <tr>{['customer', 'phone', 'orders', 'delivered', 'returned', 'cancelled', 'successful', 'total'].map(k => <th key={k} className="text-start font-medium py-2 px-2 whitespace-nowrap">{t(`website.customers.col.${k}`)}</th>)}</tr>
                        </thead>
                        <tbody>
                            {list.map(c => (
                                <tr key={c.phone} className="border-t border-dark-border cursor-pointer hover:bg-dark-tertiary/40" onClick={() => onOpen(c.phone)} data-testid="website-customer-row">
                                    <td className="py-2 px-2"><bdi>{c.name}</bdi></td>
                                    <td className="py-2 px-2"><bdi dir="ltr" className="font-mono">{c.phone}</bdi></td>
                                    <td className="py-2 px-2">{formatNumber(c.orders)}</td>
                                    <td className="py-2 px-2">{formatNumber(c.delivered)}</td>
                                    <td className="py-2 px-2 text-amber-300">{formatNumber(c.returned)}</td>
                                    <td className="py-2 px-2 text-zinc-400">{formatNumber(c.cancelled)}</td>
                                    <td className="py-2 px-2 text-emerald-300">{formatNumber(c.successful)}</td>
                                    <td className="py-2 px-2 whitespace-nowrap"><bdi dir="ltr">{formatMoney(c.total)}</bdi></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

/** One customer (by phone): their figures, every order and the statuses it went through. */
function CustomerHistory({ phone, onClose }) {
    const { t } = useT();
    const [h, setH] = useState(null);
    useEffect(() => {
        window.electronAPI.website.customerHistory({ phone }).then(setH, (e) => { toast.error(translateError(e)); onClose(); });
    }, [phone]);
    return (
        <Modal isOpen onClose={onClose} title={t('website.customers.history')} size="lg">
            {!h ? <p className="text-sm text-zinc-500">…</p> : (
                <div className="space-y-4" data-testid="website-customer-history">
                    <div>
                        <p className="font-semibold"><bdi>{h.name}</bdi></p>
                        <p className="text-sm text-zinc-400"><bdi dir="ltr" className="font-mono">{h.phone}</bdi></p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid="website-customer-stats">
                        <StatTile icon={ShoppingBag} label={t('website.customers.col.orders')} value={formatNumber(h.orders)} />
                        <StatTile icon={PackageCheck} label={t('website.customers.col.delivered')} value={formatNumber(h.delivered)} iconTone="bg-sky-500/15 text-sky-300" />
                        <StatTile icon={Undo2} label={t('website.customers.col.returned')} value={formatNumber(h.returned)} iconTone="bg-amber-500/15 text-amber-300" />
                        <StatTile icon={XCircle} label={t('website.customers.col.cancelled')} value={formatNumber(h.cancelled)} />
                        <StatTile icon={CheckCircle2} label={t('website.customers.col.successful')} value={formatNumber(h.successful)} iconTone="bg-emerald-500/15 text-emerald-300" />
                        <StatTile icon={Tag} label={t('website.customers.col.total')} value={formatMoney(h.total)} iconTone="bg-emerald-500/15 text-emerald-300" />
                    </div>
                    <p className="text-xs text-zinc-500">{t('website.customers.privateHint')}</p>
                    <ul className="space-y-2" data-testid="website-customer-orders">
                        {h.list.map(o => (
                            <li key={o.id} className="rounded-lg bg-dark-tertiary/50 p-3 space-y-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-sm">{formatDate(o.createdAt, 'datetime')}</span>
                                    <span className="badge bg-dark-tertiary text-zinc-200" data-status={o.status}>{t(`website.orders.status.${o.status}`)}</span>
                                </div>
                                <p className="text-sm text-zinc-300">
                                    {o.items.map(i => `${i.productName || i.productId}${[i.size, i.color].filter(Boolean).length ? ` (${[i.size, i.color].filter(Boolean).join(' · ')})` : ''} × ${i.quantity}`).join('، ')}
                                    {o.total > 0 && <span className="ms-2 text-zinc-400"><bdi dir="ltr">{formatMoney(o.total)}</bdi></span>}
                                    {o.receipt && <span className="ms-2 text-xs text-zinc-500">{t('website.orders.ticket')} <bdi dir="ltr">{o.receipt}</bdi></span>}
                                </p>
                                <p className="text-xs text-zinc-500">
                                    {o.events.map((e, n) => <span key={n} className="me-2 whitespace-nowrap">{t(`website.orders.status.${e.status}`)} <bdi>{formatDate(e.at, 'datetime')}</bdi>{n < o.events.length - 1 ? ' ←' : ''}</span>)}
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </Modal>
    );
}

const ORDER_STATUSES = ['new', 'contacted', 'confirmed', 'preparing', 'shipped', 'delivered', 'money_received', 'returned', 'cancelled'];

/**
 * Where a website order is (cash on delivery). Only "Money received" makes it
 * a sale: AFUS then records it once (ticket, stock out) and it can no longer
 * change; asked to confirm first.
 */
function OrderStatus({ order, onChanged, onConfirm, onLabel }) {
    const { t } = useT();
    const [asking, setAsking] = useState(false);
    const [inspecting, setInspecting] = useState(false);
    const [busy, setBusy] = useState(false);
    const final = order.status === 'money_received';
    const change = (status) => {
        setBusy(true);
        window.electronAPI.website.setOrderStatus({ id: order.id, status }).then((r) => {
            setBusy(false); setAsking(false);
            onChanged(r.order);
            if (r.sale) toast.success(t('website.orders.saleRecorded', { receipt: r.sale.receipt }));
        }, (e) => { setBusy(false); setAsking(false); toast.error(translateError(e)); });
    };
    if (final) {
        return (
            <span className="space-y-1 block" data-testid="website-order-status" data-status={order.status}>
                <span className="badge bg-emerald-500/15 text-emerald-300 whitespace-nowrap">{t('website.orders.status.money_received')}</span>
                {order.receipt && <span className="block text-xs text-zinc-500 whitespace-nowrap">{t('website.orders.ticket')} <bdi dir="ltr">{order.receipt}</bdi></span>}
                <Button size="sm" variant="ghost" onClick={() => onLabel(order)} data-testid="website-order-label"><Printer className="w-4 h-4" /> {t('website.label.print')}</Button>
            </span>
        );
    }
    const canConfirm = ['new', 'contacted'].includes(order.status);
    // Only the steps the order can take now (the order book says which)
    const choices = ORDER_STATUSES.filter(st => st === order.status || (order.next || []).includes(st));
    const checked = order.status === 'returned' && order.returnCheckedAt;
    const back = (order.items || []).reduce((n, i) => n + i.returnedSellable, 0);
    const damaged = (order.items || []).reduce((n, i) => n + i.returnedDamaged, 0);
    return (
        <span className="space-y-1 block min-w-[9rem]" data-testid="website-order-status" data-status={order.status}>
            <select className="input py-1 text-xs" value={asking ? 'money_received' : order.status} disabled={busy}
                aria-label={t('website.orders.col.status')} data-testid="website-order-status-select"
                onChange={(e) => {
                    const next = e.target.value;
                    if (next === 'money_received') return setAsking(true);
                    setAsking(false);
                    // Confirmed: after the call (what the customer confirmed, then the pieces are put aside)
                    if (next === 'confirmed' && canConfirm) return onConfirm(order);
                    return change(next);
                }}>
                {choices.map(st => <option key={st} value={st}>{t(`website.orders.status.${st}`)}</option>)}
            </select>
            {order.returnPending && <span className="block text-xs text-amber-300" data-testid="website-order-return-pending">{t('website.returns.pendingHint')}</span>}
            {order.reserved && !order.returnPending && <span className="block text-xs text-sky-300" data-testid="website-order-reserved">{t('website.orders.reservedHint')}</span>}
            {['shipped', 'delivered'].includes(order.status) && <span className="block text-xs text-zinc-500" data-testid="website-order-not-sale">{t('website.orders.notSaleYet')}</span>}
            {checked && <span className="block text-xs text-zinc-400" data-testid="website-order-return-checked">{t('website.returns.checkedHint', { back, damaged })}</span>}
            {order.number && <span className="block text-xs text-zinc-500"><bdi dir="ltr">{order.number}</bdi></span>}
            <span className="flex flex-wrap gap-1">
                {canConfirm && <Button size="sm" variant="secondary" onClick={() => onConfirm(order)} data-testid="website-order-confirm"><PhoneCall className="w-4 h-4" /> {t('website.confirm.open')}</Button>}
                {order.returnPending && <Button size="sm" variant="secondary" onClick={() => setInspecting(true)} data-testid="website-order-check-return"><PackageCheck className="w-4 h-4" /> {t('website.returns.open')}</Button>}
                {!canConfirm && !['cancelled', 'returned'].includes(order.status) && <Button size="sm" variant="ghost" onClick={() => onLabel(order)} data-testid="website-order-label"><Printer className="w-4 h-4" /> {t('website.label.print')}</Button>}
            </span>
            {inspecting && <CheckReturn order={order} onClose={() => setInspecting(false)} onDone={(o) => { setInspecting(false); onChanged(o); }} />}
            {asking && (
                <span className="block space-y-1 rounded-lg bg-dark-tertiary/60 p-2">
                    <span className="block text-xs text-zinc-400">{t('website.orders.confirmMoney')}</span>
                    <span className="flex gap-1">
                        <Button size="sm" onClick={() => change('money_received')} loading={busy} data-testid="website-order-money-confirm">{t('website.orders.recordSale')}</Button>
                        <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>{t('common.cancel')}</Button>
                    </span>
                </span>
            )}
        </span>
    );
}

/**
 * The returned parcel is in the shop: each piece is checked. The sellable
 * ones go back in stock (the same colour / size), the damaged ones stay out.
 * No sale, no refund: the order was never paid.
 */
function CheckReturn({ order, onClose, onDone }) {
    const { t } = useT();
    const lines = order.items.filter(i => i.reserved > 0);
    const [counts, setCounts] = useState(() => Object.fromEntries(lines.map(i => [i.line, { sellable: String(i.reserved), damaged: '0' }])));
    const [busy, setBusy] = useState(false);
    const set = (line, key, value) => setCounts(c => {
        const pieces = lines.find(i => i.line === line).reserved;
        const n = Math.max(0, Math.min(pieces, parseInt(value, 10) || 0));
        // The two always add up to the pieces of the line
        return { ...c, [line]: key === 'sellable' ? { sellable: String(n), damaged: String(pieces - n) } : { sellable: String(pieces - n), damaged: String(n) } };
    });
    const save = () => {
        setBusy(true);
        window.electronAPI.website.checkReturn({ id: order.id, lines: lines.map(i => ({ line: i.line, sellable: Number(counts[i.line].sellable), damaged: Number(counts[i.line].damaged) })) })
            .then((r) => { setBusy(false); toast.success(t('website.returns.done')); onDone(r.order); }, (e) => { setBusy(false); toast.error(translateError(e)); });
    };
    return (
        <Modal isOpen onClose={onClose} title={t('website.returns.title', { number: order.number || '' })} size="md">
            <div className="space-y-3" data-testid="website-check-return">
                <p className="text-sm text-zinc-400">{t('website.returns.intro')}</p>
                <table className="w-full text-sm">
                    <thead className="text-xs text-zinc-500">
                        <tr>
                            <th className="text-start font-medium py-1">{t('website.returns.article')}</th>
                            <th className="text-start font-medium py-1">{t('website.returns.sellable')}</th>
                            <th className="text-start font-medium py-1">{t('website.returns.damaged')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map(i => (
                            <tr key={i.line} className="border-t border-dark-border" data-testid="website-check-return-line">
                                <td className="py-2 pe-2">
                                    <bdi>{i.productName || i.productId}</bdi>
                                    <span className="block text-xs text-zinc-400">{[i.size, i.color].filter(Boolean).join(' · ')} × {i.reserved}</span>
                                </td>
                                <td className="py-2 pe-2"><input type="number" min="0" max={i.reserved} className="input w-20 py-1" value={counts[i.line].sellable} onChange={(e) => set(i.line, 'sellable', e.target.value)} data-testid="website-check-return-sellable" /></td>
                                <td className="py-2"><input type="number" min="0" max={i.reserved} className="input w-20 py-1" value={counts[i.line].damaged} onChange={(e) => set(i.line, 'damaged', e.target.value)} data-testid="website-check-return-damaged" /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p className="text-xs text-zinc-500">{t('website.returns.hint')}</p>
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
                    <Button onClick={save} loading={busy} data-testid="website-check-return-save"><PackageCheck className="w-4 h-4" /> {t('website.returns.save')}</Button>
                </div>
            </div>
        </Modal>
    );
}

/**
 * The call to the customer (COD): check each line (size, colour, quantity,
 * price), the wilaya, commune and the address or courier office, then
 * Confirm: the pieces are put aside (no sale yet). "Contacted" keeps the
 * order waiting (no answer, call back later).
 */
function ConfirmOrder({ order, onClose, onDone }) {
    const { t } = useT();
    const [choices, setChoices] = useState(null);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState(() => ({
        lines: order.items.map(i => ({ line: i.line, productName: i.productName, size: i.size, color: i.color, quantity: String(i.quantity), unit_price: i.unitPrice === null ? '' : String(i.unitPrice), keep: true })),
        wilaya: order.wilaya, commune: order.commune, delivery: order.delivery === 'office' ? 'office' : 'home', address: order.address,
        courier_company: order.courier?.company || '', office_wilaya: order.courier?.wilaya || '', office_commune: order.courier?.commune || '', courier_office: order.courier?.office || '',
    }));
    useEffect(() => { window.electronAPI.website.orderChoices({ id: order.id }).then(setChoices, () => setChoices({ lines: {}, wilayas: [], couriers: [] })); }, [order.id]);
    const setLine = (n, patch) => setForm(f => ({ ...f, lines: f.lines.map((l, i) => (i === n ? { ...l, ...patch } : l)) }));
    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
    const details = () => ({
        ...form,
        lines: form.lines.filter(l => l.keep).map(l => ({ line: l.line, size: l.size, color: l.color, quantity: Number(l.quantity), unit_price: l.unit_price === '' ? null : Number(l.unit_price) })),
    });
    const total = form.lines.filter(l => l.keep).reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0);
    const run = (fn, after) => {
        setBusy(true);
        fn().then((r) => { setBusy(false); after(r); }, (e) => { setBusy(false); toast.error(translateError(e)); });
    };
    const contacted = () => run(() => window.electronAPI.website.setOrderStatus({ id: order.id, status: 'contacted' }), () => { toast.success(t('website.confirm.contactedDone')); onDone(null); });
    const confirm = () => run(() => window.electronAPI.website.confirmOrder({ id: order.id, details: details() }), (r) => { toast.success(t('website.confirm.done', { number: r.order.number })); onDone(r.order); });
    const field = 'input w-full';
    return (
        <Modal isOpen onClose={onClose} title={t('website.confirm.title', { number: order.number })} size="lg">
            <div className="space-y-4" data-testid="website-confirm">
                <p className="text-sm text-zinc-300 leading-relaxed">{t('website.confirm.call')} <a className="font-mono text-indigo-300" dir="ltr" href={`tel:${order.phone}`}>{order.phone}</a> — <bdi>{order.customerName}</bdi></p>
                <p className="text-xs text-zinc-500">{t('website.confirm.checklist')}</p>
                <div className="space-y-2">
                    {form.lines.map((l, n) => {
                        const c = choices?.lines?.[l.line];
                        const variants = c?.variants || [];
                        const chosen = variants.find(v => v.color === l.color && v.size === l.size);
                        const avail = variants.length ? (chosen ? chosen.stock + (c.reserved || 0) : 0) : c?.stock;
                        return (
                            <div key={l.line} className={`rounded-lg bg-dark-tertiary/50 p-3 space-y-2 ${l.keep ? '' : 'opacity-50'}`} data-testid="website-confirm-line">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium"><bdi>{l.productName}</bdi></span>
                                    <label className="text-xs text-zinc-400 flex items-center gap-1"><input type="checkbox" checked={l.keep} onChange={(e) => setLine(n, { keep: e.target.checked })} /> {t('website.confirm.keepLine')}</label>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {variants.length > 0 && (
                                        <label className="col-span-2 space-y-1"><span className="text-xs text-zinc-400">{t('website.confirm.sizeColor')}</span>
                                            <select className={field} value={`${l.color}\u0000${l.size}`} onChange={(e) => { const [color, size] = e.target.value.split('\u0000'); setLine(n, { color, size }); }} data-testid="website-confirm-variant">
                                                {!chosen && <option value={`${l.color}\u0000${l.size}`}>{[l.size, l.color].filter(Boolean).join(' · ')} — {t('website.confirm.notInCatalogue')}</option>}
                                                {variants.map(v => <option key={`${v.color}|${v.size}`} value={`${v.color}\u0000${v.size}`}>{[v.size, v.color].filter(Boolean).join(' · ')} ({t('website.confirm.inStock', { n: v.stock + (v.color === l.color && v.size === l.size ? c.reserved : 0) })})</option>)}
                                            </select>
                                        </label>
                                    )}
                                    <label className="space-y-1"><span className="text-xs text-zinc-400">{t('website.orders.col.quantity')}</span>
                                        <input className={field} type="number" min="1" max="20" value={l.quantity} onChange={(e) => setLine(n, { quantity: e.target.value })} data-testid="website-confirm-qty" /></label>
                                    <label className="space-y-1"><span className="text-xs text-zinc-400">{t('website.confirm.price')}</span>
                                        <input className={field} type="number" min="0" step="10" value={l.unit_price} onChange={(e) => setLine(n, { unit_price: e.target.value })} dir="ltr" data-testid="website-confirm-price" /></label>
                                </div>
                                {avail !== null && avail !== undefined && <p className={`text-xs ${Number(l.quantity) > avail ? 'text-red-400' : 'text-zinc-500'}`}>{t('website.confirm.available', { n: avail })}</p>}
                            </div>
                        );
                    })}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <label className="space-y-1"><span className="text-xs text-zinc-400">{t('website.confirm.wilaya')}</span>
                        <input className={field} list="website-wilayas" value={form.wilaya} onChange={set('wilaya')} data-testid="website-confirm-wilaya" /></label>
                    <label className="space-y-1"><span className="text-xs text-zinc-400">{t('website.confirm.commune')}</span>
                        <input className={field} value={form.commune} onChange={set('commune')} data-testid="website-confirm-commune" /></label>
                    <datalist id="website-wilayas">{(choices?.wilayas || []).map(w => <option key={w} value={w} />)}</datalist>
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                    {['home', 'office'].map(d => (
                        <label key={d} className="flex items-center gap-2"><input type="radio" name="delivery" checked={form.delivery === d} onChange={() => setForm(f => ({ ...f, delivery: d }))} /> {t(`website.orders.delivery.${d}`)}</label>
                    ))}
                </div>
                {form.delivery === 'home' ? (
                    <label className="block space-y-1"><span className="text-xs text-zinc-400">{t('website.confirm.address')}</span>
                        <input className={field} value={form.address} onChange={set('address')} data-testid="website-confirm-address" /></label>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <label className="space-y-1"><span className="text-xs text-zinc-400">{t('website.confirm.courier')}</span>
                            <input className={field} list="website-couriers" value={form.courier_company} onChange={set('courier_company')} data-testid="website-confirm-courier" /></label>
                        <label className="space-y-1"><span className="text-xs text-zinc-400">{t('website.confirm.office')}</span>
                            <input className={field} value={form.courier_office} onChange={set('courier_office')} data-testid="website-confirm-office" /></label>
                        <label className="space-y-1"><span className="text-xs text-zinc-400">{t('website.confirm.officeWilaya')}</span>
                            <input className={field} list="website-wilayas" value={form.office_wilaya} onChange={set('office_wilaya')} /></label>
                        <label className="space-y-1"><span className="text-xs text-zinc-400">{t('website.confirm.officeCommune')}</span>
                            <input className={field} value={form.office_commune} onChange={set('office_commune')} /></label>
                        <datalist id="website-couriers">{(choices?.couriers || []).map(c => <option key={c} value={c} />)}</datalist>
                    </div>
                )}
                <div className="flex items-center justify-between border-t border-dark-border pt-3">
                    <span className="text-sm text-zinc-400">{t('website.confirm.totalCod')}</span>
                    <span className="text-lg font-bold" data-testid="website-confirm-total"><bdi dir="ltr">{formatMoney(total)}</bdi></span>
                </div>
                <p className="text-xs text-sky-300">{t('website.confirm.reserveHint')}</p>
                <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
                    {order.status === 'new' && <Button variant="secondary" onClick={contacted} loading={busy} data-testid="website-confirm-contacted">{t('website.confirm.contacted')}</Button>}
                    <Button onClick={confirm} loading={busy} disabled={!form.lines.some(l => l.keep)} data-testid="website-confirm-save"><CheckCircle2 className="w-4 h-4" /> {t('website.confirm.save')}</Button>
                </div>
            </div>
        </Modal>
    );
}

/** The shipping label (100 x 150 mm): seen here, printed on any printer, or saved as PDF. */
function ShippingLabel({ order, onClose }) {
    const { t } = useT();
    const [html, setHtml] = useState('');
    const [busy, setBusy] = useState(null);
    useEffect(() => { window.electronAPI.website.labelHtml({ id: order.id }).then(setHtml, (e) => { toast.error(translateError(e)); onClose(); }); }, [order.id]);
    const run = (key, fn, ok) => {
        setBusy(key);
        fn().then((r) => { setBusy(null); if (r) toast.success(ok); }, (e) => { setBusy(null); toast.error(translateError(e)); });
    };
    return (
        <Modal isOpen onClose={onClose} title={t('website.label.title', { number: order.number })} size="lg">
            <div className="space-y-3" data-testid="website-label">
                <div className="flex justify-center bg-white rounded-lg p-2 overflow-auto">
                    {/* No script in the label: a sandboxed frame without scripts */}
                    {html && <iframe title={t('website.label.title', { number: order.number })} sandbox="" srcDoc={html} className="bg-white" style={{ width: '100mm', height: '150mm', border: 0 }} data-testid="website-label-frame" />}
                </div>
                <p className="text-xs text-zinc-500">{t('website.label.hint')}</p>
                <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="ghost" onClick={onClose}>{t('common.close')}</Button>
                    <Button variant="secondary" onClick={() => run('pdf', () => window.electronAPI.website.saveLabelPdf({ id: order.id }), t('website.label.saved'))} loading={busy === 'pdf'} data-testid="website-label-pdf"><FileDown className="w-4 h-4" /> {t('website.label.pdf')}</Button>
                    <Button onClick={() => run('print', () => window.electronAPI.website.printLabel({ id: order.id }), t('website.label.printed'))} loading={busy === 'print'} data-testid="website-label-print"><Printer className="w-4 h-4" /> {t('website.label.print')}</Button>
                </div>
            </div>
        </Modal>
    );
}


/**
 * Under an order's status: the WhatsApp message to the customer (the shop's
 * own words), the parcel's tracking number (typed, or given by Yalidine when
 * it is linked) and the courier's page of it.
 */
function OrderTools({ order, onChanged }) {
    const { t } = useT();
    const [busy, setBusy] = useState('');
    const [number, setNumber] = useState(order.trackingNumber || '');
    const [linked, setLinked] = useState(false);
    useEffect(() => { setNumber(order.trackingNumber || ''); }, [order.trackingNumber]);
    useEffect(() => { window.electronAPI.website.getState().then(v => setLinked(!!v?.tools?.yalidine?.linked)).catch(() => {}); }, []);
    const go = async (id, fn, ok) => {
        setBusy(id);
        try { await fn(); if (ok) toast.success(ok); onChanged?.(); } catch (e) { toast.error(translateError(e)); } finally { setBusy(''); }
    };
    return (
        <div className="space-y-1.5 min-w-[11rem]" data-testid="website-order-tools">
            <Button size="sm" variant="secondary" className="w-full" loading={busy === 'wa'} data-testid={`website-order-whatsapp-${order.number}`}
                onClick={() => go('wa', () => window.electronAPI.website.confirmMessage({ id: order.id, open: true }))}>
                <PhoneCall className="w-4 h-4" /> {t('website.orders.whatsappConfirm')}
            </Button>
            <div className="flex gap-1">
                <input className="input input-sm flex-1 min-w-0 font-mono" dir="ltr" value={number} onChange={(e) => setNumber(e.target.value)} placeholder={t('website.orders.trackingPh')}
                    aria-label={t('website.orders.tracking')} maxLength={40} data-testid={`website-order-tracking-${order.number}`} />
                <Button size="sm" variant="ghost" loading={busy === 'tr'} disabled={number === (order.trackingNumber || '')}
                    onClick={() => go('tr', () => window.electronAPI.website.setTracking({ id: order.id, number }), t('website.orders.trackingSaved'))} data-testid={`website-order-tracking-save-${order.number}`}>
                    {t('common.save')}
                </Button>
            </div>
            {order.trackingUrl && (
                <button type="button" className="text-xs text-indigo-300 underline" onClick={() => window.electronAPI.website.openTracking(order.trackingUrl)}>{t('website.orders.trackingOpen')}</button>
            )}
            {linked && order.delivery === 'home' && !order.trackingNumber && ['confirmed', 'preparing'].includes(order.status) && (
                <Button size="sm" variant="ghost" className="w-full" loading={busy === 'ya'} data-testid={`website-order-yalidine-${order.number}`}
                    onClick={() => go('ya', () => window.electronAPI.website.yalidineSend({ id: order.id }), t('website.orders.yalidineSent'))}>
                    {t('website.orders.yalidineSend')}
                </Button>
            )}
            {linked && order.trackingNumber && (
                <button type="button" className="text-xs text-zinc-400 underline" onClick={() => go('yr', () => window.electronAPI.website.yalidineRefresh({ id: order.id }))}>
                    {t('website.orders.courierRefresh')}
                </button>
            )}
            {order.courierState && <span className="block text-xs text-sky-300" data-testid="website-order-courier-state">{order.courierState}</span>}
        </div>
    );
}
