// Labels printed by a label scale (balance étiquetteuse): an EAN-13 that
// starts with 2, then the article's number at the scale (PLU), then its
// weight or its price, then the check digit:
//
//   21 | 00042 | 01250 | 9   →  article 42, 1.250 kg (or 1250 DA, or 12.50 DA)
//
// What the value means depends on how the scale is set: the shop says it once
// (Settings › Scale barcode). Shared by the sales screen and the main process.

export interface ScaleFormat {
    /** The two first digits the scale prints (21–28 by default). */
    prefixes: string[];
    /** Digits of the PLU after the prefix: 4, 5 or 6 (the value takes the rest). */
    pluDigits: number;
    /** What the label carries: the weight or the price. */
    value: 'weight' | 'price';
    /** Decimals of the value: 3 for a weight in grams; 0, 1 or 2 for a price. */
    decimals: number;
}

export type ScaleReading = { plu: number; grams: number } | { plu: number; price: number };

// 20 is kept for the program's own article codes, 29 for free labels
export const DEFAULT_SCALE_FORMAT: ScaleFormat = {
    prefixes: ['21', '22', '23', '24', '25', '26', '27', '28'],
    pluDigits: 5,
    value: 'weight',
    decimals: 3,
};

/** GS1 check digit of the 12 first digits of an EAN-13. */
function checkDigit(body: string): number {
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
    return (10 - (sum % 10)) % 10;
}

/** A clean format: known keys only, sensible bounds (a saved setting may be old or hand-edited). */
export function scaleFormat(saved?: Partial<ScaleFormat> | null): ScaleFormat {
    const f = { ...DEFAULT_SCALE_FORMAT, ...(saved || {}) };
    const prefixes = (Array.isArray(f.prefixes) ? f.prefixes : []).map(p => String(p).trim()).filter(p => /^2\d$/.test(p));
    const pluDigits = Math.min(6, Math.max(4, Math.round(Number(f.pluDigits) || 5)));
    const value = f.value === 'price' ? 'price' : 'weight';
    const decimals = value === 'weight' ? 3 : Math.min(2, Math.max(0, Math.round(Number(f.decimals) || 0)));
    return { prefixes: prefixes.length ? prefixes : DEFAULT_SCALE_FORMAT.prefixes, pluDigits, value, decimals };
}

/** Whether a code starts with one of the scale's prefixes. */
export function isScalePrefix(code: string, format: ScaleFormat): boolean {
    return format.prefixes.includes(String(code || '').trim().slice(0, 2));
}

/** Reads a scale label; null when the code is not one. */
export function decodeScaleBarcode(code: string, format: ScaleFormat): ScaleReading | null {
    const c = String(code || '').trim();
    if (!/^\d{13}$/.test(c) || !isScalePrefix(c, format)) return null;
    if (checkDigit(c) !== Number(c[12])) return null;
    const plu = Number(c.slice(2, 2 + format.pluDigits));
    const raw = Number(c.slice(2 + format.pluDigits, 12));
    if (!(plu > 0)) return null;
    if (format.value === 'weight') {
        // decimals 3 = the number is in grams
        const grams = Math.round(raw * 10 ** (3 - format.decimals));
        return grams > 0 ? { plu, grams } : null;
    }
    const price = Math.round(raw) / 10 ** format.decimals;
    return price > 0 ? { plu, price } : null;
}
