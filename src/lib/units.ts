// How a quantity of stock reads on the screens: pieces as they are, an article
// sold by weight (unit 'kg', stock kept in grams) in kg or g.
import { t } from '../i18n';

interface Stocked {
    unit?: string | null;
    stock_quantity?: number | null;
}

/** 250 → "250 g", 1500 → "1.5 kg" (in the interface language). */
export function weightLabel(grams: number): string {
    const g = Math.round(Number(grams) || 0);
    return Math.abs(g) < 1000 ? `${g} ${t('pos.g')}` : `${(g / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 })} ${t('pos.kg')}`;
}

/** The stock of an article as the shop reads it: 24, or "32 kg" for one sold by weight. */
export function stockLabel(product: Stocked): string {
    const n = Number(product.stock_quantity) || 0;
    return product.unit === 'kg' ? weightLabel(n) : String(n);
}

/** "/kg" after the price of an article sold by weight, nothing otherwise. */
export function perUnit(product: Stocked): string {
    return product.unit === 'kg' ? `/${t('pos.kg')}` : '';
}
