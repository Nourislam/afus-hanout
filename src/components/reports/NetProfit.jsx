// Reports › Net profit (add-on "Charges and net profit", the owner's): what is
// left at the end of the month, how it is counted, and the shop's charges.
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Pencil, Square, TrendingUp, TrendingDown, Wallet, Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Modal, ModalBody } from '../ui/Modal';
import { toast } from '../ui/Toast';
import { useT } from '../../i18n';
import { formatMoney } from '../../i18n/format';
import { translateError } from '../../i18n/errors';
import { useVizColors } from '../../lib/vizColors';

const KINDS = ['rent', 'salary', 'electricity', 'water', 'internet', 'phone', 'tax', 'other'];
const EVERY = [1, 2, 3, 6, 12, 0];
// What an Algerian shop usually pays, and how often
const KIND_EVERY = { rent: 1, salary: 1, electricity: 3, water: 3, internet: 1, phone: 1, tax: 3, other: 1 };

const thisMonth = () => new Date().toISOString().slice(0, 7);
const shiftMonth = (month, by) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + by, 1));
    return d.toISOString().slice(0, 7);
};

function ChargeForm({ charge, employees, onClose, onSaved }) {
    const { t } = useT();
    const [form, setForm] = useState(() => ({
        name: charge?.name || '', kind: charge?.kind || 'rent', amount: charge?.amount ?? '',
        every_months: charge?.every_months ?? KIND_EVERY[charge?.kind] ?? 1, start_date: (charge?.start_date || thisMonth()).slice(0, 7), employee_id: charge?.employee_id || '',
    }));
    const [saving, setSaving] = useState(false);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const save = async () => {
        setSaving(true);
        try {
            await window.electronAPI.charges.save({ ...form, name: form.name.trim() || t(`charges.kind.${form.kind}`), id: charge?.id, amount: Number(form.amount), employee_id: form.kind === 'salary' ? form.employee_id || null : null });
            toast.success(t('charges.saved'));
            onSaved();
        } catch (error) {
            toast.error(translateError(error));
        } finally {
            setSaving(false);
        }
    };
    return (
        <Modal isOpen onClose={onClose} title={charge?.id ? t('charges.edit') : t('charges.add')} size="md">
            <ModalBody className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <Select label={t('charges.kind')} value={form.kind} onChange={(v) => setForm(f => ({ ...f, kind: v, every_months: charge?.id ? f.every_months : KIND_EVERY[v] }))}
                        options={KINDS.map(k => ({ value: k, label: t(`charges.kind.${k}`) }))} />
                    <Input label={t('charges.name')} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={t('charges.namePlaceholder')} data-testid="charge-name" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Input label={t('charges.amount')} type="number" min="0" inputMode="numeric" value={form.amount} onChange={(e) => set('amount', e.target.value)} data-testid="charge-amount" />
                    <Select label={t('charges.every')} value={String(form.every_months)} onChange={(v) => set('every_months', Number(v))}
                        options={EVERY.map(n => ({ value: String(n), label: t(`charges.every.${n}`) }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Input label={t('charges.since')} type="month" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
                    {form.kind === 'salary' && (
                        <Select label={t('charges.employee')} value={form.employee_id} onChange={(v) => set('employee_id', v)}
                            options={[{ value: '', label: t('charges.noEmployee') }, ...employees.map(e => ({ value: e.id, label: e.name }))]} />
                    )}
                </div>
                <div className="flex justify-end gap-2 pt-1">
                    <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
                    <Button onClick={save} loading={saving} data-testid="charge-save">{t('common.save')}</Button>
                </div>
            </ModalBody>
        </Modal>
    );
}

export default function NetProfit() {
    const { t, lang } = useT();
    const viz = useVizColors();
    const [month, setMonth] = useState(thisMonth);
    const [data, setData] = useState(null);
    const [list, setList] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [editing, setEditing] = useState(null);
    const money = (v) => formatMoney(v || 0);
    // + / − before the amount in French; in Arabic the line's name says it (a sign would flip sides)
    const signed = (sign, v) => <span className="tabular whitespace-nowrap">{lang === 'ar' ? money(v) : `${sign} ${money(v)}`}</span>;
    const monthName = (m, short) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-DZ' : 'en-GB', { month: short ? 'short' : 'long', year: short ? undefined : 'numeric', timeZone: 'UTC' }).format(new Date(`${m}-01T00:00:00Z`));

    const load = useCallback(async () => {
        try {
            const [result, charges] = await Promise.all([window.electronAPI.charges.netProfit({ month }), window.electronAPI.charges.list()]);
            setData(result);
            setList(charges);
        } catch (error) {
            toast.error(translateError(error));
        }
    }, [month]);
    useEffect(() => { load(); }, [load]);
    useEffect(() => { window.electronAPI.employees.getAll().then(e => setEmployees((e || []).filter(x => x.is_active !== 0))).catch(() => {}); }, []);

    const stop = async (charge) => {
        if (!window.confirm(t('charges.stopConfirm', { name: charge.name }))) return;
        try {
            await window.electronAPI.charges.stop({ id: charge.id, month: thisMonth() });
            toast.success(t('charges.stopped'));
            load();
        } catch (error) { toast.error(translateError(error)); }
    };

    const net = data?.net || 0;
    const diff = data && data.previousNet !== null ? net - data.previousNet : null;
    const isFuture = month >= thisMonth();
    return (
        <div className="space-y-4" data-testid="net-profit">
            {/* The month */}
            <div className="flex items-center justify-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setMonth(m => shiftMonth(m, -1))} aria-label={t('net.prevMonth')}><ChevronLeft className="w-5 h-5 flip-rtl" /></Button>
                <span className="min-w-[10rem] text-center font-semibold text-lg" data-testid="net-month">{monthName(month)}</span>
                <Button variant="ghost" size="sm" onClick={() => setMonth(m => shiftMonth(m, 1))} disabled={isFuture} aria-label={t('net.nextMonth')}><ChevronRight className="w-5 h-5 flip-rtl" /></Button>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
                {/* What is left, and how it is counted */}
                <Card className="space-y-4">
                    <div className={`rounded-xl p-5 ${net >= 0 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-rose-500/10 border border-rose-500/30'}`}>
                        <p className="text-sm text-zinc-400 flex items-center gap-2"><Wallet className="w-4 h-4" /> {t('net.left')}</p>
                        <p className={`text-4xl font-bold tabular mt-1 ${net >= 0 ? 'text-emerald-300' : 'text-rose-300'}`} data-testid="net-amount">{money(net)}</p>
                        {net < 0 && <p className="text-sm text-rose-300 mt-1">{t('net.loss')}</p>}
                        {diff !== null && (
                            <p className={`text-sm mt-2 flex items-center gap-1 ${diff >= 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                                {diff >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                {t(diff >= 0 ? 'net.more' : 'net.less', { amount: money(Math.abs(diff)) })}
                            </p>
                        )}
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-zinc-300 mb-2">{t('net.howTitle')}</h3>
                        <ul className="divide-y divide-dark-border text-sm" data-testid="net-lines">
                            <li className="flex items-start justify-between gap-3 py-2.5">
                                <span><span className="block font-medium">{t('net.salesProfit')}</span><span className="block text-xs text-zinc-500">{t('net.salesProfitHint')}</span></span>
                                <span className="font-semibold text-emerald-300">{signed('+', data?.salesProfit)}</span>
                            </li>
                            {(data?.charges || []).map(c => (
                                <li key={c.id} className="flex items-start justify-between gap-3 py-2.5">
                                    <span>
                                        <span className="block">{c.name}{c.employee_name ? ` · ${c.employee_name}` : ''}</span>
                                        <span className="block text-xs text-zinc-500">{t(`charges.kind.${c.kind}`)}{c.every_months > 1 ? ` · ${t('net.shared', { every: t(`charges.every.${c.every_months}`) })}` : ''}</span>
                                    </span>
                                    <span className="text-zinc-300">{signed('−', c.amount)}</span>
                                </li>
                            ))}
                            {data?.drawerExpenses > 0 && (
                                <li className="flex items-center justify-between gap-3 py-2.5">
                                    <span>{t('net.drawer')}</span>
                                    <span className="text-zinc-300">{signed('−', data.drawerExpenses)}</span>
                                </li>
                            )}
                            <li className="flex items-center justify-between gap-3 py-3 font-semibold">
                                <span>{t('net.total')}</span>
                                <span className={`tabular whitespace-nowrap ${net >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{money(net)}</span>
                            </li>
                        </ul>
                    </div>
                </Card>

                {/* The last months */}
                <Card className="space-y-2">
                    <h3 className="text-sm font-semibold text-zinc-300">{t('net.months')}</h3>
                    <div className="h-64" role="img" aria-label={t('net.months')}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={(data?.series || []).map(s => ({ ...s, label: monthName(s.month, true) }))} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={viz.grid} vertical={false} />
                                <XAxis dataKey="label" tick={{ fill: viz.text, fontSize: 12 }} axisLine={false} tickLine={false} reversed={lang === 'ar'} />
                                <YAxis tick={{ fill: viz.text, fontSize: 11 }} axisLine={false} tickLine={false} width={64} orientation={lang === 'ar' ? 'right' : 'left'} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                                <Tooltip formatter={(v) => money(v)} contentStyle={{ backgroundColor: 'rgb(var(--surface-1))', border: '1px solid rgb(var(--surface-border))', borderRadius: 8 }} cursor={{ fill: 'rgba(148,163,184,.08)' }} />
                                <Bar dataKey="net" name={t('net.left')} radius={[6, 6, 0, 0]}>
                                    {(data?.series || []).map(s => <Cell key={s.month} fill={s.net >= 0 ? '#34d399' : '#fb7185'} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-zinc-500 flex gap-2 leading-relaxed"><Info className="w-4 h-4 flex-none mt-0.5" /> {t('net.purchaseHint')}</p>
                </Card>
            </div>

            {/* The shop's charges */}
            <Card className="space-y-3" data-testid="charges">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">{t('charges.title')}</h3>
                    <Button onClick={() => setEditing({})} data-testid="charge-add"><Plus className="w-4 h-4" /> {t('charges.add')}</Button>
                </div>
                <p className="text-sm text-zinc-500 leading-relaxed">{t('charges.onlyWhatYouPay')}</p>
                {/* Quick start: only what this shop pays (nothing is assumed) */}
                <div className="flex flex-wrap gap-2" data-testid="charge-suggest">
                    {['rent', 'electricity', 'water', 'salary', 'internet', 'tax'].filter(k => !list.some(c => c.kind === k)).map(k => (
                        <button key={k} type="button" onClick={() => setEditing({ kind: k })}
                            className="inline-flex items-center gap-1.5 rounded-full border border-dark-border px-3 min-h-[40px] text-sm text-zinc-300 hover:border-indigo-400 hover:text-white">
                            <Plus className="w-3.5 h-3.5" /> {t(`charges.kind.${k}`)}
                        </button>
                    ))}
                </div>
                {list.length === 0 ? (
                    <p className="text-sm text-zinc-500 py-2">{t('charges.empty')}</p>
                ) : (
                    <ul className="divide-y divide-dark-border">
                        {list.map(c => (
                            <li key={c.id} className="flex flex-wrap items-center gap-3 py-2.5" data-testid="charge-row">
                                <span className="flex-1 min-w-[12rem]">
                                    <span className="block font-medium">{c.name}{c.employee_name ? ` · ${c.employee_name}` : ''}</span>
                                    <span className="flex flex-wrap gap-x-1.5 text-xs text-zinc-500">
                                        <span>{t(`charges.kind.${c.kind}`)}</span><span aria-hidden>·</span>
                                        <bdi className="tabular-nums">{money(c.amount)}</bdi>
                                        <bdi>{t(`charges.every.${c.every_months}`)}</bdi>
                                    </span>
                                </span>
                                {c.every_months > 0 && <span className="text-sm tabular text-zinc-300 whitespace-nowrap">{t('charges.perMonth', { amount: money(c.amount / c.every_months) })}</span>}
                                <span className="flex gap-1">
                                    <Button size="sm" variant="ghost" onClick={() => setEditing(c)}><Pencil className="w-4 h-4" /> {t('charges.edit')}</Button>
                                    <Button size="sm" variant="ghost" className="text-rose-300" onClick={() => stop(c)}><Square className="w-4 h-4" /> {t('charges.stop')}</Button>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
            {editing && <ChargeForm charge={editing.id || editing.kind ? editing : null} employees={employees} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
        </div>
    );
}
