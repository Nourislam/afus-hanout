// Employees › Goals and commissions (add-on "Commissions and best employee", the owner's):
// the employee of the month, the month's ranking, each one's goal and commission.
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Trophy, Target, Info, Settings2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal, ModalBody } from '../ui/Modal';
import { toast } from '../ui/Toast';
import { useT } from '../../i18n';
import { formatMoney } from '../../i18n/format';
import { translateError } from '../../i18n/errors';

const KINDS = ['none', 'percent', 'piece'];
const thisMonth = () => new Date().toISOString().slice(0, 7);
const shiftMonth = (month, by) => {
    const [y, m] = month.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
};

function RuleForm({ row, onClose, onSaved }) {
    const { t } = useT();
    const [kind, setKind] = useState(row.kind || 'none');
    const [rate, setRate] = useState(row.rate || '');
    const [goal, setGoal] = useState(row.goal || '');
    const [saving, setSaving] = useState(false);
    const save = async () => {
        setSaving(true);
        try {
            await window.electronAPI.commissions.saveRule({ employee_id: row.id, kind, rate: Number(rate) || 0, monthly_goal: Number(goal) || 0 });
            toast.success(t('goals.saved'));
            onSaved();
        } catch (error) {
            toast.error(translateError(error));
        } finally {
            setSaving(false);
        }
    };
    return (
        <Modal isOpen onClose={onClose} title={`${t('goals.set')} · ${row.name}`} size="md">
            <ModalBody className="space-y-4">
                <div>
                    <p className="text-sm font-medium mb-2">{t('goals.kind')}</p>
                    <div className="segmented w-full" data-testid="goal-kind">
                        {KINDS.map(k => (
                            <button key={k} type="button" className={`flex-1 ${kind === k ? 'active' : ''}`} onClick={() => setKind(k)}>{t(`goals.kind.${k}`)}</button>
                        ))}
                    </div>
                </div>
                {kind !== 'none' && (
                    <Input label={t(`goals.rate.${kind}`)} type="number" min="0" step={kind === 'percent' ? '0.5' : '10'} inputMode="decimal"
                        value={rate} onChange={(e) => setRate(e.target.value)} data-testid="goal-rate" autoFocus />
                )}
                <div>
                    <Input label={t('goals.monthlyGoal')} type="number" min="0" inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value)} data-testid="goal-goal" />
                    <p className="text-xs text-zinc-500 mt-1">{t('goals.monthlyGoalHint')}</p>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                    <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
                    <Button onClick={save} loading={saving} data-testid="goal-save">{t('common.save')}</Button>
                </div>
            </ModalBody>
        </Modal>
    );
}

function GoalBar({ percent }) {
    const width = Math.min(100, Math.max(0, percent));
    const tone = percent >= 100 ? 'bg-emerald-400' : percent >= 60 ? 'bg-indigo-400' : 'bg-amber-400';
    return (
        <div className="h-2 rounded-full bg-zinc-800 overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
        </div>
    );
}

