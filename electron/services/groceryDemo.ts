// The demo shop of Afus Hanout: a neighbourhood grocery (حانوت) with two months
// of history — tickets by the piece, by the carton and by weight, official
// prices, kridi, distributors with their visit days, drawers opened and closed.
// Built in its own database (demo/), never the shop's. Deterministic: the same
// day gives the same shop.
import fs from 'node:fs';
import path from 'node:path';
import catalog from './catalogService.js';
import returnService from './returnService.js';
import charges from './chargesService.js';
import commissions from './commissionService.js';
import loyalty from './loyaltyService.js';
import pinService from './pinService.js';
import receiptNumber from './receiptNumber.js';
import database from '../database/init.js';
import { weighedPrice, round2 } from '../shared/grocery.ts';

export const DAYS = 60;

type Lang = 'ar' | 'fr' | 'en';
type Names = Record<Lang, string>;
interface Row { [column: string]: unknown }
export interface Api {
    all(sql: string, params?: unknown[]): Row[];
    get(sql: string, params?: unknown[]): Row | null;
    run(sql: string, params?: unknown[]): unknown;
    uuid(): string;
}

/** The demo employees: PINs shown on the demo login screen, never real ones. */
export const DEMO_STAFF = [
    { id: 'demo-admin', role: 'admin', pin: '1111', name: { ar: 'إسلام نوري', fr: 'Islam Nouri', en: 'Islam Nouri' } },
    { id: 'demo-cashier', role: 'cashier', pin: '2222', name: { ar: 'سوفي يسعد', fr: 'Soufi Yessad', en: 'Soufi Yessad' } },
    // Works on the busy days (Thursday, Saturday)
    { id: 'demo-seller', role: 'cashier', pin: '3333', name: { ar: 'أمين بلقاسم', fr: 'Amine Belkacem', en: 'Amine Belkacem' } },
];

const SHOP = {
    name: { ar: 'حانوت النور', fr: 'Hanout En-Nour', en: 'Hanout En-Nour' },
    city: { ar: 'باب الزوار', fr: 'Bab Ezzouar', en: 'Bab Ezzouar' },
};

// [code, colour, ar, fr, en]
const CATEGORIES: [string, string, string, string, string][] = [
    ['dairy', '#38bdf8', 'الحليب ومشتقاته', 'Produits laitiers', 'Dairy'],
    ['bread', '#f59e0b', 'الخبز', 'Pain', 'Bread'],
    ['staples', '#a3e635', 'الزيت والسكر والسميد', 'Huile, sucre, semoule', 'Oil, sugar, semolina'],
    ['drinks', '#f43f5e', 'المشروبات', 'Boissons', 'Drinks'],
    ['coffee', '#a16207', 'القهوة والشاي', 'Café et thé', 'Coffee and tea'],
    ['cans', '#fb923c', 'المعلبات والعجائن', 'Conserves et pâtes', 'Cans and pasta'],
    ['sweets', '#e879f9', 'الحلويات والبسكويت', 'Biscuits et confiserie', 'Biscuits and sweets'],
    ['cleaning', '#22d3ee', 'مواد التنظيف', 'Entretien', 'Cleaning'],
    ['produce', '#22c55e', 'الخضر والفواكه', 'Fruits et légumes', 'Fruit and vegetables'],
];

interface ArticleSpec {
    key: string; cat: string; price: number; cost: number; unit?: 'kg';
    carton?: [number, number]; capped?: number; plu?: number; pop: number; names: Names;
}

