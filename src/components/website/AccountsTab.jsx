// Website › Accounts tab: GitHub and Cloudflare, the address and the custom domain.
import { useEffect, useRef, useState } from 'react';
import { Globe, Github, Cloud, Copy, RefreshCw, CheckCircle2, Circle, Sparkles, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { formatDate, formatNumber } from '../../i18n/format';
import { useT } from '../../i18n';
import { ACCOUNT_STYLE, DOMAIN_STYLE, GITHUB_STYLE, STEP_ICON } from './shared';

/** Three steps in one line: both accounts linked, the website made, the website online. */
export function AccountsProgress({ site }) {
    const { t } = useT();
    const linked = ['github', 'cloudflare'].every(p => site.accounts?.[p]?.status === 'connected');
    const steps = [
        ['accounts', linked],
        ['created', !!site.created && !!site.site?.publishedAt],
        ['online', !!site.site?.publishedAt && !site.site?.pending],
    ];
    return (
        <ol className="card flex flex-wrap items-center gap-x-3 gap-y-2 !py-3" data-testid="website-accounts-progress">
            {steps.map(([id, done], i) => (
                <li key={id} className="flex items-center gap-2 text-sm">
                    {i > 0 && <span className="w-6 h-px bg-dark-border" aria-hidden="true" />}
                    {done ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4 text-zinc-500" />}
                    <span className={done ? 'text-zinc-100' : 'text-zinc-400'}>{t(`website.progress.${id}`)}</span>
                </li>
            ))}
            <li className="text-xs text-zinc-500 ms-auto">{t('website.accountsHint')}</li>
        </ol>
    );
}

const DOMAIN_STEPS = ['dns', 'connected', 'https', 'active'];
// How far each status is along the steps (failed / wrong: where it stopped)
const DOMAIN_REACHED = { dns_needed: 0, dns_wrong: 0, connecting: 1, https_pending: 2, active: 4, failed: 0 };

/**
 * A domain at Hostinger: the shop links its own Hostinger account (an API
 * key made in hPanel › API) and the program writes the records itself. The
 * key goes to the program once and stays encrypted on this computer; it is
 * never shown again and nothing is bought with it.
 */
function HostingerSetup({ d, busy, run }) {
    const { t } = useT();
    const api = window.electronAPI.website;
    const [key, setKey] = useState('');
    const h = d.hostinger;
    return (
        <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3 space-y-2" data-testid="website-hostinger" data-linked={h.linked ? '1' : '0'}>
            <p className="text-sm font-medium">{t('website.hostinger.title')}</p>
            {d.autoDns === 'hostinger' && d.autoAt ? (
                <p className="text-xs text-emerald-300" data-testid="website-hostinger-done">{t('website.hostinger.done', { date: formatDate(d.autoAt, 'datetime') })}</p>
            ) : h.linked ? (
                <>
                    <p className="text-xs text-zinc-400">{h.owns === false ? t('website.hostinger.notOwned', { domain: d.name }) : t('website.hostinger.ready')}</p>
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => run('hostinger', () => api.domainHostingerSetup(), () => toast.success(t('website.hostinger.written')))} loading={busy === 'hostinger'} data-testid="website-hostinger-setup">
                            <Sparkles className="w-4 h-4" /> {t('website.hostinger.setup')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => run('hostinger', () => api.domainHostingerForget())} data-testid="website-hostinger-forget">{t('website.hostinger.forget')}</Button>
                    </div>
                </>
            ) : (
                <>
                    <p className="text-xs text-zinc-400 leading-relaxed">{t('website.hostinger.intro')}</p>
                    <div className="flex flex-wrap gap-2">
                        <input type="password" autoComplete="off" spellCheck={false} dir="ltr" className="input flex-1 min-w-[12rem] font-mono text-xs" value={key}
                            onChange={(e) => setKey(e.target.value)} placeholder={t('website.hostinger.keyPlaceholder')} aria-label={t('website.hostinger.key')} data-testid="website-hostinger-key" />
                        <Button size="sm" onClick={() => run('hostinger', () => api.domainHostingerLink({ token: key }), () => { setKey(''); toast.success(t('website.hostinger.linked')); })}
                            loading={busy === 'hostinger'} disabled={key.trim().length < 20} data-testid="website-hostinger-link">{t('website.hostinger.link')}</Button>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">{t('website.hostinger.keySafe')}</p>
                </>
            )}
        </div>
    );
}

/**
 * Domain: the free address (always there, works without buying anything)
 * and, optionally, the shop's own domain: one it already has, or one it
 * buys now at a provider (on its own account: the domain is the shop's).
 * Connecting is step by step; the free address keeps working until the
 * domain is ready.
 */
export function CustomDomain({ site, setSite, busy, run }) {
    const { t } = useT();
    const api = window.electronAPI.website;
    const d = site.domain || { name: '', status: 'none', providers: [] };
    const has = !!d.name;
    const [mode, setMode] = useState(null); // 'own' | 'buy'
    const [domain, setDomain] = useState('');
    const [query, setQuery] = useState('');
    const [found, setFound] = useState(null);
    const [opened, setOpened] = useState(null); // { domain, provider } after a buy link
    const [cleanup, setCleanup] = useState(null);
    const free = site.site?.freeUrl || site.freeUrl;
    const published = !!site.publishedAt;

    // Waiting for the records or GitHub: look again by itself while the screen is open
    useEffect(() => {
        if (!has || !['dns_needed', 'dns_wrong', 'connecting', 'https_pending'].includes(d.status)) return undefined;
        const timer = setInterval(() => { api.getState().then(setSite).catch(() => {}); }, 30000);
        return () => clearInterval(timer);
    }, [has, d.status]);

    const connect = (name, source, provider = null) => run('domain', () => api.setDomain({ domain: name, source, provider }), () => {
        setDomain(''); setMode(null); setFound(null); setOpened(null); setCleanup(null);
        toast.success(t('website.domainSaved'));
    });
    const search = () => run('domainSearch', async () => { setFound(await api.domainSearch({ query })); return null; });
    const buy = (name, provider) => run('domainBuy', async () => {
        await api.domainOpenBuy({ domain: name, provider });
        setOpened({ domain: name, provider });
        return null;
    });
    const remove = () => run('domain', () => api.removeDomain(), (next) => setCleanup(next?.result?.cleanup?.length ? next.result : null));
    const copy = (text) => navigator.clipboard?.writeText(text).then(() => toast.success(t('website.copied')), () => {});
    const reached = DOMAIN_REACHED[d.status] ?? 0;

    return (
        <section className="card space-y-4" data-testid="website-domain" id="website-domain">
            <h2 className="font-semibold flex items-center gap-2"><Globe className="w-4 h-4 text-indigo-300" /> {t('website.domain.title')}</h2>

            {/* 1. The free address: always there */}
            <div className="rounded-xl border border-dark-border p-3 space-y-1" data-testid="website-domain-free">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{t('website.domain.free')}</span>
                    <span className={`badge ${published ? 'bg-emerald-500/15 text-emerald-300' : 'bg-dark-tertiary text-zinc-400'}`} data-testid="website-domain-free-status">
                        {t(published ? 'website.domain.freeActive' : 'website.domain.freeSoon')}
                    </span>
                </div>
                {free && <p dir="ltr" className="font-mono text-xs break-all text-zinc-300">{free}</p>}
                <p className="text-xs text-zinc-500">{t(d.status === 'active' ? 'website.domain.freeRedirects' : 'website.domain.freeHint')}</p>
            </div>

            {/* 2. The shop's own domain (optional) */}
            <div className="rounded-xl border border-dark-border p-3 space-y-3" data-testid="website-domain-custom">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{t('website.domain.custom')}</span>
                    <span className="badge bg-dark-tertiary text-zinc-400">{t('common.optional')}</span>
                </div>

                {!has && !mode && (
                    <div className="grid sm:grid-cols-2 gap-2">
                        <Button variant="secondary" onClick={() => setMode('own')} data-testid="website-domain-have">{t('website.domain.have')}</Button>
                        <Button variant="secondary" onClick={() => setMode('buy')} data-testid="website-domain-buy">{t('website.domain.buy')}</Button>
                        <p className="sm:col-span-2 text-xs text-zinc-500 leading-relaxed">{t('website.domain.optionalHint')}</p>
                    </div>
                )}

                {!has && mode === 'own' && (
                    <div className="space-y-2">
                        <p className="text-xs text-zinc-400">{t('website.domain.haveHint')}</p>
                        <div className="flex flex-wrap gap-2">
                            <input dir="ltr" className="input flex-1 min-w-[12rem] font-mono" placeholder="boutique-yasmine.com" value={domain}
                                onChange={(e) => setDomain(e.target.value)} aria-label={t('website.domain.custom')} data-testid="website-domain-input" />
                            <Button onClick={() => connect(domain, 'own')} loading={busy === 'domain'} disabled={!domain.trim()} data-testid="website-domain-save">{t('website.domain.connect')}</Button>
                            <Button variant="ghost" onClick={() => setMode(null)}>{t('common.cancel')}</Button>
                        </div>
                    </div>
                )}

                {!has && mode === 'buy' && (
                    <div className="space-y-3" data-testid="website-domain-buy-panel">
                        <p className="text-xs text-zinc-400 leading-relaxed">{t('website.domain.buyHint')}</p>
                        <div className="flex flex-wrap gap-2">
                            <input className="input flex-1 min-w-[12rem]" placeholder={t('website.domain.searchPlaceholder')} value={query}
                                onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && query.trim()) search(); }}
                                aria-label={t('website.domain.search')} data-testid="website-domain-search" />
                            <Button onClick={search} loading={busy === 'domainSearch'} disabled={!query.trim()} data-testid="website-domain-search-btn">{t('website.domain.search')}</Button>
                            <Button variant="ghost" onClick={() => { setMode(null); setFound(null); }}>{t('common.cancel')}</Button>
                        </div>
                        {found && found.providersAvailable === 0 && <p className="text-xs text-amber-300" data-testid="website-domain-no-providers">{t('website.domain.noProviders')}</p>}
                        {found && (
                            <ul className="space-y-2" data-testid="website-domain-results">
                                {found.results.map(r => (
                                    <li key={r.domain} className="rounded-lg bg-dark-tertiary/50 p-2 space-y-2" data-testid="website-domain-result" data-domain={r.domain} data-status={r.status}>
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span dir="ltr" className="font-mono text-sm">{r.domain}</span>
                                            <span className={`badge ${r.status === 'available' ? 'bg-emerald-500/15 text-emerald-300' : r.status === 'taken' ? 'bg-red-500/15 text-red-300' : 'bg-dark-tertiary text-zinc-400'}`}>{t(`website.domain.avail.${r.status}`)}</span>
                                        </div>
                                        {r.status !== 'taken' && r.providers.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {r.providers.map(p => (
                                                    <Button key={p.id} size="sm" variant="secondary" onClick={() => buy(r.domain, p.id)} loading={busy === 'domainBuy'} data-testid="website-domain-buy-at" data-provider={p.id}>
                                                        {t('website.domain.buyAt', { name: p.name })}
                                                        {p.price && <span className="text-zinc-400 ms-1">· {t('website.domain.from', { price: `${formatNumber(p.price.from)} ${p.price.currency}` })}</span>}
                                                    </Button>
                                                ))}
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {found && <p className="text-xs text-zinc-500 leading-relaxed">{t('website.domain.ownership')}</p>}
                        {opened && (
                            <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3 space-y-2" data-testid="website-domain-bought">
                                <p className="text-sm">{t('website.domain.afterBuy', { domain: opened.domain })}</p>
                                <Button size="sm" onClick={() => connect(opened.domain, 'bought', opened.provider)} loading={busy === 'domain'} data-testid="website-domain-bought-connect">{t('website.domain.boughtConnect')}</Button>
                            </div>
                        )}
                    </div>
                )}

                {has && (
                    <div className="space-y-3">
                        <div className="rounded-lg bg-dark-tertiary/60 px-3 py-2 space-y-1.5">
                            <p dir="ltr" className="font-mono text-sm [overflow-wrap:anywhere] text-start" data-testid="website-domain-name">{d.name}</p>
                            <span className={`badge ${DOMAIN_STYLE[d.status] || ''}`} data-testid="website-domain-status" data-status={d.status}>{t(`website.domain.status.${d.status}`)}</span>
                        </div>
                        <ol className="grid grid-cols-2 gap-2" data-testid="website-domain-steps">
                            {DOMAIN_STEPS.map((id, i) => {
                                const st = i < reached ? 'done' : i === reached && !['failed', 'dns_wrong'].includes(d.status) ? 'running' : i === reached ? 'failed' : 'pending';
                                return (
                                    <li key={id} className="flex items-center gap-1.5 text-xs" data-status={st}>
                                        {STEP_ICON[st === 'running' ? 'waiting' : st]}<span className="leading-snug">{t(`website.domain.step.${id}`)}</span>
                                    </li>
                                );
                            })}
                        </ol>
                        <p className="text-sm text-zinc-300 leading-relaxed" data-testid="website-domain-explain">
                            {t(`website.domain.explain.${d.reason || d.status}`, { domain: d.name, url: `https://${d.name}/` })}
                        </p>

                        {d.hostinger && ['dns_needed', 'dns_wrong'].includes(d.status) && d.reason !== 'not_published' && (
                            <HostingerSetup d={d} busy={busy} run={run} />
                        )}

                        {['dns_needed', 'dns_wrong'].includes(d.status) && d.records?.length > 0 && d.reason !== 'not_published' && (
                            <div className="space-y-2" data-testid="website-domain-records">
                                <p className="text-xs text-zinc-400 leading-relaxed">{t('website.domain.recordsHint')}</p>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead className="text-zinc-500"><tr>{['type', 'host', 'value'].map(k => <th key={k} className="text-start font-medium py-1 px-2">{t(`website.domain.col.${k}`)}</th>)}<th /></tr></thead>
                                        <tbody dir="ltr">
                                            {d.records.map((r, i) => (
                                                <tr key={i} className="border-t border-dark-border" data-testid="website-domain-record">
                                                    <td className="py-1.5 px-2 font-mono">{r.type}</td>
                                                    <td className="py-1.5 px-2 font-mono">{r.host}</td>
                                                    <td className="py-1.5 px-2 font-mono break-all">{r.value}</td>
                                                    <td className="py-1.5 px-2 text-end"><Button size="sm" variant="ghost" onClick={() => copy(r.value)} aria-label={t('website.copy')}><Copy className="w-3.5 h-3.5" /></Button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {d.status === 'dns_wrong' && d.found && (
                                    <p className="text-xs text-red-300" dir="ltr" data-testid="website-domain-found">{t('website.domain.foundNow')}: {[...(d.found.a || []), ...(d.found.cname || [])].join(', ') || '—'}</p>
                                )}
                                <p className="text-xs text-zinc-500">{t('website.domain.autoCheck')}</p>
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                            {d.status !== 'failed' && d.status !== 'active' && (
                                <Button size="sm" variant="secondary" onClick={() => run('domainCheck', () => api.domainCheck())} loading={busy === 'domainCheck'} data-testid="website-domain-check">
                                    <RefreshCw className="w-4 h-4" /> {t('website.domain.checkNow')}
                                </Button>
                            )}
                            {d.status === 'failed' && (
                                <Button size="sm" onClick={() => run('domainCheck', () => api.domainRetry())} loading={busy === 'domainCheck'} data-testid="website-domain-retry">{t('website.publish.retry')}</Button>
                            )}
                            {d.status === 'active' && (
                                <Button size="sm" variant="secondary" onClick={() => window.open(`https://${d.name}/`, '_blank', 'noopener')}><Globe className="w-4 h-4" /> {t('website.publish.open')}</Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={remove} loading={busy === 'domain'} data-testid="website-domain-remove"><X className="w-4 h-4" /> {t('website.domainRemove')}</Button>
                        </div>
                    </div>
                )}

                {cleanup && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1" data-testid="website-domain-cleanup">
                        <p className="text-sm text-amber-300">{t('website.domain.cleanup', { domain: cleanup.removed })}</p>
                        <p className="text-xs text-zinc-400" dir="ltr">{cleanup.cleanup.map(r => `${r.type} ${r.host} → ${r.value}`).join(' · ')}</p>
                    </div>
                )}
            </div>
        </section>
    );
}

/**
 * The shop's own GitHub account: Not connected, Connected (@login) or
 * Connection failed (with the reason, in the shop's words). While GitHub's
 * page is open the short code is shown here and the screen asks the program
 * every 2 seconds whether the shop agreed.
 */
export function GithubAccount({ site, setSite, busy, run }) {
    const { t } = useT();
    const api = window.electronAPI.website;
    const account = site.accounts?.github || { status: 'not_connected' };
    const flow = site.githubFlow;
    const available = site.providers?.github?.available;
    const [now, setNow] = useState(Date.now());
    const waiting = useRef(false);

    useEffect(() => {
        if (!flow) return undefined;
        waiting.current = true;
        const timer = setInterval(() => {
            setNow(Date.now());
            api.getState().then(setSite).catch(() => {});
        }, 2000);
        return () => clearInterval(timer);
    }, [flow?.userCode]);

    // The wait ended: linked, or why not
    useEffect(() => {
        if (flow || !waiting.current) return;
        waiting.current = false;
        if (account.status === 'connected') toast.success(t('website.account.linked', { name: t('website.account.github') }));
        else if (account.status === 'failed') toast.error(t(`website.github.error.${account.error || 'unknown'}`), 6000);
    }, [flow, account.status]);

    const start = () => run('github', () => api.githubStart(), (next) => {
        const r = next?.result;
        if (r && !r.started) {
            if (r.reason === 'not_configured') toast.info(t('website.github.notConfigured'), 7000);
            else toast.error(t(`website.github.error.${r.reason || 'unknown'}`), 6000);
        }
    });
    const disconnect = () => {
        if (!confirm(t('website.github.disconnectConfirm'))) return;
        run('github', () => api.githubDisconnect(), () => toast.success(t('website.github.disconnected')));
    };
    const copy = () => navigator.clipboard?.writeText(flow.userCode).then(() => toast.success(t('website.github.codeCopied')), () => {});
    const minutes = flow ? Math.max(0, Math.ceil((Date.parse(flow.expiresAt) - now) / 60000)) : 0;

    return (
        <div className="card h-full space-y-3" data-testid="website-github" data-status={account.status} data-waiting={flow ? '1' : '0'}>
            <div className="flex flex-wrap items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-dark-tertiary flex items-center justify-center flex-none"><Github className="w-5 h-5" /></span>
                <span className="flex-1 min-w-[8rem]">
                    <span className="block text-sm font-medium">{t('website.account.github')}</span>
                    <span className="block text-xs text-zinc-500 leading-snug">
                        {account.status === 'connected' && account.login
                            ? <>{t('website.github.connectedAs')} <bdi dir="ltr" className="font-mono text-zinc-300" data-testid="website-github-login">@{account.login}</bdi></>
                            : t('website.account.githubHint')}
                    </span>
                </span>
                <span className={`badge whitespace-nowrap ${flow ? 'bg-indigo-500/15 text-indigo-300' : GITHUB_STYLE[account.status] || GITHUB_STYLE.not_connected}`} data-testid="website-github-status">
                    {flow ? t('website.github.waiting') : t(`website.github.state.${account.status}`)}
                </span>
            </div>

            {flow ? (
                <div className="rounded-lg bg-dark-tertiary/60 p-3 space-y-3 text-center" data-testid="website-github-flow">
                    <p className="text-sm font-medium">{t('website.github.codeTitle')}</p>
                    <p dir="ltr" className="text-2xl font-mono font-bold tracking-[0.3em] select-all" data-testid="website-github-code">{flow.userCode}</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">{t('website.github.codeHint')}</p>
                    <div className="flex flex-wrap justify-center gap-2">
                        <Button size="sm" variant="secondary" onClick={copy}><Copy className="w-4 h-4" /> {t('website.github.copyCode')}</Button>
                        <Button size="sm" variant="secondary" onClick={() => api.githubOpen().catch(() => {})} data-testid="website-github-open">
                            <Github className="w-4 h-4" /> {t('website.github.openAgain')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => run('github', () => api.githubCancel())} data-testid="website-github-cancel">{t('common.cancel')}</Button>
                    </div>
                    <p className="text-xs text-zinc-500">{t('website.github.expiresIn', { n: minutes })}</p>
                </div>
            ) : account.status === 'connected' ? (
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => api.githubManage().catch(() => {})} data-testid="website-github-manage">{t('website.github.manage')}</Button>
                    <Button size="sm" variant="ghost" className="text-red-300" onClick={disconnect} loading={busy === 'github'} data-testid="website-github-disconnect">
                        {t('website.github.disconnect')}
                    </Button>
                </div>
            ) : (
                <div className="space-y-2">
                    {account.status === 'failed' && (
                        <p className="text-xs text-red-300 leading-relaxed" data-testid="website-github-error">{t(`website.github.error.${account.error || 'unknown'}`)}</p>
                    )}
                    {site.githubBlocked && <p className="text-xs text-amber-300">{t('errors.WEBSITE_GITHUB_BLOCKED')}</p>}
                    {site.providers?.github?.signIn && (
                        <div className="flex flex-wrap items-center gap-2">
                            <Button size="sm" onClick={start} loading={busy === 'github'} disabled={!!site.githubBlocked} data-testid="website-connect-github">
                                <Github className="w-4 h-4" /> {account.status === 'failed' ? t('website.github.retry') : t('website.account.connect.github')}
                            </Button>
                        </div>
                    )}
                    {available && <SignupLink provider="github" />}
                    {available && <TokenLink provider="github" busy={busy} run={run} folded={!!site.providers?.github?.signIn} />}
                    <p className="text-xs text-zinc-500 leading-relaxed">{t('website.github.permissions')}</p>
                </div>
            )}
        </div>
    );
}

/**
 * The shop's own Cloudflare account: Not connected, Connected (account
 * name, Workers and D1 reachable), Choose the account (several allowed on
 * Cloudflare's page) or Connection failed (reason in the shop's words).
 * While Cloudflare's page is open in the browser the screen asks the program
 * every 2 seconds whether the browser came back.
 */
export function CloudflareAccount({ site, setSite, busy, run }) {
    const { t } = useT();
    const api = window.electronAPI.website;
    const account = site.accounts?.cloudflare || { status: 'not_connected' };
    const flow = site.cloudflareFlow;
    const available = site.providers?.cloudflare?.available;
    const blocked = site.accountsBlocked;
    const waiting = useRef(false);

    useEffect(() => {
        if (!flow) return undefined;
        waiting.current = true;
        const timer = setInterval(() => { api.getState().then(setSite).catch(() => {}); }, 2000);
        return () => clearInterval(timer);
    }, [flow?.expiresAt]);

    // The wait ended: linked, an account to choose, or why not
    useEffect(() => {
        if (flow || !waiting.current) return;
        waiting.current = false;
        if (account.status === 'connected') toast.success(t('website.account.linked', { name: t('website.account.cloudflare') }));
        else if (account.status === 'failed') toast.error(t(`website.cloudflare.error.${account.error || 'unknown'}`), 6000);
    }, [flow, account.status]);

    const start = () => run('cloudflare', () => api.cloudflareStart(), (next) => {
        const r = next?.result;
        if (r && !r.started) {
            if (r.reason === 'not_configured') toast.info(t('website.cloudflare.notConfigured'), 7000);
            else toast.error(t(`website.cloudflare.error.${r.reason || 'unknown'}`), 6000);
        }
    });
    const choose = (id) => run('cloudflare', () => api.cloudflareChoose(id), (next) => {
        const r = next?.result;
        if (r?.linked) toast.success(t('website.account.linked', { name: t('website.account.cloudflare') }));
        else if (r) toast.error(t(`website.cloudflare.error.${r.reason === 'unknown_account' ? 'unknown' : r.reason || 'unknown'}`), 6000);
    });
    const disconnect = () => {
        if (!confirm(t('website.cloudflare.disconnectConfirm'))) return;
        run('cloudflare', () => api.cloudflareDisconnect(), () => toast.success(t('website.cloudflare.disconnected')));
    };
    const badge = flow ? 'waiting' : account.status;

    return (
        <div className="card h-full space-y-3" data-testid="website-cloudflare" data-status={account.status} data-waiting={flow ? '1' : '0'}>
            <div className="flex flex-wrap items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-dark-tertiary flex items-center justify-center flex-none"><Cloud className="w-5 h-5" /></span>
                <span className="flex-1 min-w-[8rem]">
                    <span className="block text-sm font-medium">{t('website.account.cloudflare')}</span>
                    <span className="block text-xs text-zinc-500 leading-snug">
                        {account.status === 'connected' && account.accountName
                            ? <>{t('website.cloudflare.connectedAs')} <bdi className="text-zinc-300" data-testid="website-cloudflare-account">{account.accountName}</bdi></>
                            : t('website.account.cloudflareHint')}
                    </span>
                </span>
                <span className={`badge whitespace-nowrap ${ACCOUNT_STYLE[badge] || ACCOUNT_STYLE.not_connected}`} data-testid="website-cloudflare-status">
                    {flow ? t('website.cloudflare.waiting') : t(`website.cloudflare.state.${account.status}`)}
                </span>
            </div>

            {flow ? (
                <div className="rounded-lg bg-dark-tertiary/60 p-3 space-y-3 text-center" data-testid="website-cloudflare-flow">
                    <p className="text-sm font-medium">{t('website.cloudflare.flowTitle')}</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">{t('website.cloudflare.flowHint')}</p>
                    <div className="flex flex-wrap justify-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => api.cloudflareOpen().catch(() => {})} data-testid="website-cloudflare-open">
                            <Cloud className="w-4 h-4" /> {t('website.cloudflare.openAgain')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => run('cloudflare', () => api.cloudflareCancel())} data-testid="website-cloudflare-cancel">{t('common.cancel')}</Button>
                    </div>
                </div>
            ) : account.status === 'choose_account' ? (
                <div className="space-y-2" data-testid="website-cloudflare-choose">
                    <p className="text-xs text-zinc-400 leading-relaxed">{t('website.cloudflare.chooseHint')}</p>
                    <div className="grid gap-2">
                        {account.accounts.map(a => (
                            <Button key={a.id} size="sm" variant="secondary" className="justify-start" onClick={() => choose(a.id)} loading={busy === 'cloudflare'} data-testid="website-cloudflare-pick">
                                <Cloud className="w-4 h-4" /> <bdi className="truncate">{a.name || t('website.cloudflare.unnamed')}</bdi>
                            </Button>
                        ))}
                    </div>
                    <Button size="sm" variant="ghost" onClick={disconnect}>{t('common.cancel')}</Button>
                </div>
            ) : account.status === 'connected' ? (
                <div className="space-y-2">
                    <p className="text-xs text-zinc-500 leading-relaxed" data-testid="website-cloudflare-ready">{t('website.cloudflare.ready')}</p>
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="ghost" onClick={() => api.cloudflareManage().catch(() => {})} data-testid="website-cloudflare-manage">{t('website.cloudflare.manage')}</Button>
                        <Button size="sm" variant="ghost" className="text-red-300" onClick={disconnect} loading={busy === 'cloudflare'} data-testid="website-cloudflare-disconnect">
                            {t('website.cloudflare.disconnect')}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-2">
                    {account.status === 'failed' && (
                        <p className="text-xs text-red-300 leading-relaxed" data-testid="website-cloudflare-error">{t(`website.cloudflare.error.${account.error || 'unknown'}`)}</p>
                    )}
                    {blocked && <p className="text-xs text-amber-300">{t('errors.WEBSITE_ACCOUNTS_BLOCKED')}</p>}
                    {site.providers?.cloudflare?.signIn && (
                        <Button size="sm" onClick={start} loading={busy === 'cloudflare'} disabled={!!blocked} data-testid="website-connect-cloudflare">
                            <Cloud className="w-4 h-4" /> {account.status === 'failed' ? t('website.cloudflare.retry') : t('website.account.connect.cloudflare')}
                        </Button>
                    )}
                    {available && <SignupLink provider="cloudflare" />}
                    {available && <TokenLink provider="cloudflare" busy={busy} run={run} folded={!!site.providers?.cloudflare?.signIn} />}
                    <p className="text-xs text-zinc-500 leading-relaxed">{t('website.cloudflare.permissions')}</p>
                </div>
            )}
        </div>
    );
}

/**
 * Link an account with a key the shop makes itself on the provider's own
 * page (already filled in with what the website needs): open the page, make
 * the key, paste it here. The key goes to the main process, is checked with
 * the provider and kept encrypted; it is never shown again.
 */
/** No account yet: the provider's own page to open one, free (the only thing the shop has to do). */
function SignupLink({ provider }) {
    const { t } = useT();
    return (
        <p className="text-xs text-zinc-400">
            {t(`website.signup.${provider}.question`)}{' '}
            <button type="button" className="text-indigo-300 underline" onClick={() => window.electronAPI.website.openSignupPage(provider).catch(() => {})} data-testid={`website-${provider}-signup`}>
                {t(`website.signup.${provider}.create`)}
            </button>
        </p>
    );
}

/** folded: the one-click sign-in is offered above; the key is the other way, folded away. */
function TokenLink({ provider, busy, run, folded = false }) {
    const { t } = useT();
    const api = window.electronAPI.website;
    const [token, setToken] = useState('');
    const key = `${provider}-token`;
    const link = () => run(key, () => (provider === 'github' ? api.githubConnectToken(token) : api.cloudflareConnectToken(token)), (next) => {
        const r = next?.result;
        setToken('');
        if (r?.linked) toast.success(t('website.account.linked', { name: t(`website.account.${provider}`) }));
        else if (r?.reason === 'choose_account') toast.info(t('website.cloudflare.chooseHint'), 6000);
        else if (r) toast.error(t(`website.token.error.${r.reason || 'unknown'}`), 8000);
    });
    const body = (
        <>
            <ol className="text-xs text-zinc-400 leading-relaxed list-decimal ps-5 space-y-1">
                <li>{t(`website.token.${provider}.step1`)}</li>
                <li>{t(`website.token.${provider}.step2`)}</li>
                <li>{t('website.token.step3')}</li>
            </ol>
            <Button size="sm" variant="secondary" onClick={() => api.openTokenPage(provider).catch(() => {})} data-testid={`website-${provider}-token-page`}>
                {provider === 'github' ? <Github className="w-4 h-4" /> : <Cloud className="w-4 h-4" />} {t(`website.token.${provider}.open`)}
            </Button>
            <div className="flex flex-wrap gap-2">
                <input type="password" className="input flex-1 min-w-[12rem] font-mono" dir="ltr" autoComplete="off" spellCheck={false} value={token}
                    onChange={(e) => setToken(e.target.value)} placeholder={t(`website.token.${provider}.placeholder`)} aria-label={t('website.token.paste')}
                    maxLength={260} data-testid={`website-${provider}-token-input`} />
                <Button size="sm" onClick={link} disabled={!token.trim()} loading={busy === key} data-testid={`website-${provider}-token-link`}>{t('website.token.link')}</Button>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">{t('website.token.safe')}</p>
        </>
    );
    if (folded) {
        return (
            <details className="rounded-lg bg-dark-tertiary/40 p-3" data-testid={`website-${provider}-token`}>
                <summary className="text-xs text-zinc-400 cursor-pointer">{t('website.token.otherWay')}</summary>
                <div className="space-y-2 mt-2">{body}</div>
            </details>
        );
    }
    return (
        <div className="rounded-lg bg-dark-tertiary/50 p-3 space-y-2" data-testid={`website-${provider}-token`}>
            <p className="text-sm font-medium">{t('website.token.title')}</p>
            {body}
        </div>
    );
}
