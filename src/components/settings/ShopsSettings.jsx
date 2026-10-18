// Settings › My shops: the owner's other shops (shops link, phase 1).
// The main shop makes the link and gives a one-time code; another shop types
// the code and gets the main shop's articles (stock 0). Keys never reach here.
import { useEffect, useState } from 'react';
import { Store, Link2, Copy, RefreshCw, Trash2, Download, Upload, KeyRound, CheckCircle2, Clock } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { toast } from '../ui/Toast';
import { useT } from '../../i18n';
import { translateError, errorCode } from '../../i18n/errors';
import { formatDate } from '../../i18n/format';

/** The reason of a failed link step in the shop's words. */
export function shopsError(error, t) {
    const e = errorCode(error);
    if (e?.code === 'SHOPS_LINK_FAILED') {
        const text = t(`shops.reason.${e.params?.reason}`);
        return text.startsWith('shops.reason.') ? t('shops.reason.unknown') : text;
    }
    return translateError(error);
}

function Counts({ counts }) {
    const { t } = useT();
    if (!counts) return null;
    return (
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm" data-testid="shops-counts">
            {['products', 'variants', 'categories', 'brands'].map(k => (
                <li key={k} className="rounded-lg bg-dark-tertiary/60 px-3 py-2">
                    <span className="block text-lg font-semibold">{counts[k] || 0}</span>
                    <span className="text-xs text-zinc-400">{t(`shops.count.${k}`)}</span>
                </li>
            ))}
            {(counts.skipped > 0 || counts.conflicts > 0) && (
                <li className="col-span-full text-xs text-zinc-400">
                    {t('shops.count.kept', { n: counts.skipped || 0 })}
                    {counts.conflicts > 0 && <span className="text-amber-300"> · {t('shops.count.conflicts', { n: counts.conflicts })}</span>}
                </li>
            )}
        </ul>
    );
}

function StartCards({ view, run, busy }) {
    const { t } = useT();
    const [token, setToken] = useState('');
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    return (
        <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-5 space-y-3" data-testid="shops-main-card">
                <h3 className="font-semibold flex items-center gap-2"><Store className="w-4 h-4 text-indigo-300" /> {t('shops.main.title')}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{t('shops.main.text')}</p>
                {view.websiteCloudflare ? (
                    <Button onClick={() => run('main', () => window.electronAPI.shops.connectMain({}))} loading={busy === 'main'} data-testid="shops-main-website">
                        <Link2 className="w-4 h-4" /> {t('shops.main.useWebsite')}
                    </Button>
                ) : (
                    <>
                        <Input label={t('shops.main.token')} value={token} onChange={(e) => setToken(e.target.value)} type="password" autoComplete="off" data-testid="shops-main-token" />
                        <p className="text-xs text-zinc-500 leading-relaxed">{t('shops.main.tokenHint')}</p>
                        <Button onClick={() => run('main', () => window.electronAPI.shops.connectMain({ token }))} disabled={!token.trim()} loading={busy === 'main'} data-testid="shops-main-connect">
                            <KeyRound className="w-4 h-4" /> {t('shops.main.connect')}
                        </Button>
                    </>
                )}
            </Card>
            <Card className="p-5 space-y-3" data-testid="shops-join-card">
                <h3 className="font-semibold flex items-center gap-2"><Link2 className="w-4 h-4 text-emerald-300" /> {t('shops.join.title')}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{t('shops.join.text')}</p>
                <Input label={t('shops.join.code')} value={code} onChange={(e) => setCode(e.target.value)} placeholder="nom-1234-5678" dir="ltr" autoComplete="off" data-testid="shops-join-code" />
                <Input label={t('shops.join.name')} value={name} onChange={(e) => setName(e.target.value)} data-testid="shops-join-name" />
                <Button variant="success" onClick={() => run('join', () => window.electronAPI.shops.join({ code, shopName: name }), (r) => toast.success(t('shops.join.done', { n: r?.counts?.products || 0 })))}
                    disabled={!code.trim()} loading={busy === 'join'} data-testid="shops-join-button">
                    <Download className="w-4 h-4" /> {t('shops.join.button')}
                </Button>
            </Card>
        </div>
    );
}

