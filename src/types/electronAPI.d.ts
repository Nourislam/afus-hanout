// The part of window.electronAPI (electron/preload.js) that TypeScript code
// uses, typed. JavaScript screens use the same bridge without these types.
// Add a call here when a .ts/.tsx file first needs it.

export interface ArticleRow {
    id: string; name: string; price: number; stock_quantity: number;
    barcode?: string | null; unit?: string | null; carton_qty?: number | null; carton_price?: number | null;
    plu?: number | null; capped_price?: number | null; image_path?: string | null;
}

export interface LookupResult {
    type: 'product' | 'variant';
    product: ArticleRow;
    carton?: boolean;
    needsVariant?: boolean;
    /** A label of the shop's scale: its weight, and the printed price when it has one */
    scale?: { grams: number; price?: number };
}

export interface KarniBalance {
    id: string; name: string; phone?: string | null; owed: number; oldest: string; last: string; credit_limit: number;
}

export interface ElectronAPI {
    karni: {
        balances(): Promise<KarniBalance[]>;
        lines(customerId: string): Promise<{ date: string; left: number; invoice: string }[]>;
        payPart(input: { customerId: string; amount: number; method?: 'cash' | 'card'; receivedBy?: string | null }): Promise<{ paid: number; left: number }>;
    };
    shell: { openExternal(url: string): Promise<{ success?: boolean } | undefined> };
    settings: {
        get(key: string): Promise<unknown>;
        set(args: { key: string; value: unknown }): Promise<unknown>;
    };
    products: { getAll(): Promise<ArticleRow[]> };
    suppliers: { getAll(): Promise<{ id: string; name: string; is_active?: number }[]> };
    catalog: {
        generateBarcodes(count: number, reserved: string[]): Promise<string[]>;
        saveProduct(args: { product: Record<string, unknown>; variants: unknown[]; employeeId: string | null; isNew: boolean }): Promise<unknown>;
        lookupCode(code: string): Promise<LookupResult | null>;
    };
}

declare global {
    interface Window { electronAPI: ElectronAPI }
}
