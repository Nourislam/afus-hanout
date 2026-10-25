// Website › Pages tab: the text of "About us" and of the four policy pages,
// written by the owner (empty: the ready-made text is used).
import { useEffect, useState } from 'react';
import { FileText, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { useT } from '../../i18n';
import { SettingsCard } from './shared';

const PAGES = ['about', 'returns', 'terms', 'privacy', 'shipping'];

export function PagesCard({ site, busy, run }) {
    const { t } = useT();
    const saved = site.publicInfo?.pages || {};
    const [pages, setPages] = useState(saved);
    const [open, setOpen] = useState('about');
    useEffect(() => { setPages(saved); }, [JSON.stringify(saved)]);
    const startFromDefault = async (id) => {
        const text = id === 'about' ? '' : await window.electronAPI.website.pageDefault(id);
        setPages(p => ({ ...p, [id]: text || '' }));
    };
    const save = () => run('pages', () => window.electronAPI.website.setSettings({ pages }), () => toast.success(t('website.info.saved')));
    return (
        <SettingsCard testId="website-pages" icon={FileText} title={t('website.pages.title')} hint={t('website.pages.hint')} onSave={save} saving={busy === 'pages'}>
            <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                <nav className="flex lg:flex-col gap-1 overflow-x-auto" aria-label={t('website.pages.title')}>
                    {PAGES.map(id => (
                        <button key={id} type="button" onClick={() => setOpen(id)} aria-pressed={open === id} data-testid={`website-page-${id}`}
                            className={`h-11 px-3 rounded-lg text-sm text-start whitespace-nowrap flex items-center justify-between gap-2 ${open === id ? 'bg-indigo-500/15 text-white' : 'text-zinc-400 hover:bg-dark-tertiary hover:text-white'}`}>
                            <span>{t(`website.sitePreview.page.${id}`)}</span>
                            <span className={`text-[11px] ${pages[id] ? 'text-emerald-400' : 'text-zinc-500'}`}>{pages[id] ? t('website.pages.own') : t('website.pages.default')}</span>
                        </button>
                    ))}
                </nav>
                <div className="space-y-2 min-w-0">
                    <textarea className="input w-full min-h-[min(20rem,40vh)] leading-relaxed" value={pages[open] || ''} maxLength={6000} data-testid="website-page-text"
                        onChange={(e) => setPages(p => ({ ...p, [open]: e.target.value }))}
                        placeholder={t(open === 'about' ? 'website.pages.aboutPlaceholder' : 'website.pages.placeholder')} />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-zinc-500">{t('website.pages.format')}</p>
                        <div className="flex gap-2">
                            {open !== 'about' && <Button size="sm" variant="secondary" onClick={() => startFromDefault(open)} data-testid="website-page-default"><FileText className="w-4 h-4" /> {t('website.pages.startDefault')}</Button>}
                            {pages[open] && <Button size="sm" variant="ghost" onClick={() => setPages(p => ({ ...p, [open]: '' }))}><RotateCcw className="w-4 h-4" /> {t('website.pages.useDefault')}</Button>}
                        </div>
                    </div>
                </div>
            </div>
        </SettingsCard>
    );
}
