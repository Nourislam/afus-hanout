// Website › Pictures tab: the home picture (the shop's own or a ready-made
// photo) and a picture for each category.
import { useEffect, useState } from 'react';
import { Image as ImageIcon, Upload, X, Check, Shirt } from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { translateError } from '../../i18n/errors';
import { useT } from '../../i18n';
import { resizeImageDataUrl } from '../../lib/imageResize';
import { SettingsCard } from './shared';

/** The built-in photos, read once. */
let photosCache = null;
function usePhotos() {
    const [photos, setPhotos] = useState(photosCache || []);
    useEffect(() => {
        if (photosCache) return;
        window.electronAPI.website.photos().then((list) => { photosCache = list || []; setPhotos(photosCache); }).catch(() => {});
    }, []);
    return photos;
}

/** A picture of the computer, made light enough for a phone, saved in the shop's images. */
async function savePicture(file, t, maxSize) {
    if (file.size > 15 * 1024 * 1024) throw new Error(t('products.imageTooBig'));
    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
    const base64Data = await resizeImageDataUrl(dataUrl, { maxSize, type: 'image/jpeg', quality: 0.82 });
    const result = await window.electronAPI.images.save({ base64Data, originalName: file.name });
    if (!result?.success) throw new Error(t('products.imageSaveFailed'));
    return result.fileName;
}

/** The shop's own picture (a file of its images folder), shown from the program. */
function useOwnPicture(name) {
    const [src, setSrc] = useState(null);
    useEffect(() => {
        let alive = true;
        if (!name) { setSrc(null); return undefined; }
        window.electronAPI.images.get(name).then((data) => { if (alive) setSrc(data || null); }).catch(() => { });
        return () => { alive = false; };
    }, [name]);
    return src;
}