export default function CommissionsBoard() {
    const { t, lang } = useT();
    const [month, setMonth] = useState(thisMonth);
    const [data, setData] = useState(null);
    const [editing, setEditing] = useState(null);
    const money = (v) => formatMoney(v || 0);
    const monthName = (m) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-DZ' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${m}-01T00:00:00Z`));

    const load = useCallback(async () => {
        try { setData(await window.electronAPI.commissions.board({ month })); } catch (error) { toast.error(translateError(error)); }
    }, [month]);
    useEffect(() => { load(); }, [load]);

    const rows = data?.rows || [];
    const best = rows.find(r => r.id === data?.best);
    const ruleText = (r) => (r.kind === 'percent' ? `${r.rate}%` : r.kind === 'piece' ? `${money(r.rate)} / ${t('goals.kind.piece')}` : t('goals.noCommission'));

    return (
        <div className="space-y-4" data-testid="commissions">
            <div className="flex items-center justify-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setMonth(m => shiftMonth(m, -1))} aria-label={t('net.prevMonth')}><ChevronLeft className="w-5 h-5 flip-rtl" /></Button>
                <span className="min-w-[10rem] text-center font-semibold text-lg">{monthName(month)}</span>
                <Button variant="ghost" size="sm" onClick={() => setMonth(m => shiftMonth(m, 1))} disabled={month >= thisMonth()} aria-label={t('net.nextMonth')}><ChevronRight className="w-5 h-5 flip-rtl" /></Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                {/* Employee of the month */}
                <Card className="flex items-center gap-4" data-testid="best-employee">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-none ${best ? 'bg-amber-400/15 text-amber-300' : 'bg-zinc-800 text-zinc-500'}`}>
                        <Trophy className="w-8 h-8" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm text-zinc-400">{t('goals.best')}</p>
                        {best ? (
                            <>
                                <p className="text-2xl font-bold truncate">{best.name}</p>
                                <p className="text-sm text-zinc-400"><bdi className="tabular">{money(best.net)}</bdi> · {best.pieces} {t('goals.pieces')}</p>
                            </>
                        ) : <p className="text-lg text-zinc-400">{t('goals.bestNone')}</p>}
                    </div>
                </Card>
                {/* What the shop pays in commissions */}
                <Card className="flex flex-col justify-center">
                    <p className="text-sm text-zinc-400">{t('goals.total')}</p>
                    <p className="text-3xl font-bold tabular mt-1" data-testid="commissions-total">{money(data?.totalCommissions)}</p>
                    <p className="text-xs text-zinc-500 mt-2 flex gap-1.5"><Info className="w-3.5 h-3.5 flex-none mt-0.5" /> {t('goals.how')}</p>
                </Card>
            </div>

            <Card className="p-0 overflow-hidden">
                <h3 className="font-semibold px-4 pt-4 pb-2">{t('goals.ranking')}</h3>
                <ul className="divide-y divide-dark-border">
                    {rows.map((r, i) => (
                        <li key={r.id} className="px-4 py-3 grid gap-3 items-center md:grid-cols-[2.25rem_minmax(6rem,1.3fr)_repeat(3,minmax(4.5rem,0.7fr))_minmax(7.5rem,1.2fr)_minmax(6rem,0.9fr)_auto]" data-testid="goal-row">
                            <span className={`w-9 h-9 rounded-full flex items-center justify-center font-bold ${i === 0 && r.id === data?.best ? 'bg-amber-400/20 text-amber-300' : 'bg-zinc-800 text-zinc-400'}`}>{i + 1}</span>
                            <span className="font-medium truncate" title={r.name}>{r.name}</span>
                            <span className="text-sm"><span className="block text-xs text-zinc-500">{t('goals.net')}</span><bdi className="tabular font-semibold">{money(r.net)}</bdi></span>
                            <span className="text-sm"><span className="block text-xs text-zinc-500">{t('goals.pieces')} · {t('goals.tickets')}</span><span className="tabular">{r.pieces} · {r.tickets}</span></span>
                            <span className="text-sm"><span className="block text-xs text-zinc-500">{t('goals.returns')}</span><span className={`tabular ${r.returnRate > 15 ? 'text-amber-300' : ''}`}>{r.returnRate}%</span></span>
                            <span className="text-sm">
                                <span className="flex justify-between text-xs text-zinc-500"><span className="flex items-center gap-1"><Target className="w-3 h-3" /> {t('goals.goal')}</span>{r.goal > 0 && <span className="tabular">{r.goalPercent}%</span>}</span>
                                {r.goal > 0 ? <><GoalBar percent={r.goalPercent} /><bdi className="text-xs text-zinc-500 tabular">{money(r.goal)}</bdi></> : <span className="text-zinc-500">{t('goals.noGoal')}</span>}
                            </span>
                            <span className="text-sm"><span className="block text-xs text-zinc-500">{t('goals.commission')} · <bdi>{ruleText(r)}</bdi></span><bdi className="tabular font-semibold text-emerald-300">{money(r.commission)}</bdi></span>
                            <Button variant="ghost" size="sm" onClick={() => setEditing(r)} data-testid="goal-edit" title={t('goals.set')} aria-label={t('goals.set')}><Settings2 className="w-4 h-4" /> <span className="hidden xl:inline">{t('goals.set')}</span></Button>
                        </li>
                    ))}
                </ul>
            </Card>

            {editing && <RuleForm row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
        </div>
    );
}
