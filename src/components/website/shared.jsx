// Website screens: what several tabs share (state hook, styles, small parts).
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Circle, XCircle, Clock, Loader2, Settings2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { translateError } from '../../i18n/errors';
import { useT } from '../../i18n';

export const STATUS_STYLE = {
    none: 'bg-zinc-500/20 text-zinc-300',
    accounts: 'bg-amber-500/15 text-amber-300',
    ready: 'bg-sky-500/15 text-sky-300',
    live: 'bg-emerald-500/15 text-emerald-300',
    error: 'bg-red-500/15 text-red-300',
    publishing: 'bg-sky-500/15 text-sky-300',
    updating: 'bg-sky-500/15 text-sky-300',
    // The update failed: the website is still online as it was
    update_failed: 'bg-amber-500/15 text-amber-300',
};
export const ACCOUNT_STYLE = {
    not_connected: 'bg-zinc-500/20 text-zinc-300',
    connected: 'bg-emerald-500/15 text-emerald-300',
    choose_account: 'bg-amber-500/15 text-amber-300',
    failed: 'bg-red-500/15 text-red-300',
    waiting: 'bg-indigo-500/15 text-indigo-300',
};
export const GITHUB_STYLE = {
    not_connected: 'bg-zinc-500/20 text-zinc-300',
    connected: 'bg-emerald-500/15 text-emerald-300',
    failed: 'bg-red-500/15 text-red-300',
};

/**
 * Website Manager: the shop's own website, in the shop's words. A name for
 * the free address, a theme, the two accounts it is published with and an
 * optional own domain. Nothing technical is asked (no repository, token,
 * DNS...): the program chooses all that when the accounts are linked.
 */
/** The Website screen's state and its one action at a time (both pages). */
export function useWebsite() {
    const [site, setSite] = useState(null);
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState('');

    const load = useCallback(async () => {
        try {
            const [view, figures] = await Promise.all([window.electronAPI.website.getState(), window.electronAPI.website.preview()]);
            setSite(view);
            setPreview(figures);
            return view;
        } catch (error) {
            toast.error(translateError(error));
            setSite((s) => s || { created: false, status: 'none', themes: [], providers: {}, steps: [] });
        }
    }, []);
    // One action at a time; the screen shows the answer of the main process
    const run = async (id, fn, done) => {
        setBusy(id);
        try {
            const next = await fn();
            if (next) setSite(next);
            done?.(next);
        } catch (error) {
            toast.error(translateError(error));
        } finally {
            setBusy('');
        }
    };
    return { site, setSite, preview, busy, run, load };
}

export const Spinner = () => <div className="page"><div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div></div>;

/** "https://<account>.github.io/" [name] "/": the shop types only its name. */
export function AddressField({ value, onChange, owner }) {
    const { t } = useT();
    return (
        <div dir="ltr" className="flex items-stretch rounded-lg border border-dark-border bg-dark-secondary overflow-hidden focus-within:border-indigo-500">
            <span className="px-3 flex items-center text-sm text-zinc-500 bg-dark-tertiary/60 flex-none max-w-[45%] truncate">{`https://${owner || '…'}.github.io/`}</span>
            <input
                className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm font-mono outline-none"
                value={value}
                onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                maxLength={40}
                aria-label={t('website.nameTitle')}
                data-testid="website-name"
            />
            <span className="px-3 flex items-center text-sm text-zinc-500 bg-dark-tertiary/60 flex-none">/</span>
        </div>
    );
}

/** Changes in the shop the website does not show yet: looked at once, shared by the cards. */
export function useOutdated(site) {
    const [outdated, setOutdated] = useState(null);
    const running = site.deploy?.status === 'running';
    const published = !!site.publishedAt;
    useEffect(() => {
        if (running || !published) { setOutdated(null); return; }
        let alive = true;
        window.electronAPI.website.changes().then(r => { if (alive) setOutdated(r?.outdated ?? null); }, () => { if (alive) setOutdated(null); });
        return () => { alive = false; };
    }, [running, published, site.publishedAt, site.theme, site.site?.checkedAt]);
    return outdated;
}
export const DOMAIN_STYLE = {
    dns_needed: 'bg-amber-500/15 text-amber-300', dns_wrong: 'bg-red-500/15 text-red-300', connecting: 'bg-sky-500/15 text-sky-300',
    https_pending: 'bg-sky-500/15 text-sky-300', active: 'bg-emerald-500/15 text-emerald-300', failed: 'bg-red-500/15 text-red-300',
};

export const STEP_ICON = {
    done: <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-none" />,
    failed: <XCircle className="w-4 h-4 text-red-400 flex-none" />,
    waiting: <Clock className="w-4 h-4 text-amber-300 flex-none" />,
    running: <Loader2 className="w-4 h-4 text-indigo-300 flex-none animate-spin" />,
    pending: <Circle className="w-4 h-4 text-zinc-600 flex-none" />,
};

/** One card of the settings tabs: title, hint, body, a Save at the bottom when it has one. */
export function SettingsCard({ testId, icon: Icon = Settings2, title, hint, children, onSave, saving }) {
    const { t } = useT();
    return (
        <section className="card space-y-3" data-testid={testId}>
            <h2 className="font-semibold flex items-center gap-2"><Icon className="w-4 h-4 text-indigo-300" /> {title}</h2>
            {hint && <p className="text-xs text-zinc-500 leading-relaxed">{hint}</p>}
            {children}
            {onSave && <div className="flex justify-end"><Button size="sm" onClick={onSave} loading={saving} data-testid={`${testId}-save`}>{t('common.save')}</Button></div>}
        </section>
    );
}