function UploadButton({ label, onFile, busy, testId }) {
    return (
        <label className={`btn btn-secondary px-3 py-2 text-sm justify-center cursor-pointer ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
            <Upload className="w-4 h-4" />
            <span className="truncate">{label}</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" data-testid={testId}
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); }} />
        </label>
    );
}

/** The home page's big picture: the shop's own photo, or a ready-made one it picks; two optional texts. */
export function HeroCard({ site, busy, run }) {
    const { t } = useT();
    const photos = usePhotos();
    const saved = { image: '', photo: '', title: '', subtitle: '', ...(site.publicInfo?.hero || {}) };
    const [form, setForm] = useState(saved);
    const [uploading, setUploading] = useState(false);
    useEffect(() => { setForm(saved); }, [JSON.stringify(saved)]);
    const own = useOwnPicture(form.image);
    const chosen = photos.find(p => p.file === form.photo);
    const fallback = photos.find(p => p.file.startsWith('hero-'));
    const src = own || chosen?.src || fallback?.src || null;
    const upload = async (file) => {
        setUploading(true);
        try {
            const name = await savePicture(file, t, 1800);
            setForm(f => ({ ...f, image: name }));
        } catch (error) {
            toast.error(translateError(error));
        } finally {
            setUploading(false);
        }
    };
    const save = () => run('hero', () => window.electronAPI.website.setSettings({ hero: form }), () => toast.success(t('website.info.saved')));
    return (
        <SettingsCard testId="website-hero" icon={ImageIcon} title={t('website.hero.title')} hint={t('website.hero.hint')} onSave={save} saving={busy === 'hero'}>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_1fr] items-start">
                <div className="space-y-2">
                    <div className="aspect-[16/9] rounded-xl overflow-hidden border border-dark-border bg-dark-tertiary">
                        {src && <img src={src} alt="" className="w-full h-full object-cover" data-testid="website-hero-picture" />}
                    </div>
                    <div className="flex gap-2">
                        <UploadButton label={uploading ? t('common.saving') : t(form.image ? 'website.hero.change' : 'website.hero.choose')} onFile={upload} busy={uploading} testId="website-hero-file" />
                        {form.image && <Button size="sm" variant="ghost" onClick={() => setForm(f => ({ ...f, image: '' }))} aria-label={t('common.delete')} title={t('common.delete')}><X className="w-4 h-4" /></Button>}
                    </div>
                    <label className="block space-y-1">
                        <span className="text-xs text-zinc-400">{t('website.hero.heading')}</span>
                        <input className="input w-full" value={form.title} maxLength={80} placeholder={site.suggestedName || ''} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} data-testid="website-hero-heading" />
                    </label>
                    <label className="block space-y-1">
                        <span className="text-xs text-zinc-400">{t('website.hero.subtitle')}</span>
                        <input className="input w-full" value={form.subtitle} maxLength={160} onChange={(e) => setForm(f => ({ ...f, subtitle: e.target.value }))} data-testid="website-hero-subtitle" />
                    </label>
                </div>
                <div className="space-y-2 min-w-0">
                    <p className="text-xs text-zinc-400">{t('website.pictures.readyMade')}</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-2" data-testid="website-hero-photos">
                        {photos.map(p => {
                            const on = !form.image && (form.photo ? form.photo === p.file : p === fallback);
                            return (
                                <button key={p.file} type="button" onClick={() => setForm(f => ({ ...f, image: '', photo: p.file }))} aria-pressed={on} title={p.file}
                                    className={`relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-colors ${on ? 'border-indigo-400' : 'border-transparent hover:border-zinc-600'}`}>
                                    <img src={p.src} alt="" className="w-full h-full object-cover" loading="lazy" />
                                    {on && <span className="absolute top-1 end-1 w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center"><Check className="w-3 h-3" /></span>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </SettingsCard>
    );
}

/** One category: its picture (automatic, the shop's own, or a ready-made photo). */
function CategoryPicture({ category, value, photos, onChange }) {
    const { t } = useT();
    const own = useOwnPicture(value.image);
    const chosen = photos.find(p => p.file === value.photo);
    const [uploading, setUploading] = useState(false);
    const upload = async (file) => {
        setUploading(true);
        try { onChange({ image: await savePicture(file, t, 1000), photo: '' }); } catch (error) { toast.error(translateError(error)); } finally { setUploading(false); }
    };
    const src = own || chosen?.src;
    return (
        <li className="flex items-center gap-3 py-3" data-testid={`website-cat-picture-${category.id}`}>
            <span className="w-16 h-16 flex-none rounded-lg overflow-hidden border border-dark-border bg-dark-tertiary flex items-center justify-center">
                {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : <Shirt className="w-6 h-6 text-zinc-500" />}
            </span>
            <span className="flex-1 min-w-0">
                <span className="block font-medium truncate">{category.name}</span>
                <span className="block text-xs text-zinc-500">{value.image ? t('website.pictures.own') : value.photo ? t('website.pictures.readyMadeOne') : t('website.pictures.auto')}</span>
            </span>
            <select className="input py-1.5 text-sm w-40" value={value.image ? '' : value.photo || ''} onChange={(e) => onChange({ image: '', photo: e.target.value })} aria-label={t('website.pictures.readyMade')}>
                <option value="">{t('website.pictures.auto')}</option>
                {photos.filter(p => !p.file.startsWith('hero-')).map(p => <option key={p.file} value={p.file}>{p.file.replace(/\.webp$/, '')}</option>)}
            </select>
            <UploadButton label={uploading ? t('common.saving') : t('website.pictures.upload')} onFile={upload} busy={uploading} testId={`website-cat-file-${category.id}`} />
        </li>
    );
}

export function CategoryPicturesCard({ site, busy, run }) {
    const { t } = useT();
    const photos = usePhotos();
    const [categories, setCategories] = useState([]);
    const saved = site.publicInfo?.categoryPictures || {};
    const [pictures, setPictures] = useState(saved);
    useEffect(() => { setPictures(saved); }, [JSON.stringify(saved)]);
    useEffect(() => { window.electronAPI.categories.getAll().then(list => setCategories(list || [])).catch(() => {}); }, []);
    const save = () => run('catPictures', () => window.electronAPI.website.setSettings({ categoryPictures: pictures }), () => toast.success(t('website.info.saved')));
    return (
        <SettingsCard testId="website-cat-pictures" icon={Shirt} title={t('website.pictures.catsTitle')} hint={t('website.pictures.catsHint')} onSave={categories.length ? save : null} saving={busy === 'catPictures'}>
            {categories.length ? (
                <ul className="divide-y divide-dark-border">
                    {categories.map(c => (
                        <CategoryPicture key={c.id} category={c} photos={photos} value={pictures[c.id] || { image: '', photo: '' }}
                            onChange={(v) => setPictures(p => ({ ...p, [c.id]: v }))} />
                    ))}
                </ul>
            ) : <p className="text-sm text-zinc-500">{t('website.pictures.noCats')}</p>}
        </SettingsCard>
    );
}
