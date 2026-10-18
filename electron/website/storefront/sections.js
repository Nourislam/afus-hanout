/**
 * The kinds of home page section a theme can list, each with its options
 * (checked by themes/schema.js) and how it is drawn from the shop's data.
 * A section with nothing to show (no article on sale, no description...)
 * draws nothing: a theme never invents content.
 *
 * Adding a kind of section: one entry here; every theme can then use it.
 */
const { esc, html, phoneDigits, phoneHtml } = require('./html');
const C = require('./components');
const { heroPhoto, themePhotos, categoryPhoto } = require('./photos');

const e = (values, def) => ({ kind: 'enum', values, default: def });
const int = (min, max, def) => ({ kind: 'int', min, max, default: def });
const bool = (def) => ({ kind: 'bool', default: def });


/** The articles a "products" section shows. */
function pick(ctx, source) {
    const all = ctx.snap.products;
    switch (source) {
        // Added to AFUS in the last 7 days (newest first), in stock
        case 'new': return (ctx.snap.newProducts || []).map(id => all.find(p => p.id === id)).filter(p => p && p.available);
        case 'sale': return all.filter(p => C.onSale(p) && p.available);
        case 'available': return all.filter(p => p.available);
        case 'featured': return [...all.filter(p => p.available && p.images.length), ...all.filter(p => p.available && !p.images.length)];
        // The shop's best sellers of the last 7 days (completed sales, order only), in stock
        case 'best': return (ctx.snap.bestSellers || []).map(id => all.find(p => p.id === id)).filter(p => p && p.available);
        default: return all;
    }
}

const TITLE = { new: 'new', sale: 'sale', featured: 'featured', available: 'available', all: 'all', best: 'best' };
// "See all" of each kind of list goes to its store page
const SEE_ALL = { new: ['page', 'new'], sale: ['page', 'offers'], best: ['page', 'best'], featured: ['page', 'products'], available: ['page', 'products'], all: ['page', 'products'] };
const sectionHead = (ctx, title, href) => `<div class="section-head"><h2 class="section-title">${esc(title)}</h2>${href ? `<a class="see-all" href="${esc(href)}">${esc(ctx.t('seeAll'))}</a>` : ''}</div>`;

