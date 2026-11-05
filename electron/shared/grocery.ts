// Grocery rules shared by the window and the main process (the main process
// loads this .ts file directly: Node strips the types, so only erasable
// TypeScript here — no enum, no namespace).

/** Dinars with two decimals (some capped prices are half dinars: 7.50 DA). */
export const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100 + 0;

export interface UnitOf { unit?: string | null }

/** An article sold by weight: its stock is in grams and its price is per kg. */
export function isWeighed(product: UnitOf): boolean {
    return product.unit === 'kg';
}

/** Price of a weighed line: price per kg × weight. */
export function weighedPrice(pricePerKg: number, grams: number): number {
    return round2((Number(pricePerKg) || 0) * (Number(grams) || 0) / 1000);
}

export interface LineUnits { quantity: number; weight_grams?: number | null }

/** What a sale line moves in stock: the grams of a weighed line, else its quantity. */
export function stockUnits(line: LineUnits): number {
    const grams = Number(line.weight_grams) || 0;
    return grams > 0 ? grams : Number(line.quantity) || 0;
}

export interface CartonOf { price: number; carton_qty?: number | null; carton_price?: number | null }
export interface CartonDeal { quantity: number; discount: number }

/**
 * Cartons sold: their pieces, and the carton's own price as a discount on the
 * line when it is cheaper than its pieces. null when the article has no carton.
 */
export function cartonDeal(product: CartonOf, cartons = 1): CartonDeal | null {
    const perCarton = Math.trunc(Number(product.carton_qty) || 0);
    if (perCarton < 2) return null;
    const quantity = perCarton * cartons;
    const pieces = perCarton * (Number(product.price) || 0);
    const own = Number(product.carton_price);
    const saving = own > 0 && own < pieces ? round2(pieces - own) : 0;
    return { quantity, discount: round2(saving * cartons) };
}

export interface CapOf { capped_price?: number | null }

/**
 * A price above the official (capped) price. A weighed line is compared with
 * the capped price of its weight, rounded like the line itself (comparing per
 * kg would grow the centime of rounding at small weights). Half a centime of
 * tolerance.
 */
export function aboveCap(product: CapOf, unitPrice: number, grams?: number | null): boolean {
    const cap = product.capped_price;
    if (cap === null || cap === undefined || !(Number(cap) > 0)) return false;
    const g = Number(grams) || 0;
    const allowed = g > 0 ? weighedPrice(Number(cap), g) : Number(cap);
    return (Number(unitPrice) || 0) > allowed + 0.005;
}

interface CountedLine {
    quantity?: number | string | null;
    weight_grams?: number | string | null;
}

/** Pieces and grams of some lines (a ticket, a cart): a weighed line is grams, not a piece. */
export function lineCounts(lines: CountedLine[]): { pieces: number; grams: number } {
    let pieces = 0;
    let grams = 0;
    for (const line of lines || []) {
        const g = Number(line.weight_grams) || 0;
        if (g > 0) grams += g;
        else pieces += Number(line.quantity) || 0;
    }
    return { pieces, grams };
}

/** Price per kg of a weighed line from its price and its weight. */
export function pricePerKg(linePrice: number, grams: number): number {
    const g = Number(grams) || 0;
    return g > 0 ? round2((Number(linePrice) || 0) * 1000 / g) : 0;
}

/** Kilograms in the language's way: 0.5 / 0,5; `fixed` keeps the grams (0.500). */
export function kgNumber(grams: number, lang: string, fixed = false): string {
    const kg = (Number(grams) || 0) / 1000;
    return new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US', {
        minimumFractionDigits: fixed ? 3 : 0, maximumFractionDigits: 3, useGrouping: false,
    }).format(kg);
}

/** Baridi Pay (Algérie Poste, since June 2025): no payment under 100 DA. */
export const BARIDI_PAY_MIN = 100;

const THOUSAND: Record<string, string> = { ar: 'ألف', fr: 'mille', en: 'thousand' };

/**
 * An amount as people say it in centimes: 250 DA = «25 ألف» (25 thousand
 * centimes, 1 DA = 100 centimes). Empty under 10 DA.
 */
export function centimesLabel(amount: number, lang: string): string {
    const da = Number(amount) || 0;
    if (da < 10) return '';
    const thousands = Math.round(da * 10) / 100;
    return `${thousands.toLocaleString('en-US', { maximumFractionDigits: 2, useGrouping: false })} ${THOUSAND[lang] || THOUSAND.en}`;
}

/** The «ألف» key on a number pad: what was typed was thousands of centimes (25 → 250 DA). */
export function thousandKey(typed: string): string {
    const n = Number(String(typed || '').trim());
    if (!String(typed || '').trim() || !Number.isFinite(n)) return '';
    return String(Math.round(n * 10 * 100) / 100);
}
