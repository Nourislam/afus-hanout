// The sections taken from the patterns of the big fashion themes (own code):
// a moving band, shop the look, picture with text, a collage of categories,
// tabs without script, three new heroes. Each theme now opens differently.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { createShop } from './helpers/shop';

const require = createRequire(import.meta.url);
const { buildPublicData } = require('../electron/website/publicData');
const { renderPage } = require('../electron/website/storefront/render');
const { registry } = require('../electron/website/themes/registry');
const { normalizeTheme } = require('../electron/website/themes/schema');
const catalog = require('../electron/services/catalogService');

const NOW = Date.parse('2026-10-11T12:00:00Z');

async function data({ sale = false, photos = true } = {}) {
    const { api } = await createShop();
    api.run("INSERT INTO categories (id, name) VALUES ('c-f', 'Femmes'), ('c-k', 'أطفال'), ('c-h', 'Hommes')");
    api.run("UPDATE products SET category_id = 'c-f' WHERE id = 'jean'");
    api.run("UPDATE products SET category_id = 'c-k' WHERE id = 'belt'");
    for (const id of ['robe', 'chemise', 'veste']) catalog.saveProduct(api, { id, name: id, price: 2500, stock_quantity: 3, category_id: 'c-h' }, [], { isNew: true });
    if (photos) api.run("UPDATE products SET image_path = 'p.jpg'");
    const snap = buildPublicData(api, { now: NOW });
    if (sale) {
        snap.products[0].salePrice = Math.round(snap.products[0].price * 0.8);
        snap.promotions = [{ type: 'percentage', value: 20, name: 'Soldes' }];
    }
    return snap;
}
const home = (snapshot, theme, lang = 'ar') => renderPage({ snapshot, theme, page: 'home', lang, assetUrl: (n) => `images/${n}` });
const withHome = (id, sections) => normalizeTheme({ ...registry.get(id), home: sections }).theme;

describe('new home sections', () => {
    it('every theme opens with its own hero and its own list of sections', async () => {
        const snap = await data();
        const heads = registry.list().map(t => JSON.stringify(t.home.map(s => [s.type, s.variant || s.style])));
        expect(new Set(heads).size).toBe(heads.length);
        const heroes = registry.list().map(t => `${t.home[0].variant}`);
        expect(new Set(heroes).size).toBeGreaterThanOrEqual(5);
        for (const theme of registry.list()) expect(home(snap, theme), theme.id).toContain(`hero-${theme.home[0].variant}`);
    });

    it('the moving band: true lines only, a copy hidden from screen readers, still for reduced motion', async () => {
        const snap = await data({ sale: true });
        const html = home(snap, withHome('streetwear', [{ type: 'marquee', style: 'bold' }]));
        expect(html).toContain('class="marquee marquee-bold"');
        expect(html).toContain('-20% Soldes');
        expect((html.match(/class="marquee-row"/g) || []).length).toBe(2);
        expect(html).toContain('aria-hidden="true"');
        const { css } = require('../electron/website/storefront/css');
        expect(css(registry.get('streetwear'))).toMatch(/prefers-reduced-motion:reduce\)\{\.marquee-track\{animation:none/);
    });

    it('shop the look: numbered points on the picture, each a link to its article', async () => {
        const snap = await data();
        const html = home(snap, withHome('luxury', [{ type: 'lookbook', photo: 2, side: 'start' }]));
        const dots = [...html.matchAll(/class="look-dot look-dot-(\d)" href="([^"]+)"/g)];
        expect(dots.length).toBeGreaterThanOrEqual(2);
        expect(dots.length).toBeLessThanOrEqual(4);
        for (const [, , href] of dots) expect(html).toContain(`class="look-item" href="${href}"`);
        expect(html).toContain('photos/look-suit-dark.webp');
        // No article with a picture: no lookbook at all
        expect(home(await data({ photos: false }), withHome('luxury', [{ type: 'lookbook' }]))).not.toContain('lookbook');
    });

    it('picture with text: never speaks of a sale that is not there', async () => {
        const theme = withHome('sport', [{ type: 'imageText', style: 'overlay', topic: 'sale' }]);
        const without = home(await data(), theme);
        expect(without).not.toMatch(/href="[^"]*offers/);
        const withSale = home(await data({ sale: true }), theme);
        expect(withSale).toContain('image-text-overlay');
        expect(withSale).toMatch(/<a class="btn btn-primary" href="[^"]*offers/);
    });

    it('collage of categories and tabs without script', async () => {
        const snap = await data({ sale: true });
        const html = home(snap, withHome('fashion-modern', [{ type: 'collage', style: 'mosaic' }, { type: 'tabs' }]));
        expect(html).toMatch(/class="collage collage-mosaic collage-n3"/);
        const tabs = [...html.matchAll(/<input class="tab-in" type="radio" name="tabs-1" id="([^"]+)"/g)].map(m => m[1]);
        expect(tabs.length).toBeGreaterThanOrEqual(1);
        expect((html.match(/class="tab-panel"/g) || []).length).toBe(tabs.length);
        for (const id of tabs) expect(html).toContain(`<label class="tab-label" for="${id}">`);
        expect(html).not.toMatch(/<script(?![^>]*src=)/);
    });

    it('a theme with an unknown section option is refused', () => {
        expect(normalizeTheme({ ...registry.get('kids'), home: [{ type: 'imageText', topic: 'free-gift' }] }).ok).toBe(false);
        expect(normalizeTheme({ ...registry.get('kids'), home: [{ type: 'hero', variant: 'statement' }] }).ok).toBe(true);
    });
});
