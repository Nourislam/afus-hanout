// The article form of a grocery shop: name, barcode and price on the first
// screen; everything else under «المزيد» (stock, purchase price, carton,
// weight, scale number, official price, supplier, picture).
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Wand2 } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { Modal, ModalBody, ModalFooter } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { toast } from '../ui/Toast';
import { ProductImages, MAX_IMAGES } from './ProductImages';
import { useAuthStore } from '../../stores/authStore';
import { t } from '../../i18n';
import { translateErrorLines } from '../../i18n/errors';
import { printArticleLabels, labelResultMessages } from '../../lib/labels';
import { isWeighed } from '../../../electron/shared/grocery.ts';

export interface Article {
    id: string;
    name: string;
    barcode?: string | null;
    price: number;
    cost?: number | null;
    stock_quantity?: number | null;
    min_stock_level?: number | null;
    wholesale_price?: number | null;
    category_id?: string | null;
    supplier_id?: string | null;
    unit?: string | null;
    carton_qty?: number | null;
    carton_price?: number | null;
    carton_barcode?: string | null;
    plu?: number | null;
    capped_price?: number | null;
    image_path?: string | null;
    gallery?: string | string[] | null;
}

interface Option { value: string; label: string }
interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    product?: Article | null;
    categories?: { id: string; name: string }[];
    initialValues?: Partial<Article>;
}

/** What the form edits: text fields, as typed. */
interface Form {
    name: string; barcode: string; price: string;
    cost: string; stock: string; minStock: string; wholesale: string;
    categoryId: string; supplierId: string; byWeight: boolean;
    cartonQty: string; cartonPrice: string; cartonBarcode: string;
    plu: string; capped: string; images: string[];
}

const text = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const num = (v: string): number => Number(String(v).replace(',', '.')) || 0;

function galleryOf(product?: Article | null): string[] {
    const g = product?.gallery;
    if (Array.isArray(g)) return g;
    if (typeof g === 'string' && g) { try { const list = JSON.parse(g); return Array.isArray(list) ? list : []; } catch { return []; } }
    return [];
}

function formOf(product?: Article | null, initial?: Partial<Article>): Form {
    const p = { ...initial, ...product } as Partial<Article>;
    const weighed = isWeighed({ unit: p.unit });
    const stock = Number(p.stock_quantity) || 0;
    return {
        name: text(p.name), barcode: text(p.barcode), price: p.price ? text(p.price) : '',
        cost: p.cost ? text(p.cost) : '',
        // A weighed article keeps its stock in grams; the form shows kg
        stock: product ? text(weighed ? stock / 1000 : stock) : '',
        minStock: p.min_stock_level ? text(weighed ? Number(p.min_stock_level) / 1000 : p.min_stock_level) : '',
        wholesale: p.wholesale_price ? text(p.wholesale_price) : '',
        categoryId: text(p.category_id), supplierId: text(p.supplier_id), byWeight: weighed,
        cartonQty: p.carton_qty ? text(p.carton_qty) : '', cartonPrice: p.carton_price ? text(p.carton_price) : '',
        cartonBarcode: text(p.carton_barcode), plu: p.plu ? text(p.plu) : '', capped: p.capped_price ? text(p.capped_price) : '',
        images: [p.image_path, ...galleryOf(product)].filter((x): x is string => !!x).slice(0, MAX_IMAGES),
    };
}

/** True when a field under «المزيد» already holds something: it opens by itself. */
const moreUsed = (f: Form): boolean => !!(f.cost || f.stock || f.wholesale || f.categoryId || f.supplierId || f.byWeight
    || f.cartonQty || f.plu || f.capped || f.images.length);

