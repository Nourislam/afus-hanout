// Website › Theme tab: the theme gallery, each theme's whole shop on a computer or a phone.
import { useEffect, useRef, useState } from 'react';
import { Palette, CheckCircle2, Store } from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { useT } from '../../i18n';
import { DemoThemeGallery, demoShops } from './DemoThemeGallery';
import { ThemeShot, ThemeViewer } from './ThemeViewer';

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

/**
 * Themes of the website, as in the web demo: a card per theme showing the
 * shop's own home page in it (computer and phone), opening the whole shop
 * (every page, computer or phone), then keeping the one the shop likes. The
 * pages are drawn by the program from the shop's data, in frames that run no
 * script and cannot reach the program.
 */
export function ThemeStudio(props) {
    // The web demo (Afus website): the theme shops made beforehand, opened in a new page
    return demoShops() ? <DemoThemeGallery {...props} /> : <LiveThemeGallery {...props} />;
}

/** A theme's home page, asked for once its card is on screen. */
function useHomePreview(themeId, again) {
    const ref = useRef(null);
    const [seen, setSeen] = useState(false);
    const [html, setHtml] = useState(null);
    useEffect(() => {
        if (seen || !ref.current) return undefined;
        if (typeof IntersectionObserver === 'undefined') { setSeen(true); return undefined; }
        const io = new IntersectionObserver((entries) => { if (entries.some(e => e.isIntersecting)) setSeen(true); }, { rootMargin: '200px' });
        io.observe(ref.current);
        return () => io.disconnect();
    }, [seen]);
    useEffect(() => {
        if (!seen) return undefined;
        let alive = true;
        window.electronAPI.website.previewTheme({ theme: themeId, page: 'home' }).then((r) => { if (alive) setHtml(r.html); }, () => {});
        return () => { alive = false; };
    }, [seen, themeId, again]);
    return [ref, html];
}

function LiveThemeCard({ theme, site, again, onOpen, onKeep, busy }) {
    const { t, lang } = useT();
    const [ref, html] = useHomePreview(theme.id, again);
    const current = site.theme === theme.id;
    const name = themeText(theme, 'name', lang);
    return (
        <article ref={ref} data-testid={`website-gallery-${theme.id}`}
            className={`rounded-2xl border overflow-hidden flex flex-col bg-zinc-900/60 ${current ? 'border-indigo-400 ring-2 ring-indigo-500/40' : 'border-zinc-800'}`}>
            <button type="button" onClick={() => onOpen(theme.id)} className="block text-start" aria-label={`${t('website.gallery.open')} · ${name}`}>
                <ThemeShot html={html} title={t('website.previewTitle', { name })} />
            </button>
            <div className="p-4 flex flex-col gap-2 flex-1">
                <h3 className="font-semibold flex items-center gap-2">
                    {name}
                    {current && <span className="badge bg-indigo-500/15 text-indigo-300 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {t('website.themeCurrent')}</span>}
                </h3>
                <p className="text-sm text-zinc-400">{themeText(theme, 'description', lang)}</p>
                <div className="flex flex-wrap gap-2 mt-auto pt-1">
                    <Button size="sm" onClick={() => onOpen(theme.id)} data-testid={`website-gallery-open-${theme.id}`}><Store className="w-4 h-4" /> {t('website.gallery.open')}</Button>
                    {!current && <Button size="sm" variant="secondary" onClick={() => onKeep(theme.id)} disabled={busy === 'theme'} data-testid={`website-gallery-keep-${theme.id}`}>{t('website.gallery.keep')}</Button>}
                </div>
            </div>
        </article>
    );
}

function LiveThemeGallery({ site, busy, run }) {
    const { t } = useT();
    const api = window.electronAPI.website;
    const [open, setOpen] = useState(null);
    // The home picture changed: drawn again
    const again = JSON.stringify(site.publicInfo?.hero || null);
    const online = !!site.publishedAt;
    // Online already: the website's pages are made again with the new look (the shop's data is only read)
    const keep = (id) => run('theme', () => api.setTheme(id, { publish: online }), (next) => {
        toast.success(t(next?.result?.published ? 'website.themeSavedUpdating' : 'website.themeSaved'));
    });
    return (
        <section className="card space-y-4 xl:col-span-2" data-testid="website-theme" id="website-theme">
            <div>
                <h2 className="font-semibold flex items-center gap-2"><Palette className="w-4 h-4 text-indigo-300" /> {t('website.theme')}</h2>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{t('website.gallery.liveHint')}</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="website-theme-gallery">
                {site.themes.map(theme => (
                    <LiveThemeCard key={theme.id} theme={theme} site={site} again={again} busy={busy} onKeep={keep}
                        onOpen={(id) => setOpen({ id })} />
                ))}
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">{t('website.themeSafe')}</p>
            {open && <ThemeViewer site={site} theme={open.id} busy={busy} onKeep={keep} onClose={() => setOpen(null)} />}
        </section>
    );
}
