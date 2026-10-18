// The theme gallery's shops (dist-site/themes/<lang>/<theme>/): for each theme,
// the whole website a shop gets from Afus Boutique (home, categories, every
// article page, cart, checkout, about, contact...), made by the program's own
// site builder from the demo shop (its articles, photos and categories).
// Ordering is off (no order address), and a thin bar says it is a preview.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/** The demo shop in a temporary folder, through the program's own database code. */
async function demoShop() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afus-themes-'));
    const electronPath = require.resolve('electron');
    require.cache[electronPath] = { id: electronPath, filename: electronPath, loaded: true, exports: { app: { getPath: () => dir, isPackaged: false } } };
    const quiet = console.log; console.log = () => {};
    const init = require('../electron/database/init');
    const api = require('../electron/database/api');
    const demo = require('../electron/services/demoService');
    await init.initDatabase();
    console.log = quiet;
    return { dir, api, demo, init };
}

/** Articles kept in each theme's shop: enough for every page, light enough to publish 16 shops. */
const PER_THEME = 24;

/** A few articles of every category (those with a photo first), the categories they fill. */
function fewer(snap, max) {
    const byCat = new Map();
    for (const p of [...snap.products].sort((a, b) => (b.images.length > 0) - (a.images.length > 0))) {
        if (!byCat.has(p.categoryId)) byCat.set(p.categoryId, []);
        byCat.get(p.categoryId).push(p);
    }
    const kept = [];
    for (let round = 0; kept.length < max && round < 10; round++) {
        for (const list of byCat.values()) if (list[round] && kept.length < max) kept.push(list[round]);
    }
    const ids = new Set(kept.map(p => p.id));
    const count = (id) => kept.filter(p => p.categoryId === id).length;
    return {
        ...snap,
        products: snap.products.filter(p => ids.has(p.id)),
        categories: snap.categories.filter(c => count(c.id)).map(c => ({ ...c, count: count(c.id) })),
    };
}

/** Files every theme's shop has the same: kept once per language. */
const SHARED = /^(images|photos|assets\/fonts)\//;
/** Their addresses in a page (or style sheet, or search.json) at `up` from its shop's root. */
function toShared(text, up) {
    return text.replace(/(["'(])((?:\.\.\/)*)(images|photos|assets\/fonts|fonts)\//g, (m, q, rel, dir) => {
        if (dir === 'fonts') return `${q}${rel}../../_shared/assets/fonts/`; // from assets/store.css
        return `${q}${up}../_shared/${dir}/`;
    });
}

/** The preview bar, linked (the pages allow no inline style or script). */
function withBar(html, { depth, label, back, theme }) {
    const up = '../'.repeat(depth);
    const bar = `<div class="afus-preview"><a href="${up}../${back}">${label.back}</a><span>${label.preview} · ${theme}</span><a href="${up}../${label.contact}">${label.want}</a></div>`;
    return html
        .replace('</head>', `<link rel="stylesheet" href="${up}preview.css"></head>`)
        .replace(/<body([^>]*)>/, (m) => `${m}${bar}`);
}

export const PREVIEW_CSS = '.afus-preview{position:sticky;top:0;z-index:9999;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:8px 16px;background:#071440;color:#fff;font:600 14px/1.4 Cairo,system-ui,sans-serif}'
    + '.afus-preview a{color:#fff;text-decoration:none;padding:6px 12px;border:1px solid rgba(255,255,255,.35);border-radius:8px;min-height:36px;display:inline-flex;align-items:center}'
    + '.afus-preview a:last-child{background:#16B26B;border-color:#16B26B;color:#04301a}.afus-preview span{opacity:.85}';

/**
 * Writes every theme's shop for both languages under outDir/<lang>/<theme>/.
 * labels[lang] = { back, preview, want, gallery, contact }: gallery and contact pages from the site root.
 * @returns {{ [lang]: { [themeId]: { pages, products, first: { product, category } } } }}
 */
export async function buildThemeShops(outDir, labels) {
    const { dir, api, demo, init } = await demoShop();
    const { buildPublicData } = require('../electron/website/publicData');
    const { buildSite } = require('../electron/website/publish/siteBuilder');
    const { registry } = require('../electron/website/themes/registry');
    const { linkFor } = require('../electron/website/storefront/render');
    const summary = {};
    const quiet = console.log;
    try {
        for (const lang of ['ar', 'fr']) {
            console.log = () => {};
            await (summary.ar ? demo.reset({ lang }) : demo.enter({ lang }));
            console.log = quiet;
            const images = path.join(dir, 'demo', 'images');
            const snapshot = fewer(buildPublicData(api, { now: Date.now() }), PER_THEME);
            summary[lang] = {};
            for (const theme of registry.list()) {
                const site = buildSite({ snapshot, theme, lang, readImage: (name) => fs.readFileSync(path.join(images, name)) });
                const root = path.join(outDir, lang, theme.id);
                for (const f of site.files) {
                    if (['README.md', 'CNAME', 'robots.txt', '.nojekyll', 'catalog.json'].includes(f.path)) continue;
                    // The same pictures and fonts in every theme: written once per language (_shared/)
                    const shared = SHARED.test(f.path);
                    const file = shared ? path.join(outDir, lang, '_shared', f.path) : path.join(root, f.path);
                    if (shared && fs.existsSync(file)) continue;
                    fs.mkdirSync(path.dirname(file), { recursive: true });
                    const depth = f.path.split('/').length - 1 + 2; // up to themes/ (outDir)
                    let body = f.content;
                    if (/\.(html|css|json)$/.test(f.path)) body = toShared(String(body), '../'.repeat(f.path.split('/').length - 1));
                    if (f.path.endsWith('.html')) body = withBar(body, { depth, label: labels[lang], back: labels[lang].gallery, theme: theme.name[lang] || theme.name.fr });
                    fs.writeFileSync(file, body);
                }
                const product = snapshot.products.find(p => p.images.length) || snapshot.products[0];
                summary[lang][theme.id] = {
                    pages: site.summary.pages,
                    products: site.summary.products,
                    first: { product: product ? linkFor('product', product.id) : null, category: snapshot.categories[0] ? linkFor('category', snapshot.categories[0].id) : null },
                };
            }
        }
    } finally {
        console.log = quiet;
        try { init.closeDatabase(); } catch { /* already closed */ }
        fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.writeFileSync(path.join(outDir, 'preview.css'), PREVIEW_CSS);
    return summary;
}
