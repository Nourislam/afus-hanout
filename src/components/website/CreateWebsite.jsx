// Website › first visit: a name for the free address and a theme, then one button.
import { useState } from 'react';
import { Globe, Palette, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { useT } from '../../i18n';
import { AddressField } from './shared';
import { ThemePicker } from './DesignTab';

/** First visit: a name for the free address and a theme, then one button. */
export function CreateWebsite({ site, busy, run }) {
    const { t } = useT();
    const [name, setName] = useState(site.suggestedName || '');
    const [theme, setTheme] = useState(site.theme);
    const create = () => run('create', () => window.electronAPI.website.create({ name, theme }), () => toast.success(t('website.created')));
    return (
        <div className="max-w-3xl mx-auto space-y-5" data-testid="website-create">
            <section className="card text-center space-y-3 py-8">
                <span className="w-14 h-14 rounded-2xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center mx-auto"><Globe className="w-7 h-7" /></span>
                <h2 className="text-xl font-bold">{t('website.createTitle')}</h2>
                <p className="text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">{t('website.createText')}</p>
            </section>

            <section className="card space-y-3">
                <h3 className="font-semibold">{t('website.nameTitle')}</h3>
                <p className="text-xs text-zinc-500">{t('website.nameHint')}</p>
                <AddressField value={name} onChange={setName} owner={site.freeOwner} />
            </section>

            <section className="card space-y-3">
                <h3 className="font-semibold flex items-center gap-2"><Palette className="w-4 h-4 text-indigo-300" /> {t('website.theme')}</h3>
                <ThemePicker themes={site.themes} value={theme} onChange={setTheme} />
            </section>

            <div className="flex justify-center">
                <Button size="lg" onClick={create} loading={busy === 'create'} disabled={!name.trim()} data-testid="website-create-btn">
                    <Sparkles className="w-5 h-5" /> {t('website.create')}
                </Button>
            </div>
        </div>
    );
}