// What a neighbourhood grocery sells; popularity decides how often a ticket takes it
const ARTICLES: ArticleSpec[] = [
    { key: 'MILK', cat: 'dairy', price: 25, cost: 23, capped: 25, carton: [20, 480], pop: 30, names: { ar: 'حليب كيس 1 لتر', fr: 'Lait sachet 1 L', en: 'Milk bag 1 L' } },
    { key: 'LBEN', cat: 'dairy', price: 60, cost: 50, pop: 8, names: { ar: 'لبن 1 لتر', fr: 'Lben 1 L', en: 'Lben 1 L' } },
    { key: 'YOGH', cat: 'dairy', price: 25, cost: 20, carton: [24, 560], pop: 12, names: { ar: 'ياغورت', fr: 'Yaourt', en: 'Yogurt' } },
    { key: 'CHEESE', cat: 'dairy', price: 230, cost: 195, pop: 6, names: { ar: 'جبن مثلثات 16 قطعة', fr: 'Fromage portions x16', en: 'Cheese portions x16' } },
    { key: 'BREAD', cat: 'bread', price: 10, cost: 8.5, capped: 10, pop: 35, names: { ar: 'خبز عادي', fr: 'Baguette', en: 'Baguette' } },
    { key: 'OIL5', cat: 'staples', price: 650, cost: 600, capped: 650, carton: [4, 2560], pop: 6, names: { ar: 'زيت 5 لتر', fr: 'Huile 5 L', en: 'Oil 5 L' } },
    { key: 'OIL1', cat: 'staples', price: 135, cost: 122, capped: 135, carton: [12, 1580], pop: 9, names: { ar: 'زيت 1 لتر', fr: 'Huile 1 L', en: 'Oil 1 L' } },
    { key: 'SUGAR', cat: 'staples', price: 95, cost: 88, capped: 95, pop: 10, names: { ar: 'سكر 1 كغ', fr: 'Sucre 1 kg', en: 'Sugar 1 kg' } },
    { key: 'SEMOL', cat: 'staples', price: 450, cost: 420, capped: 450, pop: 4, names: { ar: 'سميد 10 كغ', fr: 'Semoule 10 kg', en: 'Semolina 10 kg' } },
    { key: 'FLOUR', cat: 'staples', price: 90, cost: 80, pop: 4, names: { ar: 'فرينة 1 كغ', fr: 'Farine 1 kg', en: 'Flour 1 kg' } },
    { key: 'WATER', cat: 'drinks', price: 40, cost: 30, carton: [6, 210], pop: 14, names: { ar: 'ماء معدني 1.5 لتر', fr: 'Eau minérale 1,5 L', en: 'Mineral water 1.5 L' } },
    { key: 'SODA', cat: 'drinks', price: 120, cost: 95, carton: [6, 680], pop: 10, names: { ar: 'مشروب غازي 2 لتر', fr: 'Soda 2 L', en: 'Soda 2 L' } },
    { key: 'JUICE', cat: 'drinks', price: 80, cost: 62, pop: 7, names: { ar: 'عصير 1 لتر', fr: 'Jus 1 L', en: 'Juice 1 L' } },
    { key: 'COFFEE', cat: 'coffee', price: 280, cost: 240, pop: 9, names: { ar: 'قهوة مطحونة 250 غ', fr: 'Café moulu 250 g', en: 'Ground coffee 250 g' } },
    { key: 'TEA', cat: 'coffee', price: 150, cost: 120, pop: 5, names: { ar: 'شاي أخضر', fr: 'Thé vert', en: 'Green tea' } },
    { key: 'TOMPASTE', cat: 'cans', price: 120, cost: 100, pop: 8, names: { ar: 'طماطم مصبرة', fr: 'Concentré de tomate', en: 'Tomato paste' } },
    { key: 'PASTA', cat: 'cans', price: 70, cost: 58, carton: [20, 1300], pop: 9, names: { ar: 'عجائن 500 غ', fr: 'Pâtes 500 g', en: 'Pasta 500 g' } },
    { key: 'TUNA', cat: 'cans', price: 220, cost: 185, pop: 5, names: { ar: 'تونة', fr: 'Thon', en: 'Tuna' } },
    { key: 'BISCUIT', cat: 'sweets', price: 50, cost: 38, carton: [24, 1080], pop: 12, names: { ar: 'بسكويت', fr: 'Biscuits', en: 'Biscuits' } },
    { key: 'CHOCO', cat: 'sweets', price: 100, cost: 80, pop: 6, names: { ar: 'شوكولاطة', fr: 'Chocolat', en: 'Chocolate' } },
    { key: 'SOAP', cat: 'cleaning', price: 180, cost: 150, pop: 4, names: { ar: 'سائل الأواني', fr: 'Liquide vaisselle', en: 'Dish soap' } },
    { key: 'BLEACH', cat: 'cleaning', price: 120, cost: 95, pop: 4, names: { ar: 'جافيل', fr: 'Javel', en: 'Bleach' } },
    { key: 'TOMATO', cat: 'produce', price: 120, cost: 85, unit: 'kg', plu: 1, pop: 12, names: { ar: 'طماطم', fr: 'Tomates', en: 'Tomatoes' } },
    { key: 'POTATO', cat: 'produce', price: 80, cost: 60, unit: 'kg', plu: 2, pop: 14, names: { ar: 'بطاطا', fr: 'Pommes de terre', en: 'Potatoes' } },
    { key: 'ONION', cat: 'produce', price: 70, cost: 50, unit: 'kg', plu: 3, pop: 10, names: { ar: 'بصل', fr: 'Oignons', en: 'Onions' } },
    { key: 'BANANA', cat: 'produce', price: 280, cost: 230, unit: 'kg', plu: 4, pop: 5, names: { ar: 'موز', fr: 'Bananes', en: 'Bananas' } },
];

const CUSTOMERS: [string, string, string, boolean, number][] = [
    ['Karima Benali', 'كريمة بن علي', '0661 23 45 67', true, 15000],
    ['Sofiane Haddad', 'سفيان حداد', '0770 11 22 33', true, 10000],
    ['Nadia Meziane', 'نادية مزيان', '0555 98 76 54', true, 20000],
    ['Ammi Moussa', 'عمي موسى', '0699 45 12 78', true, 8000],
    ['Samira Khelifi', 'سميرة خليفي', '0550 33 44 55', true, 12000],
    ['Walid Cherif', 'وليد شريف', '0771 65 43 21', false, 0],
    ['Imane Djebbar', 'إيمان جبار', '0662 87 65 43', false, 0],
    ['Rachid Ould Ali', 'رشيد ولد علي', '0698 21 43 65', false, 0],
    ['Lamia Saadi', 'لمياء سعدي', '0556 78 90 12', false, 0],
    ['Hakim Ferhat', 'حكيم فرحات', '0775 90 12 34', false, 0],
];

