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
