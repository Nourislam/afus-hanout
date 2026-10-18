// Website › Theme tab: the theme studio with its preview.
import { useEffect, useRef, useState } from 'react';
import { Palette, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { useT } from '../../i18n';

/** A theme's name / description in the window's language (they come with the theme). */
export const themeText = (theme, key, lang) => theme?.[key]?.[lang] || theme?.[key]?.ar || theme?.id || '';

/**
 * A small drawing of a theme's home page from its own choices: header kind,
 * colours, title font, card shape. No picture of the shop is needed.
 */
function ThemeThumb({ theme }) {
    const c = theme.colors;
    const look = theme.look || {};
    const bold = look.header === 'bold';
    const centered = look.header === 'centered';
    const ratio = { '1/1': 1, '4/5': 1.25, '3/4': 1.33, '2/3': 1.5 }[look.ratio] || 1.33;
    const r = Math.min(10, look.radius ?? 6);
    return (
        <span className="block rounded-lg overflow-hidden border border-black/10" style={{ background: c.background }} aria-hidden="true">
            <span className={`flex items-center gap-1.5 px-2 h-5 ${centered ? 'justify-center' : ''}`} style={{ background: bold ? c.primary : c.background, borderBottom: `1px solid ${c.border}` }}>
                <span className="block h-1.5 w-8 rounded-sm" style={{ background: bold ? c.onPrimary : c.text }} />
                {!centered && [0, 1, 2].map(i => <span key={i} className="block h-1 w-4 rounded-sm opacity-50" style={{ background: bold ? c.onPrimary : c.muted }} />)}
            </span>
            <span className="flex items-center gap-2 px-2 py-2" style={{ background: c.surface }}>
                <span className="text-base leading-none" style={{ fontFamily: look.headingFont, fontWeight: look.headingWeight, color: c.text, textTransform: look.headingCase === 'upper' ? 'uppercase' : 'none' }}>Aa</span>
                <span className="flex-1 h-1.5 rounded-sm opacity-40" style={{ background: c.muted }} />
                <span className="block h-3 w-8" style={{ background: c.primary, borderRadius: Math.min(look.buttonRadius ?? 6, 8) }} />
            </span>
            <span className="grid grid-cols-4 gap-1.5 p-2">
                {[0, 1, 2, 3].map(i => (
                    <span key={i} className="block" style={{ aspectRatio: `1 / ${ratio}`, background: i === 1 ? c.accent : `${c.text}14`, borderRadius: r, border: look.card === 'bordered' ? `1px solid ${c.border}` : 0 }} />
                ))}
            </span>
        </span>
    );
}

export function ThemePicker({ themes = [], value, onChange, disabled, current }) {
    const { t, lang } = useT();
    return (
        <div className="grid fit-grid-sm gap-3" role="radiogroup" aria-label={t('website.theme')}>
            {themes.map(theme => {
                const active = theme.id === value;
                return (
                    <button key={theme.id} type="button" role="radio" aria-checked={active} disabled={disabled} onClick={() => onChange(theme.id)}
                        data-testid={`website-theme-${theme.id}`}
                        className={`rounded-xl border p-3 text-start transition-colors ${active ? 'border-indigo-500 bg-indigo-500/10' : 'border-dark-border hover:border-zinc-500'}`}>
                        <ThemeThumb theme={theme} />
                        <span className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">{themeText(theme, 'name', lang)}</span>
                            {current === theme.id
                                ? <span className="badge bg-emerald-500/15 text-emerald-300 whitespace-nowrap">{t('website.themeCurrent')}</span>
                                : active && <CheckCircle2 className="w-4 h-4 text-indigo-300 flex-none" />}
                        </span>
                        <span className="block text-xs text-zinc-500 leading-snug mt-1">{themeText(theme, 'description', lang)}</span>
                    </button>
                );
            })}
        </div>
    );
}

const PREVIEW_PAGES = ['home', 'category', 'product'];
const PREVIEW_WIDTH = { desktop: 1280, mobile: 390 };
const PREVIEW_HEIGHT = 620;

/**
 * Themes of the website: pick one to see the shop's own website in it
 * (home, a category, an article; computer or phone), then keep it. The
 * page is drawn by the program from the shop's data and shown in a frame
 * that runs no script and cannot reach the program.
 */
export function ThemeStudio({ site, busy, run }) {
    const { t, lang } = useT();
    const api = window.electronAPI.website;
    const [picked, setPicked] = useState(site.theme);
    const [page, setPage] = useState('home');
    const [device, setDevice] = useState('desktop');
    const [preview, setPreview] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => { setPicked(site.theme); }, [site.theme]);
    useEffect(() => {
        let alive = true;
        setFailed(false);
        api.previewTheme({ theme: picked, page }).then((r) => { if (alive) setPreview(r); }, () => { if (alive) setFailed(true); });
        return () => { alive = false; };
    // The home picture changed: drawn again
    }, [picked, page, JSON.stringify(site.publicInfo?.hero || null)]);
    const chosen = site.themes.find(x => x.id === picked);
    const online = !!site.publishedAt;
    // Online already: the website's pages are made again with the new look (the shop's data is only read)
    const keep = () => run('theme', () => api.setTheme(picked, { publish: online }), (next) => {
        toast.success(t(next?.result?.published ? 'website.themeSavedUpdating' : 'website.themeSaved'));
    });

    return (
        <section className="card space-y-4 xl:col-span-2" data-testid="website-theme" id="website-theme">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="font-semibold flex items-center gap-2"><Palette className="w-4 h-4 text-indigo-300" /> {t('website.theme')}</h2>
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{t('website.themeHint')}</p>
                </div>
            </div>
            <ThemePicker themes={site.themes} value={picked} current={site.theme} disabled={busy === 'theme'} onChange={setPicked} />

            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1 rounded-lg bg-dark-tertiary/60 p-1" role="tablist" aria-label={t('website.previewPage')}>
                    {PREVIEW_PAGES.map(p => (
                        <button key={p} type="button" role="tab" aria-selected={page === p} onClick={() => setPage(p)} data-testid={`website-preview-page-${p}`}
                            className={`px-3 py-1.5 rounded-md text-sm ${page === p ? 'bg-dark-secondary text-white' : 'text-zinc-400 hover:text-white'}`}>
                            {t(`website.previewPages.${p}`)}
                        </button>
                    ))}
                </div>
                <div className="flex gap-1 rounded-lg bg-dark-tertiary/60 p-1" role="tablist" aria-label={t('website.previewDevice')}>
                    {['desktop', 'mobile'].map(d => (
                        <button key={d} type="button" role="tab" aria-selected={device === d} onClick={() => setDevice(d)} data-testid={`website-preview-device-${d}`}
                            className={`px-3 py-1.5 rounded-md text-sm ${device === d ? 'bg-dark-secondary text-white' : 'text-zinc-400 hover:text-white'}`}>
                            {t(`website.previewDevices.${d}`)}
                        </button>
                    ))}
                </div>
            </div>

            {failed ? <p className="p-6 text-sm text-zinc-500">{t('website.previewFailed')}</p>
                : <PreviewFrame html={preview?.html} device={device} title={t('website.previewTitle', { name: themeText(chosen, 'name', lang) })} theme={preview?.theme} />}
            {preview && preview.products === 0 && <p className="text-xs text-amber-300">{t('website.previewEmpty')}</p>}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-zinc-500 leading-relaxed max-w-xl">{t('website.themeSafe')}</p>
                {picked === site.theme
                    ? <span className="badge bg-emerald-500/15 text-emerald-300" data-testid="website-theme-current">{t('website.themeInUse', { name: themeText(chosen, 'name', lang) })}</span>
                    : (
                        <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setPicked(site.theme)}>{t('common.cancel')}</Button>
                            <Button size="sm" onClick={keep} loading={busy === 'theme'} data-testid="website-theme-use">
                                <CheckCircle2 className="w-4 h-4" /> {t(online ? 'website.themeUseUpdate' : 'website.themeUse', { name: themeText(chosen, 'name', lang) })}
                            </Button>
                        </div>
                    )}
            </div>
        </section>
    );
}