// [fr, ar, contact, phone, city, visit days (0 = Sunday), categories]
const SUPPLIERS: [string, string, string, string, string, number[], string[]][] = [
    ['Laiterie El Baraka', 'ملبنة البركة', 'Mourad', '0550 21 55 66', 'Rouiba', [0, 2, 4], ['dairy']],
    ['Boissons Es-Safi', 'مشروبات الصافي', 'Fethi', '0661 41 22 33', 'Réghaïa', [1], ['drinks']],
    ['Grossiste Es-Saada', 'جملة السعادة', 'Bilal', '0770 25 66 77', 'Bab Ezzouar', [3], ['staples', 'coffee', 'cans', 'sweets', 'cleaning']],
    ['Boulangerie En-Nour', 'مخبزة النور', 'Hamid', '0555 18 29 30', 'Bab Ezzouar', [0, 1, 2, 3, 4, 5, 6], ['bread', 'produce']],
];

// What the shop pays (the net profit add-on): [kind, every N months, amount, ar, fr, en, staff index]
const CHARGES: [string, number, number, string, string, string, number | null][] = [
    ['rent', 1, 40000, 'إيجار المحل', 'Loyer du magasin', 'Shop rent', null],
    ['salary', 1, 30000, 'أجرة سوفي', 'Salaire Soufi', 'Soufi salary', 1],
    ['salary', 1, 15000, 'أجرة أمين', 'Salaire Amine', 'Amine salary', 2],
    ['electricity', 3, 18000, 'سونلغاز (الثلاجات)', 'Sonelgaz (frigos)', 'Sonelgaz (fridges)', null],
];

const EXPENSES: Record<Lang, string[]> = {
    ar: ['أكياس', 'تنظيف المحل', 'نقل السلع', 'قهوة', 'مصباح'],
    fr: ['Sachets', 'Nettoyage', 'Transport marchandise', 'Café', 'Ampoule'],
    en: ['Shopping bags', 'Cleaning', 'Goods transport', 'Coffee', 'Light bulb'],
};

// Common weighings (grams)
const WEIGHINGS = [250, 500, 500, 750, 1000, 1000, 1500, 2000];