export default function ArticleFormModal({ isOpen, onClose, onSave, product = null, categories = [], initialValues }: Props) {
    const [form, setForm] = useState<Form>(() => formOf(product, initialValues));
    const [showMore, setShowMore] = useState(false);
    const [suppliers, setSuppliers] = useState<Option[]>([]);
    const [printAfter, setPrintAfter] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);
    const nameRef = useRef<HTMLInputElement>(null);
    const employee = useAuthStore((s: { currentEmployee?: { id: string } | null }) => s.currentEmployee);

    useEffect(() => {
        if (!isOpen) return;
        const next = formOf(product, initialValues);
        setForm(next);
        setShowMore(moreUsed(next));
        setErrors([]);
        window.electronAPI.suppliers.getAll()
            .then((list: { id: string; name: string; is_active?: number }[]) => setSuppliers(list.filter(s => s.is_active !== 0).map(s => ({ value: s.id, label: s.name }))))
            .catch(() => setSuppliers([]));
        setTimeout(() => nameRef.current?.focus(), 50);
    }, [isOpen, product, initialValues]);

    const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(prev => ({ ...prev, [key]: value }));

    const makeBarcode = async () => {
        try {
            const [code] = await window.electronAPI.catalog.generateBarcodes(1, []);
            set('barcode', code);
        } catch (error) {
            toast.error(translateErrorLines(error).join(' '));
        }
    };

    const save = async () => {
        if (!form.name.trim()) { setErrors([t('article.nameRequired')]); nameRef.current?.focus(); return; }
        if (!(num(form.price) > 0)) { setErrors([t('article.priceRequired')]); return; }
        setSaving(true);
        setErrors([]);
        const id = product?.id || uuid();
        const toUnits = (v: string) => (form.byWeight ? Math.round(num(v) * 1000) : Math.round(num(v)));
        const article = {
            id,
            name: form.name.trim(),
            barcode: form.barcode.trim() || null,
            price: num(form.price),
            cost: num(form.cost),
            stock_quantity: toUnits(form.stock),
            min_stock_level: toUnits(form.minStock),
            wholesale_price: num(form.wholesale) || null,
            category_id: form.categoryId || null,
            supplier_id: form.supplierId || null,
            unit: form.byWeight ? 'kg' : 'piece',
            carton_qty: form.byWeight ? '' : form.cartonQty,
            carton_price: num(form.cartonPrice) || null,
            carton_barcode: form.byWeight ? '' : form.cartonBarcode.trim(),
            plu: form.byWeight ? form.plu : '',
            capped_price: num(form.capped) || null,
            image_path: form.images[0] || null,
            gallery: form.images.slice(1),
            has_colors: false,
            has_sizes: false,
        };
        try {
            await window.electronAPI.catalog.saveProduct({ product: article, variants: [], employeeId: employee?.id || null, isNew: !product });
            toast.success(t('article.saved'));
            if (printAfter) {
                try {
                    const result = await printArticleLabels(id, 1);
                    labelResultMessages(result).forEach((msg: string) => toast.success(msg));
                } catch (printError) {
                    toast.error(t('barcode.printFailed', { error: translateErrorLines(printError).join(' ') }), undefined, 'labelPrinter');
                }
            }
            onSave();
        } catch (error) {
            setErrors(translateErrorLines(error));
        } finally {
            setSaving(false);
        }
    };

    const categoryOptions: Option[] = [{ value: '', label: t('article.none') }, ...categories.map(c => ({ value: c.id, label: c.name }))];
    const supplierOptions: Option[] = [{ value: '', label: t('article.none') }, ...suppliers];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={product ? t('article.editTitle') : t('article.newTitle')} size="md">
            <ModalBody className="space-y-4">
                <Input ref={nameRef} label={t('article.name')} value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('name', e.target.value)}
                    placeholder={t('article.namePlaceholder')} data-testid="article-name" />
                <div className="flex items-end gap-2">
                    <Input containerClassName="flex-1" className="ltr" label={t('article.barcode')} value={form.barcode} placeholder={t('article.barcodeHint')}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('barcode', e.target.value)} data-testid="article-barcode" />
                    <Button variant="secondary" onClick={makeBarcode} title={t('article.makeBarcode')} aria-label={t('article.makeBarcode')}>
                        <Wand2 className="w-4 h-4" />
                    </Button>
                </div>
                <Input className="ltr tabular text-lg" inputMode="decimal" label={form.byWeight ? t('article.pricePerKg') : t('article.price')} value={form.price}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('price', e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') save(); }} data-testid="article-price" />

                <div className="rounded-xl border border-dark-border">
                    <button type="button" onClick={() => setShowMore(v => !v)} aria-expanded={showMore} data-testid="article-more"
                        className="w-full flex items-center gap-2 px-4 py-3 text-start text-sm font-medium text-zinc-300 hover:text-white">
                        <ChevronDown className={`w-4 h-4 flex-none transition-transform ${showMore ? 'rotate-180' : ''}`} />
                        <span className="flex-1">{t('article.more')}</span>
                        <span className="text-xs text-zinc-500 hidden md:inline">{t('article.moreHint')}</span>
                    </button>
                    {showMore && (
                        <div className="px-4 pb-4 space-y-4">
                            <div>
                                <p className="form-label">{t('article.soldBy')}</p>
                                <div className="segmented" role="radiogroup">
                                    <button type="button" className={form.byWeight ? '' : 'active'} aria-pressed={!form.byWeight} onClick={() => set('byWeight', false)} data-testid="article-by-piece">{t('article.byPiece')}</button>
                                    <button type="button" className={form.byWeight ? 'active' : ''} aria-pressed={form.byWeight} onClick={() => set('byWeight', true)} data-testid="article-by-weight">{t('article.byWeight')}</button>
                                </div>
                            </div>
                            <div className="grid gap-x-4 gap-y-3 fit-grid-sm">
                                <Input className="ltr tabular" inputMode="decimal" label={form.byWeight ? t('article.stockKg') : t('article.stock')} value={form.stock}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('stock', e.target.value)} data-testid="article-stock" />
                                <Input className="ltr tabular" inputMode="decimal" label={t('article.minStock')} value={form.minStock}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('minStock', e.target.value)} />
                                <Input className="ltr tabular" inputMode="decimal" label={t('article.cost')} value={form.cost}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('cost', e.target.value)} data-testid="article-cost" />
                                <Input className="ltr tabular" inputMode="decimal" label={t('article.wholesale')} value={form.wholesale}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('wholesale', e.target.value)} />
                                <Select label={t('article.category')} value={form.categoryId} options={categoryOptions} onChange={(v: string) => set('categoryId', v)} />
                                <Select label={t('article.supplier')} value={form.supplierId} options={supplierOptions} onChange={(v: string) => set('supplierId', v)} />
                            </div>
                            {form.byWeight ? (
                                <Input className="ltr tabular" inputMode="numeric" label={t('article.plu')} value={form.plu}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('plu', e.target.value.replace(/\D/g, ''))} data-testid="article-plu" />
                            ) : (
                                <div className="grid gap-x-4 gap-y-3 fit-grid-sm">
                                    <Input className="ltr tabular" inputMode="numeric" label={t('article.cartonQty')} value={form.cartonQty}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('cartonQty', e.target.value.replace(/\D/g, ''))} data-testid="article-carton-qty" />
                                    <Input className="ltr tabular" inputMode="decimal" label={t('article.cartonPrice')} value={form.cartonPrice}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('cartonPrice', e.target.value)} data-testid="article-carton-price" />
                                    <Input className="ltr" label={t('article.cartonBarcode')} value={form.cartonBarcode}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('cartonBarcode', e.target.value)} data-testid="article-carton-barcode" />
                                </div>
                            )}
                            <div>
                                <Input className="ltr tabular" inputMode="decimal" label={t('article.capped')} value={form.capped}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('capped', e.target.value)} data-testid="article-capped" />
                                <p className="form-hint">{t('article.cappedHint')}</p>
                            </div>
                            <div>
                                <p className="form-label">{t('article.picture')}</p>
                                <ProductImages images={form.images} onChange={(list: string[]) => set('images', list)} />
                            </div>
                        </div>
                    )}
                </div>

                <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input type="checkbox" checked={printAfter} onChange={(e) => setPrintAfter(e.target.checked)} className="w-4 h-4 rounded" />
                    {t('article.printLabel')}
                </label>
                {errors.length > 0 && (
                    <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300 space-y-1" role="alert" data-testid="article-errors">
                        {errors.map(e => <p key={e}>{e}</p>)}
                    </div>
                )}
            </ModalBody>
            <ModalFooter>
                <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
                <Button onClick={save} loading={saving} data-testid="article-save">{t('common.save')}</Button>
            </ModalFooter>
        </Modal>
    );
}
