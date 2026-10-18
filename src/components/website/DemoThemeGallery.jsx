// Website › Themes, in the web demo (Afus website): each theme is a whole shop
// made beforehand from the demo shop (demo/shops/, site/themes.mjs), opened in
// a new page. Keeping a theme works as in the program.
import { useEffect, useState } from 'react';
import { ArrowUpRight, CheckCircle2, Palette } from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { useT } from '../../i18n';
import { themeText } from './DesignTab';

/** The web demo's theme shops folder, or null in the program. */
export const demoShops = () => (typeof window !== 'undefined' && window.__AFUS_WEB_DEMO__?.shops) || null;

/** A page of a theme's shop (index, or a page from index.json), in the demo's language. */
export function shopUrl(lang, theme, page = 'index.html') {
    const shopLang = lang === 'ar' ? 'ar' : 'fr';
    return `${demoShops()}${shopLang}/${encodeURIComponent(theme)}/${page}`;
}

const open = (url) => window.open(url, '_blank', 'noopener');

export function DemoThemeGallery({ site, busy, run }) {
    const { t, lang } = useT();
    const [shops, setShops] = useState(null);
    const shopLang = lang === 'ar' ? 'ar' : 'fr';
    useEffect(() => {
        let alive = true;
        fetch(`${demoShops()}index.json`).then(r => r.json()).then((j) => { if (alive) setShops(j[shopLang] || {}); }).catch(() => { if (alive) setShops({}); });
        return () => { alive = false; };
    }, [shopLang]);
    const keep = (id) => run('theme', () => window.electronAPI.website.setTheme(id, { publish: false }), () => toast.success(t('website.themeSaved')));

    return (
        <section className="card space-y-4 xl:col-span-2" data-testid="website-theme" id="website-theme">
            <div>
                <h2 className="font-semibold flex items-center gap-2"><Palette className="w-4 h-4 text-indigo-300" /> {t('website.theme')}</h2>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{t('website.gallery.hint')}</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="website-theme-gallery">
                {site.themes.map((theme) => {
                    const shop = shops?.[theme.id];
                    const current = site.theme === theme.id;
                    return (
                        <article key={theme.id} data-testid={`website-gallery-${theme.id}`}
                            className={`rounded-2xl border overflow-hidden flex flex-col bg-zinc-900/60 ${current ? 'border-indigo-400 ring-2 ring-indigo-500/40' : 'border-zinc-800'}`}>
                            <button type="button" onClick={() => open(shopUrl(lang, theme.id))} className="block aspect-[16/10] bg-zinc-800 overflow-hidden" aria-label={t('website.gallery.open')}>
                                <img src={`${demoShops()}img/${theme.id}-${shopLang}.webp`} alt="" loading="lazy" className="w-full h-full object-cover object-top" />
                            </button>
                            <div className="p-4 flex flex-col gap-2 flex-1">
                                <h3 className="font-semibold flex items-center gap-2">
                                    {themeText(theme, 'name', lang)}
                                    {current && <span className="badge bg-indigo-500/15 text-indigo-300 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {t('website.gallery.chosen')}</span>}
                                </h3>
                                <p className="text-sm text-zinc-400">{themeText(theme, 'description', lang)}</p>
                                {shop && <p className="text-xs text-zinc-500">{t('website.gallery.pages', { n: shop.pages })}</p>}
                                <div className="flex flex-wrap gap-2 mt-auto pt-1">
                                    <Button size="sm" onClick={() => open(shopUrl(lang, theme.id))} data-testid={`website-gallery-open-${theme.id}`}><ArrowUpRight className="w-4 h-4" /> {t('website.gallery.open')}</Button>
                                    {shop?.first?.product && <Button size="sm" variant="secondary" onClick={() => open(shopUrl(lang, theme.id, shop.first.product))}>{t('website.gallery.product')}</Button>}
                                    {shop?.first?.category && <Button size="sm" variant="secondary" onClick={() => open(shopUrl(lang, theme.id, shop.first.category))}>{t('website.gallery.category')}</Button>}
                                    {!current && <Button size="sm" variant="secondary" onClick={() => keep(theme.id)} disabled={busy === 'theme'} data-testid={`website-gallery-keep-${theme.id}`}>{t('website.gallery.keep')}</Button>}
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>
            <p className="text-xs text-zinc-500">{t('website.gallery.note')}</p>
        </section>
    );
}
