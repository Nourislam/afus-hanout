// Website › the shop's website seen in a theme: on a computer (in a browser
// window) or on a phone (in a phone), every page, as a customer sees it.
// Used by the Themes tab (each theme's card, then the whole shop) and by
// Overview › Preview website.
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { Modal, ModalBody } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useT } from '../../i18n';
import { themeText } from './DesignTab';

// Every page of the website, as the preview offers them
export const SITE_PAGES = ['home', 'products', 'categories', 'category', 'product', 'new', 'best', 'offers', 'cart', 'checkout', 'about', 'contact', 'location', 'returns', 'terms', 'privacy', 'shipping'];
// The page is laid out at the width of the screen it is seen on
export const SCREEN = { desktop: { width: 1280, height: 800 }, mobile: { width: 390, height: 844 } };

/** The width of a box, followed as the window changes. */
function useBoxWidth(fallback = 800) {
    const ref = useRef(null);
    const [width, setWidth] = useState(fallback);
    useEffect(() => {
        if (!ref.current || typeof ResizeObserver === 'undefined') return undefined;
        const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
        ro.observe(ref.current);
        return () => ro.disconnect();
    }, []);
    return [ref, width];
}

/**
 * A page laid out at the screen's width, drawn smaller from its top-left corner
 * (the same in every language: the page has its own direction). html: drawn by
 * the program, in a frame that runs no script and cannot reach the program;
 * src: a page of the web demo's theme shops.
 */
function Screen({ html, src, device, scale, height, title, testId, theme, onNavigate, still }) {
    const { width } = SCREEN[device];
    const common = {
        title, 'data-testid': testId, 'data-theme': theme, tabIndex: still ? -1 : undefined,
        style: { position: 'absolute', top: 0, left: 0, width, height: height / scale, transform: `scale(${scale})`, transformOrigin: 'top left', border: 0, display: 'block', pointerEvents: still ? 'none' : undefined },
    };
    if (src) return <iframe {...common} src={src} loading="lazy" />;
    if (!html) return null;
    return (
        <iframe {...common} sandbox={onNavigate ? 'allow-same-origin' : ''} referrerPolicy="no-referrer" srcDoc={html}
            onLoad={onNavigate ? (e) => followLinks(e.currentTarget, onNavigate) : undefined} />
    );
}

/** A phone around a screen of the given size. */
function Phone({ w, h, children, small }) {
    const pad = small ? 4 : 10;
    return (
        <div className={`relative bg-zinc-950 border border-zinc-700 shadow-2xl ${small ? 'rounded-[14px]' : 'rounded-[2.6rem]'}`} style={{ padding: pad, width: w + pad * 2 + 2 }}>
            <div className={`relative overflow-hidden bg-white ${small ? 'rounded-[10px]' : 'rounded-[2rem]'}`} style={{ width: w, height: h }}>
                {children}
                <span aria-hidden="true" className="absolute top-1.5 left-1/2 -translate-x-1/2 rounded-full bg-zinc-950" style={{ width: small ? 22 : 90, height: small ? 5 : 22 }} />
            </div>
        </div>
    );
}

/** A browser window around a screen. */
function Browser({ children, height, label }) {
    return (
        <div className="rounded-xl border border-dark-border overflow-hidden bg-white shadow-xl">
            <div className="flex items-center gap-1.5 h-8 px-3 bg-zinc-800 border-b border-zinc-700" aria-hidden="true">
                {['bg-red-400', 'bg-amber-400', 'bg-emerald-400'].map(c => <span key={c} className={`w-2.5 h-2.5 rounded-full ${c}`} />)}
                {label && <span dir="ltr" className="mx-auto max-w-[60%] truncate rounded-md bg-zinc-900 px-3 py-0.5 text-[11px] text-zinc-400">{label}</span>}
            </div>
            <div className="relative overflow-hidden" style={{ height }}>{children}</div>
        </div>
    );
}

/**
 * The website's page on a computer or a phone, as large as the box allows.
 * onNavigate: the page's links open the page they name, inside the preview.
 */
