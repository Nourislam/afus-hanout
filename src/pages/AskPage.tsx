// «اسأل حانوتك»: ready questions as big buttons, answered from the shop's own
// figures on this computer (electron/services/askService.js), no internet.
import { useState } from 'react';
import { MessageCircleQuestion, Flame, Coins, BookOpen, AlertTriangle, Moon } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import { t } from '../i18n';
import { formatMoney } from '../i18n/format';
import { translateError } from '../i18n/errors';
import { weightLabel } from '../lib/units';

interface Row { id: string; label: string; amount?: number; quantity?: number; stock?: number; days?: number; value?: number; unit?: string }
interface Answer { id: string; rows: Row[]; total?: { sales: number; profit: number } }

const QUESTIONS = [
    { id: 'bestThisWeek', icon: Flame },
    { id: 'profitToday', icon: Coins },
    { id: 'whoOwes', icon: BookOpen },
    { id: 'runningOut', icon: AlertTriangle },
    { id: 'notSelling', icon: Moon },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ask = (id: string): Promise<Answer> => (window as any).electronAPI.ask.answer(id);
const qty = (n: number | undefined, unit?: string) => (unit === 'kg' ? weightLabel(n || 0) : String(n ?? 0));

export default function AskPage() {
    const [answer, setAnswer] = useState<Answer | null>(null);
    const [busy, setBusy] = useState('');

    const run = async (id: string) => {
        setBusy(id);
        try { setAnswer(await ask(id)); } catch (error) { toast.error(translateError(error)); } finally { setBusy(''); }
    };

    const line = (a: Answer, r: Row) => {
        switch (a.id) {
            case 'bestThisWeek': return t('ask.line.best', { amount: formatMoney(r.amount || 0), n: qty(r.quantity, r.unit) });
            case 'whoOwes': return formatMoney(r.amount || 0);
            case 'runningOut': return t('ask.line.runningOut', { n: qty(r.stock, r.unit), days: r.days ?? 0 });
            case 'notSelling': return t('ask.line.notSelling', { n: qty(r.stock, r.unit), value: formatMoney(r.value || 0) });
            default: return '';
        }
    };

    return (
        <div className="page">
            <div className="page-header px-6 py-4 flex items-center gap-3">
                <MessageCircleQuestion className="w-6 h-6 text-indigo-300" />
                <div>
                    <h1 className="text-xl font-bold">{t('ask.title')}</h1>
                    <p className="text-sm text-zinc-500">{t('ask.subtitle')}</p>
                </div>
            </div>
            <div className="page-body space-y-4">
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                    {QUESTIONS.map(({ id, icon: Icon }) => (
                        <Button key={id} variant={answer?.id === id ? 'primary' : 'secondary'} size="lg" className="h-20 justify-start text-start" onClick={() => run(id)} loading={busy === id} data-testid={`ask-${id}`}>
                            <Icon className="w-6 h-6 flex-none" /> <span>{t(`ask.q.${id}`)}</span>
                        </Button>
                    ))}
                </div>
                {answer && (
                    <section className="card space-y-2" data-testid="ask-answer">
                        <h2 className="font-semibold">{t(`ask.q.${answer.id}`)}</h2>
                        {answer.total ? (
                            <p className="text-lg">{t('ask.profitToday', { sales: formatMoney(answer.total.sales), profit: formatMoney(answer.total.profit) })}</p>
                        ) : answer.rows.length === 0 ? <p className="text-zinc-500">{t(`ask.none.${answer.id}`)}</p> : (
                            <ol className="divide-y divide-dark-border">
                                {answer.rows.map((r, i) => (
                                    <li key={r.id} className="py-2 flex items-center gap-3">
                                        <span className="w-6 text-zinc-500 tabular">{i + 1}</span>
                                        <span dir="auto" className="flex-1 font-medium">{r.label}</span>
                                        <span className="text-sm text-zinc-300 tabular">{line(answer, r)}</span>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </section>
                )}
            </div>
        </div>
    );
}