/** Small seeded random generator (mulberry32). */
export function seeded(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const pad = (n: number): string => String(n).padStart(2, '0');
/** The same text as SQLite's CURRENT_TIMESTAMP (UTC), so dates compare like real ones. */
export const sqlTime = (d: Date): string => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
const pick = <T>(random: () => number, list: T[]): T => list[Math.floor(random() * list.length)];
function weighted<T>(random: () => number, items: T[], weightOf: (it: T) => number): T {
    const total = items.reduce((s, it) => s + weightOf(it), 0);
    let r = random() * total;
    for (const it of items) { r -= weightOf(it); if (r <= 0) return it; }
    return items[items.length - 1];
}

/** EAN-13 with the Algerian prefix 613 (never 2…, which a label scale uses). */
function demoBarcodes(count: number, random: () => number): string[] {
    const taken = new Set<string>();
    const codes: string[] = [];
    while (codes.length < count) {
        let body = '613';
        for (let i = 0; i < 9; i++) body += Math.floor(random() * 10);
        const code = body + catalog.ean13CheckDigit(body);
        if (!taken.has(code)) { taken.add(code); codes.push(code); }
    }
    return codes;
}

// The demo PINs are known to everybody: hashed once per run of the program
const pinHashes = new Map<string, string>();
const demoPinHash = (pin: string): string => {
    if (!pinHashes.has(pin)) pinHashes.set(pin, pinService.hashPin(pin));
    return pinHashes.get(pin) as string;
};

/** Last stock movement written so far (the next ones are after it). */
const lastLogRow = (api: Api): number => Number(api.get('SELECT COALESCE(MAX(rowid), 0) AS id FROM inventory_logs')?.id) || 0;

/** A plain drawing of the article: its colour and its first letter. */
function articleSvg(letter: string, colour: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect x="6" y="6" width="108" height="108" rx="22" fill="${colour}" opacity="0.9"/><text x="60" y="76" font-size="48" text-anchor="middle" fill="#fff" font-family="sans-serif">${letter}</text></svg>`;
}
const logoSvg = (letter: string): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="28" fill="#6366f1"/><text x="60" y="80" font-size="60" text-anchor="middle" fill="#fff" font-family="sans-serif">${letter}</text></svg>`;

/** The same database adapter, with each SQL text prepared once (thousands of statements). */
function withPreparedStatements(api: Api): Api & { free(): void } {
    const db = database.getDatabase();
    const cache = new Map<string, { bind(p: unknown): void; step(): boolean; getAsObject(): Row; reset(): void; run(p: unknown): void; free(): void }>();
    const prepared = (sql: string) => {
        let stmt = cache.get(sql);
        if (!stmt) { stmt = db.prepare(sql); cache.set(sql, stmt!); }
        return stmt!;
    };
    const all = (sql: string, params: unknown[] = []): Row[] => {
        const stmt = prepared(sql);
        try {
            stmt.bind(database.bindable(params));
            const rows: Row[] = [];
            while (stmt.step()) rows.push(stmt.getAsObject());
            return rows;
        } finally {
            stmt.reset();
        }
    };
    return {
        ...api,
        all,
        get: (sql, params = []) => all(sql, params)[0] || null,
        run: (sql, params = []) => { prepared(sql).run(database.bindable(params)); return true; },
        free: () => { for (const stmt of cache.values()) { try { stmt.free(); } catch { /* already freed */ } } cache.clear(); },
    };
}

interface Article extends ArticleSpec { id: string; name: string; supplier: string; sold: number; left: number }
interface Line { article: Article; quantity: number; grams: number; carton: boolean }
interface Ticket { time: Date; lines: Line[] }
interface Customer { id: string; credit: boolean; limit: number; owed: number }
interface Options { lang?: Lang; imagesDir?: string; now?: Date; seed?: number }

export function seedDemoShop(baseApi: Api, options: Options = {}) {
    const api = withPreparedStatements(baseApi);
    try {
        return buildShop(api, options);
    } finally {
        api.free();
    }
}

function buildShop(api: Api, { lang = 'ar', imagesDir, now = new Date(), seed = 20261104 }: Options = {}) {
    const random = seeded(seed);
    const tr = (obj: Names): string => obj[lang] || obj.fr;
    const setSetting = (key: string, value: unknown) => api.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, JSON.stringify(value)]);
    const at = (daysAgo: number, hour: number, minute = 0): Date => new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hour, minute, Math.floor(random() * 60));
    if (imagesDir) fs.mkdirSync(imagesDir, { recursive: true });
    const writeImage = (name: string, svg: string): string => { if (imagesDir) fs.writeFileSync(path.join(imagesDir, name), svg); return name; };

    // ---- The shop and its choices
    setSetting('store_config', {
        businessName: tr(SHOP.name), shopLogo: writeImage('demo-logo.svg', logoSvg(lang === 'ar' ? 'ن' : 'N')),
        ownerName: tr(DEMO_STAFF[0].name), businessPhone: '0555 12 34 56', businessEmail: '',
        businessAddress: lang === 'ar' ? 'شارع الاستقلال، رقم 12' : lang === 'fr' ? "12, rue de l'Indépendance" : '12 Independence Street',
        businessWilaya: '16 - Alger', businessCity: tr(SHOP.city), defaultLanguage: lang,
        currency: 'DZD', currencySymbol: 'DA', taxRate: 0, taxName: 'TVA', taxType: 'inclusive', receiptShowBrand: true,
    });
    setSetting('ui_mode', 'full');
    setSetting('features', { credit: true, customers: true, promotions: true, bundles: true, giftCards: false, suppliers: true, purchaseOrders: true, charges: true, commissions: true });
    setSetting('loyalty', { pointValue: 1 });
    setSetting('setup_completed', 'true');
    setSetting('demo_shop', true);

    for (const staff of DEMO_STAFF) {
        api.run('INSERT INTO employees (id, name, pin, role, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)',
            [staff.id, tr(staff.name), demoPinHash(staff.pin), staff.role, sqlTime(at(DAYS + 10, 9))]);
    }
    const admin = DEMO_STAFF[0].id;
    const cashier = DEMO_STAFF[1].id;
    const weekendSeller = DEMO_STAFF[2].id;
    // Today the owner is at the counter (the drawer left open is the owner's: whoever tries
    // the demo as the owner sells at once); the other days, the cashier or the weekend seller
    const sellerOf = (daysAgo: number) => (daysAgo === 0 ? admin
        : [4, 6].includes(new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo).getDay()) ? weekendSeller : cashier);

    commissions.saveRule(api, { employee_id: cashier, kind: 'percent', rate: 1, monthly_goal: 900000 });
    commissions.saveRule(api, { employee_id: weekendSeller, kind: 'percent', rate: 1, monthly_goal: 400000 });
    const opened = new Date(now.getFullYear(), now.getMonth(), now.getDate() - DAYS);
    const firstMonth = new Date(opened.getFullYear(), opened.getMonth() + 1, 1);
    const chargeStart = `${firstMonth.getFullYear()}-${pad(firstMonth.getMonth() + 1)}-01`;
    for (const [kind, every, amount, ar, fr, en, staffIndex] of CHARGES) {
        charges.save(api, { name: { ar, fr, en }[lang] || fr, kind, amount, every_months: every, start_date: chargeStart, employee_id: staffIndex === null ? null : DEMO_STAFF[staffIndex].id });
    }

    const categoryIds: Record<string, string> = {};
    const categoryColour: Record<string, string> = {};
    for (const [code, colour, ar, fr, en] of CATEGORIES) {
        categoryIds[code] = `demo-cat-${code}`;
        categoryColour[code] = colour;
        api.run('INSERT INTO categories (id, name, color) VALUES (?, ?, ?)', [categoryIds[code], { ar, fr, en }[lang], colour]);
    }

    // ---- Distributors and wholesalers, with the days they come by
    const supplierOf: Record<string, string> = {};
    SUPPLIERS.forEach(([fr, ar, contact, phone, city, days, cats], i) => {
        const id = `demo-sup-${i + 1}`;
        api.run('INSERT INTO suppliers (id, name, contact_person, phone, address, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [id, lang === 'ar' ? ar : fr, contact, phone, city, sqlTime(at(DAYS + 20, 10))]);
        api.run('INSERT INTO supplier_visits (supplier_id, weekdays) VALUES (?, ?)', [id, JSON.stringify(days)]);
        for (const c of cats) supplierOf[c] = id;
    });

    const customers: Customer[] = CUSTOMERS.map(([latin, ar, phone, credit, limit], i) => {
        const id = `demo-cus-${i + 1}`;
        api.run('INSERT INTO customers (id, name, phone, credit_enabled, credit_limit, credit_balance, is_active, created_at) VALUES (?, ?, ?, ?, ?, 0, 1, ?)',
            [id, lang === 'ar' ? ar : latin, phone, credit ? 1 : 0, limit, sqlTime(at(DAYS + 5 - i, 11))]);
        return { id, credit, limit, owed: 0 };
    });
    const customerById = new Map(customers.map(c => [c.id, c]));
    const creditCustomers = customers.filter(c => c.credit);

    const articles: Article[] = ARTICLES.map(a => ({ ...a, id: `demo-prd-${a.key.toLowerCase()}`, name: tr(a.names), supplier: supplierOf[a.cat], sold: 0, left: 0 }));

    // ---- Plan two months of tickets first, to know how much stock each article needed
    const days: { daysAgo: number; tickets: Ticket[] }[] = [];
    for (let d = DAYS; d >= 0; d--) {
        const weekday = at(d, 12).getDay(); // 5 = Friday (quiet), 4/6 busy
        const base = weekday === 5 ? 14 : weekday === 4 || weekday === 6 ? 34 : 24;
        let count = Math.max(1, Math.round(base * (0.8 + random() * 0.4)));
        const closeHour = d === 0 ? Math.min(21, Math.max(9, now.getHours())) : 21;
        if (d === 0) count = Math.max(0, Math.round(count * Math.max(0, now.getHours() - 7.5) / 13.5));
        const tickets: Ticket[] = [];
        for (let i = 0; i < count; i++) {
            const lines: Line[] = [];
            const nLines = random() < 0.45 ? 1 : random() < 0.6 ? 2 : random() < 0.7 ? 3 : 4;
            for (let l = 0; l < nLines; l++) {
                const article = weighted(random, articles, a => a.pop);
                if (lines.some(x => x.article === article)) continue;
                if (article.unit === 'kg') {
                    const grams = pick(random, WEIGHINGS);
                    lines.push({ article, quantity: 1, grams, carton: false });
                    article.sold += grams;
                } else if (article.carton && random() < 0.04) {
                    lines.push({ article, quantity: article.carton[0], grams: 0, carton: true });
                    article.sold += article.carton[0];
                } else {
                    const quantity = article.key === 'BREAD' ? 2 + Math.floor(random() * 5) : random() < 0.25 ? 2 : 1;
                    lines.push({ article, quantity, grams: 0, carton: false });
                    article.sold += quantity;
                }
            }
            const minute = Math.floor(7.5 * 60 + random() * ((closeHour - 7.5) * 60 - 10));
            tickets.push({ time: at(d, Math.floor(minute / 60), minute % 60), lines });
        }
        tickets.sort((a, b) => a.time.getTime() - b.time.getTime());
        days.push({ daysAgo: d, tickets });
    }

    // ---- Articles with their stock: what is left today + what was sold
    const barcodes = demoBarcodes(articles.length * 2, random);
    let b = 0;
    for (const a of articles) {
        const r = random();
        const unitLeft = a.unit === 'kg' ? 1000 : 1;
        a.left = r < 0.06 ? 0 : r < 0.18 ? unitLeft * (1 + Math.floor(random() * 3)) : unitLeft * (8 + Math.floor(random() * 30));
        // Always something sold out and something running low, for the screens that show them
        if (a.key === 'CHOCO') a.left = 0;
        if (a.key === 'TEA') a.left = 2;
        // Bread has no barcode (sold from its picture button), the weighed ones a scale number
        const code = a.unit === 'kg' ? null : barcodes[b++];
        const image = writeImage(`demo-${a.key.toLowerCase()}.svg`, articleSvg(a.name.slice(0, 1), categoryColour[a.cat]));
        catalog.saveProduct(api, {
            id: a.id, name: a.name, category_id: categoryIds[a.cat], supplier_id: a.supplier,
            price: a.price, cost: a.cost, min_stock_level: a.unit === 'kg' ? 3000 : 5, image_path: image,
            barcode: a.key === 'BREAD' ? null : code, stock_quantity: a.left + a.sold,
            unit: a.unit || 'piece', plu: a.plu ?? '', capped_price: a.capped ?? null,
            carton_qty: a.carton ? a.carton[0] : '', carton_price: a.carton ? a.carton[1] : null,
            carton_barcode: a.carton ? barcodes[b++] : '', has_colors: false, has_sizes: false,
        }, [], { employeeId: admin, isNew: true });
        api.run('INSERT OR IGNORE INTO product_suppliers (product_id, supplier_id, last_cost, last_date) VALUES (?, ?, ?, ?)', [a.id, a.supplier, a.cost, sqlTime(at(DAYS + 2, 10))]);
        api.run('UPDATE inventory_logs SET created_at = ? WHERE product_id = ?', [sqlTime(at(DAYS + 2, 10)), a.id]);
        api.run('UPDATE products SET created_at = ? WHERE id = ?', [sqlTime(at(DAYS + 3, 10)), a.id]);
    }

    // ---- Ramadan basket (قفة رمضان): sold by the association, its pieces taken from stock
    const byKey = new Map(articles.map(a => [a.key, a]));
    const qoffa: [string, number][] = [['SUGAR', 2], ['OIL1', 2], ['TOMPASTE', 2], ['PASTA', 3], ['COFFEE', 1]];
    const qoffaOriginal = qoffa.reduce((s, [k, n]) => s + (byKey.get(k)!.price * n), 0);
    api.run(`INSERT INTO bundles (id, name, description, bundle_price, original_price, savings, is_active, deduct_component_stock, stock_quantity, created_at)
             VALUES (?, ?, '', ?, ?, ?, 1, 1, 0, ?)`, ['demo-pack-qoffa', lang === 'ar' ? 'قفة رمضان' : lang === 'fr' ? 'Couffin du Ramadan' : 'Ramadan basket', 1300, qoffaOriginal, qoffaOriginal - 1300, sqlTime(at(10, 10))]);
    for (const [k, n] of qoffa) api.run('INSERT INTO bundle_items (id, bundle_id, product_id, quantity) VALUES (?, ?, ?, ?)', [api.uuid(), 'demo-pack-qoffa', byKey.get(k)!.id, n]);

    // ---- The days: open the drawer, sell, sometimes spend, close
    const expenseReasons = EXPENSES[lang] || EXPENSES.fr;
    const creditOpen: { id: string; customer: string; total: number; time: Date; paid: number }[] = [];
    const soldLines: { saleId: string; lineId: string; line: Line; time: Date; credit: boolean; returned?: boolean; refund: number }[] = [];
    let creditCount = 0;
    let returnCount = 0;
    for (const day of days) {
        const opening = 3000;
        let drawer = opening;
        const seller = sellerOf(day.daysAgo);
        const shiftId = `demo-shift-${day.daysAgo}`;
        api.run('INSERT INTO shifts (id, employee_id, start_time, opening_cash, notes) VALUES (?, ?, ?, ?, ?)',
            [shiftId, seller, at(day.daysAgo, 7, 20).toISOString(), opening, '']);

        for (const ticket of day.tickets) {
            if (!ticket.lines.length) continue;
            const saleId = api.uuid();
            const receipt = receiptNumber.nextReceiptNumber(api, ticket.time);
            const priced = ticket.lines.map(line => {
                const a = line.article;
                if (line.grams) {
                    const price = weighedPrice(a.price, line.grams);
                    return { line, unitPrice: price, discount: 0, total: price, unitCost: weighedPrice(a.cost, line.grams) };
                }
                const discount = line.carton && a.carton ? round2(line.quantity * a.price - a.carton[1]) : 0;
                return { line, unitPrice: a.price, discount, total: round2(line.quantity * a.price - discount), unitCost: a.cost };
            });
            const total = round2(priced.reduce((s, p) => s + p.total, 0));
            const roll = random();
            let credit = roll < 0.07 && day.daysAgo > 0;
            const customer = credit ? pick(random, creditCustomers) : (random() < 0.12 ? pick(random, customers) : null);
            if (credit && customer && customer.limit > 0 && customer.owed + total > customer.limit) credit = false;
            const method = credit ? 'credit' : roll < 0.9 ? 'cash' : 'card';
            const created = sqlTime(ticket.time);
            const logsBefore = lastLogRow(api);
            api.run(`INSERT INTO sales (id, receipt_number, employee_id, customer_id, subtotal, tax_amount, discount_amount, total, status, created_at)
                     VALUES (?, ?, ?, ?, ?, 0, 0, ?, 'completed', ?)`, [saleId, receipt, seller, customer ? customer.id : null, total, total, created]);
            for (const p of priced) {
                const lineId = api.uuid();
                const a = p.line.article;
                api.run(`INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, discount, total, unit_cost, weight_grams, sold_as)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [lineId, saleId, a.id, a.name, p.line.quantity, p.unitPrice, p.discount, p.total, p.unitCost,
                        p.line.grams || null, p.line.grams ? 'weight' : p.line.carton ? 'carton' : null]);
                catalog.adjustStock(api, { productId: a.id, delta: -(p.line.grams || p.line.quantity), type: 'sale', reason: `Sale #${receipt}`, employeeId: seller });
                soldLines.push({ saleId, lineId, line: p.line, time: ticket.time, credit, refund: p.total });
            }
            api.run('UPDATE inventory_logs SET created_at = ? WHERE rowid > ?', [created, logsBefore]);
            api.run('INSERT INTO payments (id, sale_id, method, amount, created_at) VALUES (?, ?, ?, ?, ?)', [api.uuid(), saleId, method, total, created]);
            if (method === 'cash') drawer += total;
            if (customer) {
                api.run('UPDATE sales SET loyalty_base = ? WHERE id = ?', [total, saleId]);
                api.run('UPDATE customers SET total_spent = total_spent + ?, loyalty_points = COALESCE(loyalty_points, 0) + ? WHERE id = ?', [total, loyalty.pointsOf(total), customer.id]);
            }
            if (credit && customer) {
                creditCount++;
                const creditId = api.uuid();
                const due = new Date(ticket.time.getTime() + 30 * 86400000);
                const yymmdd = `${String(ticket.time.getFullYear()).slice(-2)}${pad(ticket.time.getMonth() + 1)}${pad(ticket.time.getDate())}`;
                api.run(`INSERT INTO credit_sales (id, sale_id, customer_id, invoice_number, amount_due, amount_paid, status, due_date, created_at)
                         VALUES (?, ?, ?, ?, ?, 0, 'pending', ?, ?)`,
                    [creditId, saleId, customer.id, `INV-${yymmdd}-${String(creditCount).padStart(4, '0')}`, total, due.toISOString(), created]);
                api.run('UPDATE customers SET credit_balance = credit_balance + ? WHERE id = ?', [total, customer.id]);
                customer.owed += total;
                creditOpen.push({ id: creditId, customer: customer.id, total, time: ticket.time, paid: 0 });
            }
        }

        // Kridi paid back at the counter (part or all), a week or more after
        for (const debt of creditOpen) {
            const age = (at(day.daysAgo, 12).getTime() - debt.time.getTime()) / 86400000;
            if (debt.paid >= debt.total || age < 7 || random() > 0.1) continue;
            const left = round2(debt.total - debt.paid);
            const amount = random() < 0.5 ? left : Math.min(left, Math.max(100, Math.round(left / 2 / 100) * 100));
            if (amount <= 0) continue;
            const when = sqlTime(at(day.daysAgo, 18, Math.floor(random() * 50)));
            api.run('INSERT INTO credit_payments (id, credit_sale_id, amount, payment_method, received_by, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                [api.uuid(), debt.id, amount, 'cash', seller, when]);
            debt.paid = round2(debt.paid + amount);
            drawer += amount;
            api.run('UPDATE credit_sales SET amount_paid = ?, status = ? WHERE id = ?', [debt.paid, debt.paid >= debt.total ? 'paid' : 'partial', debt.id]);
            api.run('UPDATE customers SET credit_balance = credit_balance - ? WHERE id = ?', [amount, debt.customer]);
            customerById.get(debt.customer)!.owed -= amount;
        }

        // Now and then something brought back the same week (a spoilt yogurt, the wrong size of oil)
        if (day.daysAgo > 0 && random() < 0.2) {
            const candidates = soldLines.filter(s => !s.credit && !s.returned && s.refund <= drawer
                && (at(day.daysAgo, 12).getTime() - s.time.getTime()) / 86400000 >= 1 && (at(day.daysAgo, 12).getTime() - s.time.getTime()) / 86400000 < 7);
            if (candidates.length) {
                const s = pick(random, candidates);
                s.returned = true;
                returnCount++;
                const returnId = api.uuid();
                // The article kept sold out and the one kept low come back damaged (not on the shelf)
                const sellable = random() < 0.6 && !['CHOCO', 'TEA'].includes(s.line.article.key);
                const logsBefore = lastLogRow(api);
                const saved = returnService.createReturn(api, {
                    id: returnId, sale_id: s.saleId, return_number: `RET-DEMO-${String(returnCount).padStart(3, '0')}`,
                    total_refund: s.refund, reason: sellable ? 'changed_mind' : 'defect', employee_id: seller,
                    items: [{ sale_item_id: s.lineId, quantity: s.line.quantity, refund_amount: s.refund, condition: sellable ? 'sellable' : 'damaged' }],
                });
                // After the day's last ticket: the stock history stays in order
                const when = sqlTime(at(day.daysAgo, 21, 5));
                api.run('UPDATE returns SET created_at = ? WHERE id = ?', [when, returnId]);
                api.run('UPDATE inventory_logs SET created_at = ? WHERE rowid > ?', [when, logsBefore]);
                drawer -= Number(saved.total_refund) || 0;
            }
        }

        // Money taken out for the shop
        if (random() < 0.3) {
            const amount = Math.min((1 + Math.floor(random() * 8)) * 100, Math.max(0, Math.floor(drawer / 100) * 100));
            if (amount > 0) {
                api.run('INSERT INTO cash_expenses (id, shift_id, employee_id, amount, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                    [api.uuid(), shiftId, seller, amount, pick(random, expenseReasons), sqlTime(at(day.daysAgo, 13, Math.floor(random() * 50)))]);
                drawer -= amount;
            }
        }

        // Closing, except today's drawer, still open
        if (day.daysAgo > 0) {
            api.run('UPDATE shifts SET end_time = ? WHERE id = ?', [at(day.daysAgo, 21, 30).toISOString(), shiftId]);
            const expected = round2(drawer);
            const r = random();
            const diff = r < 0.8 ? 0 : r < 0.9 ? -50 : r < 0.95 ? -20 : 30;
            const counted = Math.max(0, round2(expected + diff));
            const notes: Record<number, number> = {};
            let rest = counted;
            for (const value of [2000, 1000, 500, 200, 100, 50, 20, 10, 5]) { const n = Math.floor(rest / value); if (n) notes[value] = n; rest -= n * value; }
            api.run('UPDATE shifts SET closing_cash = ?, closing_count = ? WHERE id = ?', [counted, JSON.stringify(notes), shiftId]);
        }
    }

    // One old kridi left unpaid, so the overdue list is not empty
    const unpaid = creditOpen.find(d => d.paid < d.total);
    if (unpaid) api.run('UPDATE credit_sales SET due_date = ? WHERE id = ?', [new Date(now.getTime() - 10 * 86400000).toISOString(), unpaid.id]);

    // ---- Deliveries (three received, one waiting)
    const orders = [
        { supplier: 2, daysAgo: DAYS + 2, status: 'received', paid: 1 },
        { supplier: 0, daysAgo: 30, status: 'received', paid: 1 },
        { supplier: 1, daysAgo: 14, status: 'received', paid: 0.5 },
        { supplier: 2, daysAgo: 1, status: 'draft', paid: 0 },
    ];
    orders.forEach((order, i) => {
        const supplierId = `demo-sup-${order.supplier + 1}`;
        const id = `demo-po-${i + 1}`;
        const items = articles.filter(a => a.supplier === supplierId).slice(0, 6);
        const created = sqlTime(at(order.daysAgo, 10));
        const lines = items.map(a => ({ a, qty: (a.carton ? a.carton[0] : 10) * (1 + Math.floor(random() * 3)) }));
        const total = round2(lines.reduce((s, l) => s + l.qty * l.a.cost, 0));
        const paid = round2(total * order.paid);
        api.run(`INSERT INTO purchase_orders (id, po_number, supplier_id, status, subtotal, total, amount_paid, payment_status, created_by, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, `PO-DEMO-${String(i + 1).padStart(3, '0')}`, supplierId, order.status, total, total, paid,
                paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid', admin, created]);
        for (const { a, qty } of lines) {
            api.run(`INSERT INTO purchase_order_items (id, purchase_order_id, product_id, product_name, quantity, unit_cost, total_cost, received_quantity)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [api.uuid(), id, a.id, a.name, qty, a.cost, round2(qty * a.cost), order.status === 'received' ? qty : 0]);
        }
        if (order.status === 'received') {
            const rid = `demo-rcv-${i + 1}`;
            api.run('INSERT INTO receivings (id, receive_number, purchase_order_id, supplier_id, received_date, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [rid, `REC-DEMO-${String(i + 1).padStart(3, '0')}`, id, supplierId, created, 'completed', admin, created]);
            for (const { a, qty } of lines) {
                api.run('INSERT INTO receiving_items (id, receiving_id, product_id, product_name, quantity_ordered, quantity_received) VALUES (?, ?, ?, ?, ?, ?)',
                    [api.uuid(), rid, a.id, a.name, qty, qty]);
            }
        }
        if (paid > 0) {
            api.run('INSERT INTO supplier_payments (id, purchase_order_id, supplier_id, amount, payment_method, paid_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [api.uuid(), id, supplierId, paid, 'cash', created, admin]);
        }
    });

    return {
        articles: articles.length,
        sales: days.reduce((s, d) => s + d.tickets.filter(t => t.lines.length).length, 0),
        returns: returnCount,
        credits: creditCount,
        staff: DEMO_STAFF.map(s => ({ id: s.id, role: s.role, pin: s.pin, name: tr(s.name) })),
    };
}

/** The demo employees as the login screen shows them (name, role, PIN). */
export function demoStaff(lang: Lang = 'ar') {
    return DEMO_STAFF.map(s => ({ id: s.id, role: s.role, pin: s.pin, name: s.name[lang] || s.name.fr }));
}
