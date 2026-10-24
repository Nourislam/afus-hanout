import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    Globe, Palette, Package, Tag, Image as ImageIcon, Shirt, PackageCheck, ShoppingBag, LayoutDashboard, Settings2, KeyRound, FileText,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Tabs } from '../components/ui/Tabs';
import { StatTile } from '../components/ui/StatTile';
import { formatNumber } from '../i18n/format';
import { useT } from '../i18n';
import { Spinner, useOutdated, useWebsite } from '../components/website/shared';
import { CreateWebsite } from '../components/website/CreateWebsite';
import { WebsiteOrders } from '../components/website/Orders';
import { WebsiteStats } from '../components/website/Stats';
import { PublishPanel, WebsiteOverview } from '../components/website/OverviewTab';
import { ThemeStudio } from '../components/website/DesignTab';
import { HeroCard, CategoryPicturesCard } from '../components/website/PicturesTab';
import { PagesCard } from '../components/website/PagesTab';
import { WebsiteSettings } from '../components/website/SettingsTab';
import { AccountsProgress, CloudflareAccount, CustomDomain, GithubAccount } from '../components/website/AccountsTab';

export default function WebsitePage() {
    const { t } = useT();
    const { site, setSite, preview, busy, run, load } = useWebsite();
    useEffect(() => {
        // A linked GitHub account: is its key still accepted? (quietly, in the background)
        load().then((view) => {
            if (view?.accounts?.github?.status === 'connected') {
                window.electronAPI.website.githubCheck().then(setSite).catch(() => {});
            }
            if (view?.accounts?.cloudflare?.status === 'connected') {
                window.electronAPI.website.cloudflareCheck().then(setSite).catch(() => {});
            }
        });
    }, [load]);

    if (!site) return <Spinner />;
    return (
        <div className="page" data-testid="website-page">
            <PageHeader icon={Globe} title={t('website.title')} subtitle={t('website.subtitle')} />
            <div className="page-body">
                {site.created
                    ? <WebsiteDashboard site={site} setSite={setSite} preview={preview} busy={busy} run={run} />
                    : <CreateWebsite site={site} busy={busy} run={run} />}
            </div>
        </div>
    );
}

/** The second page: the orders customers sent from the website, the customers, the figures. */
export function WebsiteOrdersPage() {
    const { t } = useT();
    const { site, load } = useWebsite();
    useEffect(() => { load(); }, [load]);
    if (!site) return <Spinner />;
    return (
        <div className="page" data-testid="website-orders-page">
            <PageHeader icon={ShoppingBag} title={t('website.ordersPage.title')} subtitle={t('website.ordersPage.subtitle')} />
            <div className="page-body">
                {site.created
                    ? <div className="grid grid-cols-1 xl:grid-cols-3 gap-4"><WebsiteOrders /><WebsiteStats /></div>
                    : (
                        <section className="card space-y-3 max-w-xl" data-testid="website-orders-none">
                            <p className="text-sm text-zinc-300">{t('website.ordersPage.none')}</p>
                            <Link className="btn btn-primary h-8 px-3 text-sm inline-flex" to="/website">{t('website.ordersPage.create')}</Link>
                        </section>
                    )}
            </div>
        </div>
    );
}

const DASH_TABS = ['overview', 'design', 'pictures', 'pages', 'settings', 'accounts'];
function WebsiteDashboard({ site, setSite, preview, busy, run }) {
    const { t } = useT();
    const outdated = useOutdated(site);
    const [params, setParams] = useSearchParams();
    const tab = DASH_TABS.includes(params.get('tab')) ? params.get('tab') : 'overview';
    const setTab = (id) => setParams((p) => { const next = new URLSearchParams(p); next.set('tab', id); return next; }, { replace: true });
    const tabs = [
        { id: 'overview', label: t('website.tab.overview'), icon: LayoutDashboard },
        { id: 'design', label: t('website.tab.design'), icon: Palette },
        { id: 'pictures', label: t('website.tab.pictures'), icon: ImageIcon },
        { id: 'pages', label: t('website.tab.pages'), icon: FileText },
        { id: 'settings', label: t('website.tab.settings'), icon: Settings2 },
        { id: 'accounts', label: t('website.tab.accounts'), icon: KeyRound },
    ];

    return (
        <div className="space-y-4" data-testid="website-dashboard">
            <Tabs tabs={tabs} value={tab} onChange={setTab} variant="underline" testId="website-tab" />

            {tab === 'overview' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    {/* Create Website / Update website: requirements, progress, address */}
                    <PublishPanel site={site} setSite={setSite} busy={busy} run={run} outdated={outdated} />
                    {/* Website management: status, addresses, theme, last update, Update / Preview */}
                    <WebsiteOverview site={site} busy={busy} run={run} outdated={outdated} />
                    {/* The orders have their own page */}
                    <section className="card space-y-2" data-testid="website-orders-link">
                        <h2 className="font-semibold flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-indigo-300" /> {t('website.ordersPage.title')}</h2>
                        <p className="text-xs text-zinc-500">{t('website.ordersPage.subtitle')}</p>
                        <Link className="btn btn-secondary h-8 px-3 text-sm inline-flex" to="/website-orders" data-testid="website-open-orders">{t('website.ordersPage.open')}</Link>
                    </section>
                    {/* What the website will show (read from the catalogue) */}
                    <section className="card space-y-3 xl:col-span-2" data-testid="website-preview">
                        <h2 className="font-semibold">{t('website.showsTitle')}</h2>
                        {preview ? (
                            <div className="grid fit-grid-sm gap-3">
                                <StatTile icon={Package} label={t('website.shows.products')} value={formatNumber(preview.products)} />
                                <StatTile icon={PackageCheck} label={t('website.shows.available')} value={formatNumber(preview.available)} iconTone="bg-emerald-500/15 text-emerald-300" />
                                <StatTile icon={Tag} label={t('website.shows.onSale')} value={formatNumber(preview.onSale)} iconTone="bg-amber-500/15 text-amber-300" />
                                <StatTile icon={ImageIcon} label={t('website.shows.withImages')} value={formatNumber(preview.withImages)} iconTone="bg-sky-500/15 text-sky-300" />
                                <StatTile icon={Shirt} label={t('website.shows.categories')} value={formatNumber(preview.categories)} />
                            </div>
                        ) : <p className="text-sm text-zinc-500">…</p>}
                        <p className="text-xs text-zinc-500">{t('website.showsHint')}</p>
                    </section>
                </div>
            )}

            {/* Theme: pick, see the shop's own website in it, keep */}
            {tab === 'pictures' && <HeroCard site={site} busy={busy} run={run} />}
            {tab === 'pictures' && <CategoryPicturesCard site={site} busy={busy} run={run} />}
            {tab === 'pages' && <PagesCard site={site} busy={busy} run={run} />}
            {tab === 'design' && <ThemeStudio site={site} busy={busy} run={run} />}

            {tab === 'settings' && <WebsiteSettings site={site} busy={busy} run={run} />}

            {tab === 'accounts' && (
                <div className="space-y-4" data-testid="website-accounts">
                    {/* Where the shop is: the two accounts, then the website made, then online */}
                    <AccountsProgress site={site} />
                    {/* GitHub (keeps the pages) and Cloudflare (receives the orders): side by side, same height */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                        <GithubAccount site={site} setSite={setSite} busy={busy} run={run} />
                        <CloudflareAccount site={site} setSite={setSite} busy={busy} run={run} />
                    </div>
                    {/* Custom Domain (optional) */}
                    <CustomDomain site={site} setSite={setSite} busy={busy} run={run} />
                </div>
            )}
        </div>
    );
}
