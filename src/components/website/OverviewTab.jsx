// Website › Overview tab: publish panel, what the site shows, the preview window.
import { useEffect, useRef, useState } from 'react';
import { Globe, Copy, RefreshCw, Sparkles, Store } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { formatDate } from '../../i18n/format';
import { useT } from '../../i18n';
import { PreviewFrame, themeText } from './DesignTab';
import { AddressField, DOMAIN_STYLE, STATUS_STYLE, STEP_ICON } from './shared';

// Every page of the website, as the preview offers them
const SITE_PAGES = ['home', 'products', 'categories', 'category', 'product', 'new', 'best', 'offers', 'cart', 'checkout', 'about', 'contact', 'location', 'returns', 'terms', 'privacy', 'shipping'];

/**
 * Preview Website: the website as Update would publish it now (the shop's
 * data as it is, the theme in use), every page, computer or phone — before
 * anything is sent. Read only.
 */
function WebsitePreview({ site, onClose, onUpdate }) {
    const { t, lang } = useT();
    const api = window.electronAPI.website;
    const [page, setPage] = useState('home');
    const [id, setId] = useState(null);
    const [device, setDevice] = useState('desktop');
    const [preview, setPreview] = useState(null);
    const [failed, setFailed] = useState(false);
    const theme = site.themes?.find(x => x.id === site.theme);
    // A link clicked in the preview: open that page
    const navigate = (kind, target) => {
        if (kind === 'home') { setPage('home'); setId(null); } else if (kind === 'page' && SITE_PAGES.includes(target)) { setPage(target); setId(null); } else if (kind === 'category' || kind === 'product') { setPage(kind); setId(target); }
    };
    useEffect(() => {
        let alive = true;
        setFailed(false);
        api.previewTheme({ theme: site.theme, page, id }).then((r) => { if (alive) setPreview(r); }, () => { if (alive) setFailed(true); });
        return () => { alive = false; };
    }, [page, id, site.theme]);
    return (
        <Modal isOpen onClose={onClose} title={t('website.sitePreview.title')} size="xl">
            <div className="space-y-3" data-testid="website-site-preview">
                <p className="text-xs text-zinc-400 leading-relaxed">{t(site.publishedAt ? 'website.sitePreview.hintOnline' : 'website.sitePreview.hintFirst', { theme: themeText(theme, 'name', lang) })}</p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <select className="input py-1.5 text-sm" value={page} onChange={(e) => { setPage(e.target.value); setId(null); }} aria-label={t('website.previewPage')} data-testid="website-site-preview-page">
                            {SITE_PAGES.map(p => <option key={p} value={p}>{t(`website.sitePreview.page.${p}`)}</option>)}
                        </select>
                        {page === 'category' && preview?.categories?.length > 0 && (
                            <select className="input py-1.5 text-sm" value={id || ''} onChange={(e) => setId(e.target.value || null)} aria-label={t('website.previewPages.category')}>
                                <option value="">{t('website.sitePreview.page.products')}</option>
                                {preview.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        )}
                    </div>
                    <div className="flex gap-1 rounded-lg bg-dark-tertiary/60 p-1" role="tablist" aria-label={t('website.previewDevice')}>
                        {['desktop', 'mobile'].map(d => (
                            <button key={d} type="button" role="tab" aria-selected={device === d} onClick={() => setDevice(d)} data-testid={`website-site-preview-device-${d}`}
                                className={`px-3 py-1.5 rounded-md text-sm ${device === d ? 'bg-dark-secondary text-white' : 'text-zinc-400 hover:text-white'}`}>
                                {t(`website.previewDevices.${d}`)}
                            </button>
                        ))}
                    </div>
                </div>
                {failed ? <p className="p-6 text-sm text-zinc-500">{t('website.previewFailed')}</p>
                    : <PreviewFrame html={preview?.html} device={device} title={t('website.sitePreview.title')} testId="website-site-preview-frame" theme={preview?.theme} onNavigate={navigate} />}
                {preview && page === 'new' && preview.newProducts === 0 && <p className="text-xs text-zinc-500">{t('website.sitePreview.noNew')}</p>}
                {preview && page === 'best' && preview.bestSellers === 0 && <p className="text-xs text-zinc-500">{t('website.sitePreview.noBest')}</p>}
                <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="ghost" onClick={onClose}>{t('common.close')}</Button>
                    {site.canPublish && <Button onClick={onUpdate} data-testid="website-site-preview-publish"><RefreshCw className="w-4 h-4" /> {t(site.publishedAt ? 'website.updateNow' : 'website.publish.create')}</Button>}
                </div>
            </div>
        </Modal>
    );
}

/**
 * Website management in one place: where the website is (status), its
 * free address, its own domain, the theme in use, when it was last
 * updated, and the three actions: Update website, Preview website, Change theme.
 */
export function WebsiteOverview({ site, busy, run, outdated = null }) {
    const { t, lang } = useT();
    const api = window.electronAPI.website;
    const [previewing, setPreviewing] = useState(false);
    const running = site.deploy?.status === 'running';
    const published = !!site.publishedAt;
    const theme = site.themes?.find(x => x.id === site.theme);
    const d = site.domain || { name: '', status: 'none' };
    const free = site.site?.freeUrl || site.freeUrl;
    const update = () => run('publish', () => api.publish(), (next) => {
        const r = next?.result;
        if (r && !r.started && r.reason !== 'running') toast.error(t(`website.publish.reason.${r.reason}`), 7000);
    });
    const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const Row = ({ label, children, testId }) => (
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-2 border-t border-dark-border first:border-t-0" data-testid={testId}>
            <span className="text-xs text-zinc-500 pt-0.5">{label}</span>
            <div className="min-w-0 text-sm text-end">{children}</div>
        </div>
    );
    return (
        <section className="card space-y-2" data-testid="website-url">
            <h2 className="font-semibold flex items-center gap-2"><Store className="w-4 h-4 text-indigo-300" /> {t('website.manage.title')}</h2>
            <div data-testid="website-overview">
                <Row label={t('website.manage.status')} testId="website-overview-status">
                    <span className={`badge ${STATUS_STYLE[site.status] || STATUS_STYLE.none}`} data-status={site.status}>{t(`website.status.${site.status}`)}</span>
                </Row>
                <Row label={t('website.manage.free')} testId="website-overview-free">
                    <p dir="ltr" className="font-mono text-xs [overflow-wrap:anywhere] text-start" data-testid="website-free-url">{free}</p>
                    <span className="flex flex-wrap justify-end gap-1 mt-1">
                        <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(free).then(() => toast.success(t('website.copied')), () => {}); }}>
                            <Copy className="w-4 h-4" /> {t('website.copy')}
                        </Button>
                        {!published && <RenameAddress site={site} busy={busy} run={run} />}
                    </span>
                    <p className="text-xs text-zinc-500">{published ? t('website.urlLive') : site.freeOwner ? t('website.urlSoon') : t('website.urlAfterGithub')}</p>
                </Row>
                <Row label={t('website.manage.custom')} testId="website-overview-domain">
                    {d.name ? (
                        <span className="flex flex-col items-end gap-1">
                            <span dir="ltr" className="font-mono text-xs [overflow-wrap:anywhere]">{d.name}</span>
                            <span className={`badge ${DOMAIN_STYLE[d.status] || ''}`} data-status={d.status}>{t(`website.domain.status.${d.status}`)}</span>
                        </span>
                    ) : <span className="text-zinc-400">{t('website.manage.noDomain')}</span>}
                    <button type="button" className="block ms-auto text-xs text-indigo-300 hover:underline mt-1" onClick={() => scrollTo('website-domain')}>{t('website.manage.manageDomain')}</button>
                </Row>
                <Row label={t('website.manage.theme')} testId="website-overview-theme">
                    <span>{themeText(theme, 'name', lang)}</span>
                    <button type="button" className="block ms-auto text-xs text-indigo-300 hover:underline mt-1" onClick={() => scrollTo('website-theme')} data-testid="website-overview-change-theme">{t('website.manage.changeTheme')}</button>
                </Row>
                <Row label={t('website.manage.lastUpdated')} testId="website-overview-updated">
                    <span data-testid="website-overview-updated-at">{published ? formatDate(site.publishedAt, 'datetime') : t('website.manage.never')}</span>
                    {outdated !== null && (
                        <span className={`block text-xs ${outdated ? 'text-amber-300' : 'text-emerald-300'}`} data-testid="website-overview-outdated" data-outdated={outdated ? '1' : '0'}>
                            {t(outdated ? 'website.manage.outdated' : 'website.manage.upToDate')}
                        </span>
                    )}
                </Row>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
                <Button variant="secondary" onClick={() => setPreviewing(true)} data-testid="website-overview-preview"><Globe className="w-4 h-4" /> {t('website.manage.preview')}</Button>
                <Button onClick={update} loading={running || busy === 'publish'} disabled={!site.canPublish} data-testid="website-overview-update">
                    <RefreshCw className="w-4 h-4" /> {running ? t(published ? 'website.update.running' : 'website.publish.running') : published ? t('website.updateNow') : t('website.publish.create')}
                </Button>
            </div>
            {previewing && <WebsitePreview site={site} onClose={() => setPreviewing(false)} onUpdate={() => { setPreviewing(false); update(); }} />}
        </section>
    );
}