export function PreviewFrame({ html, src, device = 'desktop', title, testId = 'website-preview-frame', theme, onNavigate, height = 620, label }) {
    const [box, boxWidth] = useBoxWidth();
    const loading = !html && !src;
    if (device === 'mobile') {
        const s = SCREEN.mobile;
        const scale = Math.min(1, Math.max(0.2, (boxWidth - 24) / s.width), (height - 22) / s.height);
        return (
            <div ref={box} className="w-full flex justify-center py-1" data-device="mobile">
                <Phone w={Math.floor(s.width * scale)} h={Math.floor(s.height * scale)}>
                    {loading ? <Waiting /> : <Screen html={html} src={src} device="mobile" scale={scale} height={s.height * scale} title={title} testId={testId} theme={theme} onNavigate={onNavigate} />}
                </Phone>
            </div>
        );
    }
    // Slightly under the measured width, so rounding never pushes the frame out
    const scale = Math.min(1, Math.max(0.1, (boxWidth - 2) / SCREEN.desktop.width));
    return (
        <div ref={box} className="w-full" data-device="desktop">
            <Browser height={height} label={label}>
                {loading ? <Waiting /> : <Screen html={html} src={src} device="desktop" scale={scale} height={height} title={title} testId={testId} theme={theme} onNavigate={onNavigate} />}
            </Browser>
        </div>
    );
}

const Waiting = () => <div className="absolute inset-0 animate-pulse bg-zinc-200" />;

/**
 * A theme's card picture: its home page on a computer, and the same page on a
 * phone in front. Pictures (web demo) or the program's own page (html).
 */
export function ThemeShot({ html, desktopImg, phoneImg, title }) {
    const [box, w] = useBoxWidth(480);
    const h = Math.round(w * 0.62);
    const phoneW = Math.round(w * 0.24);
    const phoneScale = phoneW / SCREEN.mobile.width;
    const phoneH = Math.round(SCREEN.mobile.height * phoneScale * 0.82);
    const deskScale = w / SCREEN.desktop.width;
    const img = (src, cls) => <img src={src} alt="" loading="lazy" className={`absolute inset-0 w-full h-full object-cover object-top ${cls || ''}`} onError={(e) => { e.currentTarget.style.display = 'none'; }} />;
    return (
        <div ref={box} className="relative w-full overflow-hidden bg-zinc-800" style={{ height: h }} aria-hidden="true">
            {desktopImg ? img(desktopImg) : html ? <Screen html={html} device="desktop" scale={deskScale} height={h} title={title} still /> : <Waiting />}
            <div className="absolute bottom-3 end-3">
                <Phone w={phoneW} h={phoneH} small>
                    {phoneImg ? img(phoneImg) : html ? <Screen html={html} device="mobile" scale={phoneScale} height={phoneH} title={title} still /> : <Waiting />}
                </Phone>
            </div>
        </div>
    );
}

/** Computer / phone. */
export function DeviceTabs({ value, onChange, testId = 'website-preview-device' }) {
    const { t } = useT();
    return (
        <div className="flex gap-1 rounded-lg bg-dark-tertiary/60 p-1" role="tablist" aria-label={t('website.previewDevice')}>
            {['desktop', 'mobile'].map(d => (
                <button key={d} type="button" role="tab" aria-selected={value === d} onClick={() => onChange(d)} data-testid={`${testId}-${d}`}
                    className={`px-3 py-1.5 rounded-md text-sm ${value === d ? 'bg-dark-secondary text-white' : 'text-zinc-400 hover:text-white'}`}>
                    {t(`website.previewDevices.${d}`)}
                </button>
            ))}
        </div>
    );
}

/** As tall as the window allows, under the dialog's own rows. */
const viewerHeight = () => Math.max(320, Math.min(780, (typeof window !== 'undefined' ? window.innerHeight : 900) - 340));

/**
 * The whole shop in a theme, made from the shop's own data as it is now:
 * every page (its links open the page they name), computer or phone; another
 * theme can be picked here too. Read only, until "Use" (onKeep) or Update (onPublish).
 */