/** The website's page drawn by the program, in a frame that runs no script and cannot reach the program. */
export function PreviewFrame({ html, device = 'desktop', title, testId = 'website-preview-frame', theme, onNavigate }) {
    const box = useRef(null);
    const [boxWidth, setBoxWidth] = useState(800);
    useEffect(() => {
        if (!box.current || typeof ResizeObserver === 'undefined') return undefined;
        const ro = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
        ro.observe(box.current);
        return () => ro.disconnect();
    }, []);
    const width = PREVIEW_WIDTH[device];
    // Slightly under the measured width, so rounding never pushes the frame out
    const scale = Math.min(1, Math.max(0.1, (boxWidth - 2) / width));
    // Laid out at the device's width, then drawn smaller from the box's top-left corner
    // (the same in every language: the page has its own direction)
    return (
        <div ref={box} className="w-full">
            <div className="relative rounded-xl border border-dark-border bg-white overflow-hidden mx-auto" style={{ width: Math.floor(width * scale), maxWidth: '100%', height: PREVIEW_HEIGHT }}>
                {html && (
                    <iframe title={title} sandbox={onNavigate ? 'allow-same-origin' : ''} referrerPolicy="no-referrer" srcDoc={html} data-testid={testId} data-theme={theme}
                        onLoad={onNavigate ? (e) => followLinks(e.currentTarget, onNavigate) : undefined}
                        style={{ position: 'absolute', top: 0, left: 0, width, height: PREVIEW_HEIGHT / scale, transform: `scale(${scale})`, transformOrigin: 'top left', border: 0, display: 'block' }} />
                )}
            </div>
        </div>
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