const SECTION_TYPES = {
    hero: {
        options: { variant: e(['split', 'full', 'centered', 'editorial', 'playful', 'statement', 'boxed', 'minimal'], 'split'), cta: e(['all', 'sale', 'new'], 'all') },
        render(ctx, o) {
            const shop = ctx.snap.shop;
            const hero = shop.hero || {};
            // The picture: the shop's own, else the built-in photo it chose, else the theme's photo (never an article's)
            const src = hero.image ? ctx.img(hero.image) : ctx.photo(hero.photo || heroPhoto(ctx.theme.id));
            const alt = shop.name;
            const sale = ctx.snap.products.some(C.onSale);
            const target = o.cta === 'sale' && sale ? 'sale' : 'all';
            // A small line over the title, only when it is true (new pieces this week, a sale on)
            const eyebrow = (ctx.snap.newProducts || []).length ? ctx.t('new') : sale ? ctx.t('sale') : '';
            // The second way in: the sale (when the first is not already it), else the categories
            const second = sale && target !== 'sale' ? ['category', 'sale', ctx.t('offers')]
                : ctx.snap.categories.length ? ['page', 'categories', ctx.t('categories')] : null;
            return html(
                `<section class="hero hero-${o.variant}">`,
                src && `<div class="hero-media"><img src="${esc(src)}" alt="${esc(alt)}" fetchpriority="high" decoding="async"></div>`,
                `<div class="hero-text container-narrow">`,
                eyebrow && `<span class="hero-eyebrow">${esc(eyebrow)}</span>`,
                `<h1 class="hero-title">${esc(hero.title || shop.name)}</h1>`,
                (hero.subtitle || shop.description) && `<p class="hero-sub">${esc(hero.subtitle || shop.description)}</p>`,
                `<div class="hero-ctas"><a class="btn btn-primary" href="${esc(ctx.link('category', target))}">${esc(ctx.t('shopNow'))}</a>`,
                second && `<a class="btn btn-outline" href="${esc(ctx.link(second[0], second[1]))}">${esc(second[2])}</a>`,
                `</div></div></section>`,
            );
        },
    },

    // Pay on delivery, delivery to the wilaya, a call before sending: what a buyer checks first
    trust: {
        options: { style: e(['strip', 'cards'], 'strip') },
        render(ctx, o) {
            if (!C.featuresOf(ctx).trustBar) return '';
            return `<section class="trust-section trust-${o.style}"><div class="container">${C.trustList(ctx, 'trust-row')}</div></section>`;
        },
    },

    categories: {
        options: { style: e(['tiles', 'circles', 'pills', 'list'], 'tiles'), limit: int(2, 12, 6), title: bool(true) },
        render(ctx, o) {
            const cats = ctx.snap.categories.slice(0, o.limit);
            if (!cats.length) return '';
            const items = cats.map((c, i) => {
                // The picture chosen for the category (Website › Pictures), else an article photo of it, else a built-in photo matching its name
                const p = ctx.snap.products.find(x => x.categoryId === c.id && x.images.length);
                const src = c.image ? ctx.img(c.image) : c.photo ? ctx.photo(c.photo) : p ? ctx.img(p.images[0]) : ctx.photo(categoryPhoto(c.name, i));
                const media = (o.style === 'tiles' || o.style === 'circles') ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">` : '';
                return `<a class="cat cat-${o.style}" href="${esc(ctx.link('category', c.id))}">${media ? `<span class="cat-media">${media}</span>` : ''}<span class="cat-name">${esc(c.name)}</span></a>`;
            }).join('');
            return `<section class="container section">${o.title ? sectionHead(ctx, ctx.t('categories')) : ''}<div class="cats cats-${o.style}">${items}</div></section>`;
        },
    },

    products: {
        options: {
            source: e(['new', 'sale', 'featured', 'available', 'all', 'best'], 'featured'), limit: int(2, 24, 8),
            layout: e(['grid', 'carousel', 'large-first'], 'grid'), columns: int(2, 5, 4), seeAll: bool(true),
        },
        render(ctx, o) {
            const list = pick(ctx, o.source).slice(0, o.limit);
            if (!list.length) return '';
            const href = o.seeAll ? ctx.link(...SEE_ALL[o.source]) : null;
            return `<section class="container section">${sectionHead(ctx, ctx.t(TITLE[o.source]), href)}${C.productGrid(ctx, list, { columns: o.columns, layout: o.layout })}</section>`;
        },
    },

    promo: {
        options: { style: e(['banner', 'split', 'strip'], 'banner') },
        render(ctx, o) {
            const promo = C.bestPromotion(ctx);
            const count = ctx.snap.products.filter(C.onSale).length;
            if (!promo || !count) return '';
            return html(
                `<section class="promo promo-${o.style}">`,
                o.style === 'banner' && `<img class="promo-bg" src="${esc(ctx.photo('sale.webp'))}" alt="" loading="lazy" decoding="async">`,
                `<div class="container promo-row">`,
                `<div><span class="promo-pct">-${esc(promo.value)}%</span><h2 class="promo-title">${esc(promo.name)}</h2><p>${count} ${esc(ctx.t('articles'))}</p></div>`,
                `<a class="btn btn-light" href="${esc(ctx.link('category', 'sale'))}">${esc(ctx.t('shopNow'))}</a>`,
                `</div></section>`,
            );
        },
    },

    // A band of short lines going across (the shop's true promises and offers)
    marquee: {
        options: { style: e(['plain', 'bold', 'outline'], 'bold') },
        render(ctx, o) {
            const promo = C.bestPromotion(ctx);
            const f = C.featuresOf(ctx);
            const lines = [
                f.trustBar && ctx.t('trustCod'),
                f.trustBar && ctx.t('trustDelivery'),
                promo && ctx.snap.products.some(p => C.onSale(p) && p.available) && `-${promo.value}% ${promo.name}`,
                (ctx.snap.newProducts || []).length && ctx.t('newIn'),
                f.trustBar && ctx.t('trustCall'),
            ].filter(Boolean);
            if (lines.length < 2) return '';
            const row = (hidden) => `<div class="marquee-row"${hidden ? ' aria-hidden="true"' : ''}>${lines.map(l => `<span>${esc(l)}</span>`).join('')}</div>`;
            return `<section class="marquee marquee-${o.style}"><div class="marquee-track">${row(false)}${row(true)}</div></section>`;
        },
    },

    // Shop the look: one big picture with numbered points, and the articles it shows beside it
    lookbook: {
        options: { photo: int(1, 3, 2), side: e(['start', 'end'], 'start') },
        render(ctx, o) {
            const list = pick(ctx, 'featured').filter(p => p.images.length).slice(0, 4);
            if (list.length < 2) return '';
            const photos = themePhotos(ctx.theme.id);
            const src = ctx.photo(photos[(o.photo - 1) % photos.length]);
            const dots = list.map((p, i) => `<a class="look-dot look-dot-${i + 1}" href="${esc(ctx.link('product', p.id))}" aria-label="${esc(p.name)}">${i + 1}</a>`).join('');
            const items = list.map((p, i) => html(
                `<a class="look-item" href="${esc(ctx.link('product', p.id))}">`,
                `<span class="look-num">${i + 1}</span>`,
                `<img src="${esc(ctx.img(p.images[0]))}" alt="" loading="lazy" decoding="async">`,
                `<span class="look-info"><span class="look-name">${esc(p.name)}</span>${C.priceTag(ctx, p)}</span>`,
                `</a>`,
            )).join('');
            return html(
                `<section class="container section lookbook lookbook-${o.side}">`,
                sectionHead(ctx, ctx.t('shopTheLook')),
                `<div class="look-grid"><div class="look-media"><img src="${esc(src)}" alt="" loading="lazy" decoding="async">${dots}</div>`,
                `<div class="look-list">${items}<a class="btn btn-outline" href="${esc(ctx.link('page', 'products'))}">${esc(ctx.t('seeAll'))}</a></div></div>`,
                `</section>`,
            );
        },
    },

    // A picture with a few words and one way in (the shop's own words when it wrote some)
    imageText: {
        // topic: what the words are about (auto: the new pieces when there are, else the shop's choice)
        options: { style: e(['split', 'overlay', 'boxed'], 'split'), photo: int(1, 3, 3), reverse: bool(false), topic: e(['auto', 'story', 'delivery', 'sale'], 'auto') },
        render(ctx, o) {
            const shop = ctx.snap.shop;
            const photos = themePhotos(ctx.theme.id);
            const src = ctx.photo(photos[(o.photo - 1) % photos.length]);
            const fresh = (ctx.snap.newProducts || []).length > 0;
            const sale = ctx.snap.products.some(p => C.onSale(p) && p.available);
            // Only true words: a sale topic without a sale, or new pieces without any, falls back to the shop's choice
            const topic = o.topic === 'auto' ? (fresh ? 'new' : 'story') : o.topic === 'sale' && !sale ? 'story' : o.topic;
            const TOPIC = {
                new: ['newCollection', shop.description || ctx.t('newCollectionText'), ctx.link('page', 'new')],
                story: ['ourStory', shop.description || ctx.t('ourStoryText'), ctx.link('page', 'products')],
                delivery: ['trustDelivery', ctx.t('deliveryText'), ctx.link('page', 'products')],
                sale: ['offers', ctx.t('saleText'), ctx.link('page', 'offers')],
            };
            const [titleKey, text, href] = TOPIC[topic];
            const title = ctx.t(titleKey);
            return html(
                `<section class="image-text image-text-${o.style}${o.reverse ? ' is-reverse' : ''}">`,
                `<div class="it-media"><img src="${esc(src)}" alt="" loading="lazy" decoding="async"></div>`,
                `<div class="it-text"><h2 class="section-title">${esc(title)}</h2><p>${esc(text)}</p>`,
                `<a class="btn btn-primary" href="${esc(href)}">${esc(ctx.t('discover'))}</a></div>`,
                `</section>`,
            );
        },
    },

    // Categories as a collage: one big picture and smaller ones around it
    collage: {
        options: { style: e(['mosaic', 'duo', 'trio'], 'mosaic') },
        render(ctx, o) {
            const want = o.style === 'duo' ? 2 : o.style === 'trio' ? 3 : 5;
            const cats = ctx.snap.categories.slice(0, want);
            if (cats.length < 2) return '';
            const tiles = cats.map((c, i) => {
                const p = ctx.snap.products.find(x => x.categoryId === c.id && x.images.length);
                const src = c.image ? ctx.img(c.image) : c.photo ? ctx.photo(c.photo) : p ? ctx.img(p.images[0]) : ctx.photo(categoryPhoto(c.name, i));
                const n = ctx.snap.products.filter(x => x.categoryId === c.id && x.available).length;
                return `<a class="tile tile-${i + 1}" href="${esc(ctx.link('category', c.id))}"><img src="${esc(src)}" alt="" loading="lazy" decoding="async"><span class="tile-text"><span class="tile-name">${esc(c.name)}</span>${n ? `<small>${n} ${esc(ctx.t('articles'))}</small>` : ''}<span class="tile-cta">${esc(ctx.t('shopNow'))}</span></span></a>`;
            }).join('');
            return `<section class="container section"><div class="collage collage-${o.style} collage-n${cats.length}">${tiles}</div></section>`;
        },
    },

    // New in / best sellers / sale behind tabs (no script: the page's own form controls)
    tabs: {
        options: { limit: int(4, 12, 8), columns: int(2, 5, 4) },
        render(ctx, o) {
            const kinds = ['new', 'best', 'sale', 'featured'].map(k => [k, pick(ctx, k).slice(0, o.limit)]).filter(([, l]) => l.length);
            const used = kinds.filter(([k]) => k !== 'featured' || kinds.length < 2).slice(0, 3);
            if (!used.length) return '';
            ctx.tabsCount = (ctx.tabsCount || 0) + 1;
            const name = `tabs-${ctx.tabsCount}`;
            const inputs = used.map(([k], i) => `<input class="tab-in" type="radio" name="${name}" id="${name}-${k}"${i === 0 ? ' checked' : ''}>`).join('');
            const labels = used.map(([k]) => `<label class="tab-label" for="${name}-${k}">${esc(ctx.t(TITLE[k]))}</label>`).join('');
            const panels = used.map(([k, l]) => `<div class="tab-panel">${C.productGrid(ctx, l, { columns: o.columns })}<p class="tab-more"><a class="see-all" href="${esc(ctx.link(...SEE_ALL[k]))}">${esc(ctx.t('seeAll'))}</a></p></div>`).join('');
            return `<section class="container section tabs">${inputs}<div class="tab-labels" role="presentation">${labels}</div><div class="tab-panels">${panels}</div></section>`;
        },
    },

    brands: {
        options: { style: e(['text', 'boxed'], 'text') },
        render(ctx, o) {
            const names = [...new Set(ctx.snap.products.map(p => p.brand).filter(Boolean))].slice(0, 12);
            if (names.length < 2) return '';
            return `<section class="container section">${sectionHead(ctx, ctx.t('brands'))}<div class="brands brands-${o.style}">${names.map(n => `<span>${esc(n)}</span>`).join('')}</div></section>`;
        },
    },

    about: {
        options: { style: e(['plain', 'centered', 'split'], 'centered') },
        render(ctx, o) {
            const shop = ctx.snap.shop;
            if (!shop.description) return '';
            return `<section class="about about-${o.style}"><div class="container-narrow"><h2 class="section-title">${esc(ctx.t('about'))}</h2><p>${esc(shop.description)}</p></div></section>`;
        },
    },

    contact: {
        options: { style: e(['card', 'strip'], 'card'), whatsapp: bool(true) },
        render(ctx, o) {
            const shop = ctx.snap.shop;
            const where = [shop.address, shop.city, shop.wilaya].filter(Boolean).join(', ');
            const phone = phoneDigits(shop.phone);
            const extras = C.shopExtras(ctx);
            if (!phone && !where && !extras.hours && !extras.map) return '';
            return html(
                `<section class="container section"><div class="contact contact-${o.style}">`,
                `<div><h2 class="section-title">${esc(ctx.t('contact'))}</h2>`,
                shop.phone && `<p><strong>${esc(ctx.t('phone'))}:</strong> ${phoneHtml(shop.phone)}</p>`,
                where && `<p><strong>${esc(ctx.t('address'))}:</strong> ${esc(where)}</p>`,
                extras.map && `<p>${extras.map}</p>`,
                extras.hours,
                `</div>`,
                o.whatsapp && phone && `<a class="btn btn-primary" href="${esc(ctx.preview ? '#' : `https://wa.me/${phone}`)}">WhatsApp</a>`,
                `</div></section>`,
            );
        },
    },
};

module.exports = { SECTION_TYPES };