export function ThemeViewer({ site, theme: startTheme, page: startPage = 'home', device: startDevice = 'desktop', onClose, onKeep, onPublish, busy }) {
    const { t, lang } = useT();
    const api = window.electronAPI.website;
    const [themeId, setThemeId] = useState(startTheme || site.theme);
    const [page, setPage] = useState(startPage);
    const [id, setId] = useState(null);
    const [device, setDevice] = useState(startDevice);
    const [preview, setPreview] = useState(null);
    const [failed, setFailed] = useState(false);
    // Opened on "a category": its first one, once known
    const firstCategory = useRef(startPage === 'category');
    const theme = site.themes?.find(x => x.id === themeId);
    const inUse = themeId === site.theme;
    const navigate = (kind, target) => {
        if (kind === 'home') { setPage('home'); setId(null); } else if (kind === 'page' && SITE_PAGES.includes(target)) { setPage(target); setId(null); } else if (kind === 'category' || kind === 'product') { setPage(kind); setId(target); }
    };
    useEffect(() => {
        let alive = true;
        setFailed(false);
        setPreview(null);
        api.previewTheme({ theme: themeId, page, id }).then((r) => {
            if (!alive) return;
            if (firstCategory.current && page === 'category' && !id && r.categories?.[0]) { firstCategory.current = false; setId(r.categories[0].id); return; }
            setPreview(r);
        }, () => { if (alive) setFailed(true); });
        return () => { alive = false; };
    }, [themeId, page, id]);
    const name = themeText(theme, 'name', lang);
    const online = !!site.publishedAt;
    return (
        <Modal isOpen onClose={onClose} title={onPublish ? t('website.sitePreview.title') : t('website.previewTitle', { name })} size="full">
            <ModalBody><div className="space-y-3" data-testid="website-site-preview">
                {onPublish && <p className="text-xs text-zinc-400 leading-relaxed">{t(online ? 'website.sitePreview.hintOnline' : 'website.sitePreview.hintFirst', { theme: name })}</p>}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <select className="input w-auto max-w-[14rem] py-1.5 text-sm" value={themeId} onChange={(e) => setThemeId(e.target.value)} aria-label={t('website.theme')} data-testid="website-viewer-theme">
                            {site.themes.map(x => <option key={x.id} value={x.id}>{themeText(x, 'name', lang)}{x.id === site.theme ? ` · ${t('website.themeCurrent')}` : ''}</option>)}
                        </select>
                        <select className="input w-auto max-w-[14rem] py-1.5 text-sm" value={page} onChange={(e) => { setPage(e.target.value); setId(null); }} aria-label={t('website.previewPage')} data-testid="website-site-preview-page">
                            {SITE_PAGES.map(p => <option key={p} value={p}>{t(`website.sitePreview.page.${p}`)}</option>)}
                        </select>
                        {page === 'category' && preview?.categories?.length > 0 && (
                            <select className="input w-auto max-w-[14rem] py-1.5 text-sm" value={id || ''} onChange={(e) => setId(e.target.value || null)} aria-label={t('website.previewPages.category')}>
                                <option value="">{t('website.sitePreview.page.products')}</option>
                                {preview.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        )}
                    </div>
                    <DeviceTabs value={device} onChange={setDevice} testId="website-site-preview-device" />
                </div>
                {failed ? <p className="p-6 text-sm text-zinc-500">{t('website.previewFailed')}</p>
                    : <PreviewFrame html={preview?.html} device={device} title={t('website.previewTitle', { name })} testId="website-site-preview-frame" theme={preview?.theme} onNavigate={navigate} height={viewerHeight()} label={site.site?.freeUrl || site.freeUrl} />}
                {preview && preview.products === 0 && <p className="text-xs text-amber-300">{t('website.previewEmpty')}</p>}
                {preview && page === 'new' && preview.newProducts === 0 && <p className="text-xs text-zinc-500">{t('website.sitePreview.noNew')}</p>}
                {preview && page === 'best' && preview.bestSellers === 0 && <p className="text-xs text-zinc-500">{t('website.sitePreview.noBest')}</p>}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-zinc-500 leading-relaxed max-w-xl">{t('website.themeSafe')}</p>
                    <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="ghost" onClick={onClose}>{t('common.close')}</Button>
                        {inUse
                            ? <span className="badge bg-emerald-500/15 text-emerald-300 self-center" data-testid="website-theme-current">{t('website.themeInUse', { name })}</span>
                            : onKeep && (
                                <Button onClick={() => onKeep(themeId)} loading={busy === 'theme'} data-testid="website-theme-use">
                                    <CheckCircle2 className="w-4 h-4" /> {t(online ? 'website.themeUseUpdate' : 'website.themeUse', { name })}
                                </Button>
                            )}
                        {onPublish && inUse && site.canPublish && <Button onClick={onPublish} data-testid="website-site-preview-publish"><RefreshCw className="w-4 h-4" /> {t(online ? 'website.updateNow' : 'website.publish.create')}</Button>}
                    </div>
                </div>
            </div></ModalBody>
        </Modal>
    );
}

/**
 * The preview's links open the page they name, inside the preview (the page
 * itself runs no script: the program reads the click). Other links do nothing.
 */
function followLinks(frame, onNavigate) {
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.addEventListener('click', (e) => {
        const a = e.target.closest?.('a[href]');
        if (!a) return;
        e.preventDefault();
        const m = /^#go=(.+)$/.exec(a.getAttribute('href') || '');
        if (!m) return;
        const [kind, ...rest] = decodeURIComponent(m[1]).split(':');
        onNavigate(kind, rest.join(':') || null);
    });
    doc.addEventListener('submit', (e) => e.preventDefault());
}