function MainShop({ view, run, busy }) {
    const { t } = useT();
    const [name, setName] = useState('');
    const [code, setCode] = useState(null);
    const [removing, setRemoving] = useState(null);
    // The shops linked, read again when the screen opens (the network may be off: the last list stays)
    useEffect(() => { run('list', () => window.electronAPI.shops.list().catch(() => window.electronAPI.shops.view())); }, []);
    const copy = async () => { try { await navigator.clipboard.writeText(code.code); toast.success(t('shops.code.copied')); } catch { /* the code stays on screen */ } };
    return (
        <div className="space-y-4">
            <Card className="p-5 space-y-3" data-testid="shops-add">
                <h3 className="font-semibold flex items-center gap-2"><Store className="w-4 h-4 text-indigo-300" /> {t('shops.add.title')}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{t('shops.add.text')}</p>
                <div className="flex flex-wrap items-end gap-2">
                    <Input containerClassName="flex-1 min-w-[14rem] !mb-0" label={t('shops.add.name')} value={name} onChange={(e) => setName(e.target.value)} data-testid="shops-add-name" />
                    <Button onClick={() => run('code', () => window.electronAPI.shops.newCode({ shopName: name }), (r) => { setCode(r); setName(''); }, false)} disabled={!name.trim()} loading={busy === 'code'} data-testid="shops-add-button">
                        <KeyRound className="w-4 h-4" /> {t('shops.add.button')}
                    </Button>
                </div>
                {code && (
                    <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-4 space-y-2" data-testid="shops-code">
                        <p className="text-sm">{t('shops.code.for', { name: code.shopName })}</p>
                        <div className="flex flex-wrap items-center gap-3">
                            <code dir="ltr" className="text-2xl font-bold tracking-wider select-all" data-testid="shops-code-text">{code.code}</code>
                            <Button size="sm" variant="secondary" onClick={copy}><Copy className="w-4 h-4" /> {t('shops.code.copy')}</Button>
                        </div>
                        <p className="text-xs text-zinc-400 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {t('shops.code.until', { time: formatDate(code.expiresAt, 'time') })}</p>
                    </div>
                )}
            </Card>

            <Card className="p-5 space-y-3" data-testid="shops-list">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">{t('shops.list.title')}</h3>
                    <Button size="sm" variant="secondary" onClick={() => run('push', () => window.electronAPI.shops.pushCatalog(), () => toast.success(t('shops.push.done')))} loading={busy === 'push'} data-testid="shops-push">
                        <Upload className="w-4 h-4" /> {t('shops.push.button')}
                    </Button>
                </div>
                {view.lastPush && <p className="text-xs text-zinc-500">{t('shops.push.last', { date: formatDate(view.lastPush.at, 'datetime'), n: view.lastPush.products })}</p>}
                {view.shops?.length ? (
                    <ul className="divide-y divide-dark-border">
                        {view.shops.map(s => (
                            <li key={s.id} className="flex items-center gap-3 py-2.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-none" />
                                <span className="flex-1 min-w-0">
                                    <span className="block font-medium truncate">{s.name}</span>
                                    <span className="block text-xs text-zinc-500">{t('shops.list.seen', { date: formatDate(s.lastSeen || s.joinedAt, 'datetime') })}</span>
                                </span>
                                <Button size="sm" variant="ghost" onClick={() => setRemoving(s)} aria-label={t('shops.list.remove')}><Trash2 className="w-4 h-4" /></Button>
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-sm text-zinc-500">{t('shops.list.none')}</p>}
            </Card>
            <ConfirmDialog isOpen={!!removing} onClose={() => setRemoving(null)} title={t('shops.list.remove')}
                message={t('shops.list.removeText', { name: removing?.name || '' })}
                onConfirm={() => { const id = removing.id; setRemoving(null); run('remove', () => window.electronAPI.shops.remove(id)); }} />
        </div>
    );
}

function BranchShop({ view, run, busy }) {
    const { t } = useT();
    return (
        <Card className="p-5 space-y-3" data-testid="shops-branch">
            <h3 className="font-semibold flex items-center gap-2"><Link2 className="w-4 h-4 text-emerald-300" /> {t('shops.branch.title', { name: view.mainName || '—' })}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">{t('shops.branch.text')}</p>
            {view.lastCopy && (
                <>
                    <p className="text-xs text-zinc-500">{t('shops.branch.last', { date: formatDate(view.lastCopy.at, 'datetime') })}</p>
                    <Counts counts={view.lastCopy.counts} />
                </>
            )}
            <Button onClick={() => run('pull', () => window.electronAPI.shops.pullCatalog(), (r) => toast.success(t('shops.join.done', { n: r?.counts?.products || 0 })))} loading={busy === 'pull'} data-testid="shops-pull">
                <RefreshCw className="w-4 h-4" /> {t('shops.branch.pull')}
            </Button>
        </Card>
    );
}

export function ShopsSettings() {
    const { t } = useT();
    const [view, setView] = useState(null);
    const [busy, setBusy] = useState('');
    const [leaving, setLeaving] = useState(false);
    useEffect(() => { window.electronAPI.shops.view().then(setView).catch((e) => toast.error(shopsError(e, t))); }, []);

    /** One step: busy while it runs, the new view kept, the reason shown when it fails. */
    const run = async (id, fn, after, keepView = true) => {
        setBusy(id);
        try {
            const r = await fn();
            if (keepView && r?.role) setView(r);
            else if (!keepView) setView(await window.electronAPI.shops.view());
            after?.(r);
        } catch (error) {
            toast.error(shopsError(error, t));
        } finally {
            setBusy('');
        }
    };

    if (!view) return null;
    return (
        <div className="space-y-4" data-testid="shops-settings">
            <div>
                <h2 className="text-xl font-bold">{t('settings.tab.shops')}</h2>
                <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{t('shops.intro')}</p>
            </div>
            {view.role === 'none' && <StartCards view={view} run={run} busy={busy} />}
            {view.role === 'main' && <MainShop view={view} run={run} busy={busy} />}
            {view.role === 'branch' && <BranchShop view={view} run={run} busy={busy} />}
            {view.role !== 'none' && (
                <div className="flex justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setLeaving(true)} data-testid="shops-leave">{t('shops.leave.button')}</Button>
                </div>
            )}
            <ConfirmDialog isOpen={leaving} onClose={() => setLeaving(false)} title={t('shops.leave.button')} message={t(view.role === 'main' ? 'shops.leave.mainText' : 'shops.leave.branchText')}
                onConfirm={() => { setLeaving(false); run('leave', () => window.electronAPI.shops.leave()); }} />
        </div>
    );
}