function RenameAddress({ site, busy, run }) {
    const { t } = useT();
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(site.name);
    if (!open) return <Button size="sm" variant="ghost" onClick={() => { setName(site.name); setOpen(true); }}>{t('website.rename')}</Button>;
    return (
        <div className="w-full space-y-2">
            <AddressField value={name} onChange={setName} owner={site.freeOwner} />
            <div className="flex gap-2">
                <Button size="sm" onClick={() => run('rename', () => window.electronAPI.website.setName(name), () => { setOpen(false); toast.success(t('website.renamed')); })} loading={busy === 'rename'}>{t('common.save')}</Button>
                <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            </div>
        </div>
    );
}

/**
 * Create Website (then Update website): what it needs (GitHub, Cloudflare,
 * a theme), one button, the steps as they run, then the address. Every
 * technical part is made by the program on the shop's own accounts; the
 * screen names none of them.
 */
export function PublishPanel({ site, setSite, busy, run, outdated = null }) {
    const { t, lang } = useT();
    const api = window.electronAPI.website;
    const deploy = site.deploy || { status: 'idle', steps: [] };
    const running = deploy.status === 'running';
    const published = !!site.publishedAt;
    const req = site.requirements || {};
    const theme = site.themes?.find(x => x.id === site.theme);
    const last = useRef(deploy.status);
    const failToast = useRef(null);

    // Follow the run while it goes on
    useEffect(() => {
        if (!running) return undefined;
        const timer = setInterval(() => { api.getState().then(setSite).catch(() => {}); }, 1500);
        return () => clearInterval(timer);
    }, [running]);
    // Say how it ended
    useEffect(() => {
        if (last.current === 'running' && deploy.status !== 'running') {
            if (deploy.status === 'done' && deploy.mode === 'update') toast.success(t(site.site?.unchanged ? 'website.update.unchangedToast' : 'website.update.doneToast'));
            else if (deploy.status === 'done') toast.success(t('website.publish.doneToast'));
            else if (deploy.status === 'waiting') toast.info(t('website.publish.waitingToast'), 7000);
            else if (deploy.status === 'failed') failToast.current = toast.error(t(`website.publish.reason.${deploy.reason || 'unknown'}`), 8000);
        }
        last.current = deploy.status;
    }, [deploy.status]);

    const start = () => run('publish', () => {
        // Try again: the message of the failed run goes away
        if (failToast.current) { toast.dismiss(failToast.current); failToast.current = null; }
        return api.publish();
    }, (next) => {
        const r = next?.result;
        if (r && !r.started && r.reason !== 'running') toast.error(t(`website.publish.reason.${r.reason}`), 7000);
    });
    const recheck = () => run('recheck', () => api.recheck(), (next) => {
        if (next?.result?.live) toast.success(t('website.publish.doneToast'));
        else toast.info(t('website.publish.stillWaiting'), 6000);
    });
    const copy = () => navigator.clipboard?.writeText(site.site.url).then(() => toast.success(t('website.copied')), () => {});
    const checks = [
        { id: 'github', ok: req.github, text: req.githubPermission ? t('website.publish.needGithubAgain') : t('website.publish.needGithub') },
        { id: 'cloudflare', ok: req.cloudflare, text: t('website.publish.needCloudflare') },
        { id: 'theme', ok: req.theme, text: theme ? t('website.publish.themeIs', { name: theme.name?.[lang] || theme.id }) : t('website.publish.needTheme') },
    ];

    return (
        <section className="card space-y-4 xl:col-span-2" data-testid="website-status" data-deploy={deploy.status}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="font-semibold">{t('website.statusTitle')}</h2>
                    <p className="text-sm text-zinc-400 mt-1">{t(`website.statusText.${site.status}`)}</p>
                </div>
                <span className={`badge text-sm px-3 py-1 ${STATUS_STYLE[site.status] || STATUS_STYLE.none}`} data-testid="website-status-badge" data-status={site.status}>
                    {t(`website.status.${site.status}`)}
                </span>
            </div>

            {/* The address, once the website answers */}
            {published && site.site?.url && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3" data-testid="website-live">
                    <p className="text-sm text-emerald-300 font-medium">{t('website.publish.liveTitle')}</p>
                    <p dir="ltr" className="font-mono text-base break-all" data-testid="website-live-url">{site.site.url}</p>
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => api.openSite().catch(() => {})} data-testid="website-open-site"><Globe className="w-4 h-4" /> {t('website.publish.open')}</Button>
                        <Button size="sm" variant="secondary" onClick={copy}><Copy className="w-4 h-4" /> {t('website.copy')}</Button>
                    </div>
                    <p className="text-xs text-zinc-500" data-testid="website-last-updated">{t('website.update.lastUpdated', { date: formatDate(site.publishedAt, 'datetime') })}</p>
                    {site.site?.unchanged && site.site?.checkedAt && deploy.status === 'done' && outdated !== true && (
                        <p className="text-xs text-zinc-500" data-testid="website-checked">{t('website.update.checkedAt', { date: formatDate(site.site.checkedAt, 'datetime') })}</p>
                    )}
                </div>
            )}
            {published && !running && outdated !== null && (
                <p className={`text-sm rounded-lg px-3 py-2 ${outdated ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/5 text-emerald-300'}`} data-testid="website-outdated" data-outdated={outdated ? '1' : '0'}>
                    {t(outdated ? 'website.update.outdated' : 'website.update.upToDate')}
                </p>
            )}

            {/* What Create Website needs */}
            {!published && (
                <ul className="grid fit-grid-sm gap-2" data-testid="website-requirements">
                    {checks.map(c => (
                        <li key={c.id} data-testid={`website-req-${c.id}`} data-ok={c.ok ? '1' : '0'}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${c.ok ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-dark-border'}`}>
                            {c.ok ? STEP_ICON.done : STEP_ICON.pending}
                            <span className="min-w-0 leading-snug">{c.ok && c.id !== 'theme' ? t(`website.publish.ok.${c.id}`) : c.text}</span>
                        </li>
                    ))}
                </ul>
            )}

            {/* The run, step by step */}
            {deploy.steps.length > 0 && (deploy.status !== 'done' || running) && (
                <ol className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5" data-testid="website-progress">
                    {deploy.steps.map((step, i) => (
                        <li key={step.id} className="flex items-center gap-2 text-sm" data-testid={`website-step-${step.id}`} data-status={step.status}>
                            {STEP_ICON[step.status] || STEP_ICON.pending}
                            <span className={`min-w-0 leading-snug ${step.status === 'pending' ? 'text-zinc-500' : ''}`}><span className="text-zinc-500">{i + 1}. </span>{t(`website.publish.step.${step.id}`)}</span>
                        </li>
                    ))}
                </ol>
            )}
            {deploy.status === 'failed' && (
                <div className="space-y-1" data-testid="website-publish-error">
                    <p className="text-sm text-red-300 leading-relaxed">{t(`website.publish.reason.${deploy.reason || 'unknown'}`)}</p>
                    {published && <p className="text-xs text-zinc-400" data-testid="website-previous-online">{t('website.update.previousOnline')}</p>}
                </div>
            )}
            {deploy.status === 'waiting' && (
                <div className="flex flex-wrap items-center gap-3 text-sm text-amber-300">
                    <span className="leading-relaxed">{t('website.publish.waiting')}</span>
                    <Button size="sm" variant="secondary" onClick={recheck} loading={busy === 'recheck'} data-testid="website-recheck">{t('website.publish.checkNow')}</Button>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-dark-border">
                <p className="text-xs text-zinc-500 max-w-md leading-relaxed">{published ? t('website.publish.updateHint') : t('website.publish.createHint')}</p>
                <Button onClick={start} loading={running || busy === 'publish'} disabled={!site.canPublish} data-testid="website-publish">
                    {published ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                    {running ? t(published ? 'website.update.running' : 'website.publish.running') : deploy.status === 'failed' ? t('website.publish.retry') : published ? t('website.updateNow') : t('website.publish.create')}
                </Button>
            </div>
        </section>
    );
}
