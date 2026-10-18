// Builds the Afus website (npm run build:site -> dist-site/): the company page,
// the Afus Boutique page and the web demo (dist-demo, built first), in Arabic
// (/) and French (/fr/). Static files only, relative links: it works at any
// address (GitHub Pages project page today, the company's own domain later).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Lucide from 'lucide-react';
import { CONTENT } from './content.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'dist-site');
const CONFIG = JSON.parse(fs.readFileSync(path.join(HERE, 'config.json'), 'utf8'));
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pascal = (name) => name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('');
const icon = (name, size = 22) => renderToStaticMarkup(React.createElement(Lucide[pascal(name)], { size, strokeWidth: 1.8, 'aria-hidden': 'true' }));
const html = (...parts) => parts.flat().filter(p => p !== false && p != null && p !== '').join('');

/** Links from a page at `depth` folders below the root. */
const linker = (depth) => (p) => `${'../'.repeat(depth)}${p}`;

/** The company's Facebook page (config.json: its name, e.g. "afusDZ"). */
const facebookUrl = () => {
    const name = String(CONFIG.facebook || '').trim().replace(/^https?:\/\/(www\.)?facebook\.com\//, '').replace(/^\/+|\/+$/g, '');
    return /^[A-Za-z0-9.\-]{2,80}$/.test(name) ? `https://www.facebook.com/${name}` : '';
};

function contact(t) {
    const out = [];
    const digits = String(CONFIG.whatsapp || '').replace(/\D/g, '');
    if (digits) out.push(`<a class="btn btn-wa" href="https://wa.me/${esc(digits)}?text=${encodeURIComponent(t.boutique.whatsappText)}" target="_blank" rel="noopener">${icon('message-circle', 20)}<span>${esc(t.boutique.whatsapp)}</span></a>`);
    if (CONFIG.phone) out.push(`<a class="btn btn-ghost-light" href="tel:${esc(String(CONFIG.phone).replace(/\s/g, ''))}">${icon('phone', 20)}<span dir="ltr">${esc(CONFIG.phone)}</span></a>`);
    if (facebookUrl()) out.push(`<a class="btn btn-ghost-light" href="${esc(facebookUrl())}" target="_blank" rel="noopener">${icon('facebook', 20)}<span>Facebook</span></a>`);
    if (CONFIG.email) out.push(`<a class="btn btn-ghost-light" href="mailto:${esc(CONFIG.email)}">${icon('mail', 20)}<span>${esc(t.boutique.email)}</span></a>`);
    return out;
}

function layout({ lang, depth, page, title, description, body, alternate }) {
    const t = CONTENT[lang];
    const L = linker(depth);
    const base = lang === 'ar' ? '' : 'fr/';
    const nav = [
        ['index.html', t.nav.home, 'home'],
        ['boutique/index.html', t.nav.boutique, 'boutique'],
    ];
    return `<!doctype html>
<html lang="${lang}" dir="${t.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${L(`img/pos-${lang}.webp`)}">
<meta name="theme-color" content="#0b0b14">
<link rel="icon" type="image/svg+xml" href="${L('icon.svg')}">
<link rel="alternate" hreflang="${t.other.code}" href="${L(alternate)}">
<link rel="stylesheet" href="${L(`assets/site.css?v=${VERSION}`)}">
</head>
<body class="page-${page}">
<a class="skip" href="#main">${lang === 'ar' ? 'انتقل إلى المحتوى' : 'Aller au contenu'}</a>
<header class="site-header">
  <div class="container hdr">
    <a class="brand" href="${L(`${base}index.html`)}" aria-label="Afus"><img src="${L('icon.svg')}" alt="" width="32" height="32"><span>Afus</span></a>
    <nav class="nav" aria-label="${lang === 'ar' ? 'القائمة' : 'Menu'}">
      ${nav.map(([href, label, id]) => `<a href="${L(base + href)}"${id === page ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('')}
      <a class="lang" href="${L(alternate)}" hreflang="${t.other.code}" lang="${t.other.code}">${esc(t.other.label)}</a>
    </nav>
    <a class="btn btn-primary btn-sm hdr-cta" href="${L(`demo/index.html${lang === 'ar' ? '' : '?lang=fr'}`)}">${icon('play-circle', 18)}<span>${esc(t.nav.demo)}</span></a>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="container ftr">
    <div class="brand"><img src="${L('icon.svg')}" alt="" width="28" height="28"><span>Afus</span></div>
    <p>${esc(t.footer.made)} · © ${new Date().getFullYear()} Afus · ${esc(t.footer.rights)}</p>
    <nav>${CONFIG.whatsapp ? `<a href="https://wa.me/${esc(String(CONFIG.whatsapp).replace(/\D/g, ''))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}${facebookUrl() ? `<a href="${esc(facebookUrl())}" target="_blank" rel="noopener">Facebook</a>` : ''}<a href="${L(`${base}boutique/index.html`)}">Afus Boutique</a><a href="${L(`demo/index.html${lang === 'ar' ? '' : '?lang=fr'}`)}">${esc(t.nav.demo)}</a><a href="${L(alternate)}" lang="${t.other.code}">${esc(t.other.label)}</a></nav>
  </div>
</footer>
</body>
</html>
`;
}

function frame(src, alt, { eager = false } = {}) {
    return `<figure class="frame"><div class="frame-bar"><i></i><i></i><i></i><span>Afus Boutique</span></div><img src="${src}" alt="${esc(alt)}" width="1366" height="820"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"></figure>`;
}

function homePage(lang) {
    const t = CONTENT[lang]; const h = t.home;
    const depth = lang === 'ar' ? 0 : 1;
    const L = linker(depth);
    const base = lang === 'ar' ? '' : 'fr/';
    const demo = L(`demo/index.html${lang === 'ar' ? '' : '?lang=fr'}`);
    const body = html(
        `<section class="hero"><div class="container hero-grid">`,
        `<div class="hero-text"><span class="eyebrow">${esc(h.eyebrow)}</span><h1>${esc(h.h1)}</h1><p class="lead">${esc(h.lead)}</p>`,
        `<div class="ctas"><a class="btn btn-primary btn-lg" href="${L(`${base}boutique/index.html`)}">${esc(h.cta1)}</a><a class="btn btn-ghost-light btn-lg" href="${demo}">${icon('play-circle', 20)}<span>${esc(h.cta2)}</span></a></div></div>`,
        `<div class="hero-media">${frame(L(`img/dashboard-${lang}.webp`), 'Afus Boutique', { eager: true })}</div>`,
        `</div></section>`,
        `<section class="section"><div class="container"><h2 class="section-title">${esc(h.productsTitle)}</h2><div class="products">`,
        `<article class="product-card"><div class="pc-text"><span class="tag tag-ok">${esc(h.boutique.tag)}</span><h3>${esc(h.boutique.name)}</h3><p class="muted">${esc(h.boutique.for)}</p>`,
        `<ul class="checks">${h.boutique.points.map(p => `<li>${icon('check', 18)}<span>${esc(p)}</span></li>`).join('')}</ul>`,
        `<div class="ctas"><a class="btn btn-primary" href="${L(`${base}boutique/index.html`)}">${esc(h.boutique.more)}</a><a class="btn btn-ghost" href="${demo}">${esc(h.boutique.try)}</a></div></div>`,
        `<div class="pc-media"><img src="${L(`img/pos-${lang}.webp`)}" alt="" loading="lazy" width="1366" height="820"></div></article>`,
        `<article class="soon-card"><span class="tag">${esc(h.soon.tag)}</span><h3>${esc(h.soon.name)}</h3><p class="muted">${esc(h.soon.text)}</p></article>`,
        `</div></div></section>`,
        `<section class="section alt"><div class="container"><h2 class="section-title">${esc(h.whyTitle)}</h2><div class="why">`,
        h.why.map(([ic, title, text]) => `<div class="why-item"><span class="ic">${icon(ic, 24)}</span><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`),
        `</div></div></section>`,
    );
    return layout({ lang, depth, page: 'home', title: h.title, description: h.description, body, alternate: lang === 'ar' ? 'fr/index.html' : 'index.html' });
}

function boutiquePage(lang) {
    const t = CONTENT[lang]; const b = t.boutique;
    const depth = lang === 'ar' ? 1 : 2;
    const L = linker(depth);
    const demo = L(`demo/index.html${lang === 'ar' ? '' : '?lang=fr'}`);
    const links = contact(t);
    const body = html(
        `<section class="hero"><div class="container hero-grid">`,
        `<div class="hero-text"><span class="eyebrow">${esc(b.eyebrow)}</span><h1>${esc(b.h1)}</h1><p class="lead">${esc(b.lead)}</p>`,
        `<div class="ctas"><a class="btn btn-primary btn-lg" href="${demo}">${icon('play-circle', 20)}<span>${esc(b.cta1)}</span></a><a class="btn btn-ghost-light btn-lg" href="#order">${esc(b.cta2)}</a></div>`,
        `<p class="note">${esc(b.cta1note)}</p></div>`,
        `<div class="hero-media">${frame(L(`img/pos-${lang}.webp`), b.show[0][1], { eager: true })}</div>`,
        `</div></section>`,
        `<div class="strip"><div class="container strip-row">${b.strip.map(s => `<span>${icon('check', 16)}${esc(s)}</span>`).join('')}</div></div>`,
        `<section class="section"><div class="container"><h2 class="section-title">${esc(b.featuresTitle)}</h2><div class="features">`,
        b.features.map(([ic, title, text]) => `<div class="feature"><span class="ic">${icon(ic, 22)}</span><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`),
        `</div></div></section>`,
        `<section class="section alt"><div class="container"><h2 class="section-title">${esc(b.showTitle)}</h2>`,
        b.show.map(([img, title, text], i) => `<div class="show${i % 2 ? ' is-reverse' : ''}"><div class="show-text"><h3>${esc(title)}</h3><p>${esc(text)}</p></div><div class="show-media">${frame(L(`img/${img}-${lang}.webp`), title)}</div></div>`),
        `<p class="center"><a class="btn btn-primary btn-lg" href="${demo}">${icon('play-circle', 20)}<span>${esc(b.cta1)}</span></a></p>`,
        `</div></section>`,
        `<section class="section"><div class="container"><h2 class="section-title">${esc(b.stepsTitle)}</h2><ol class="steps">`,
        b.steps.map(([title, text]) => `<li><h3>${esc(title)}</h3><p>${esc(text)}</p></li>`),
        `</ol></div></section>`,
        `<section class="section alt"><div class="container narrow"><h2 class="section-title">${esc(b.faqTitle)}</h2><div class="faq">`,
        b.faq.map(([q, a]) => `<details><summary>${esc(q)}${icon('chevron-down', 20)}</summary><p>${esc(a)}</p></details>`),
        `</div></div></section>`,
        `<section class="order" id="order"><div class="container narrow center"><h2>${esc(b.orderTitle)}</h2><p>${esc(links.length ? b.orderText : b.orderNoContact)}</p>`,
        `<div class="ctas center">${links.join('')}<a class="btn ${links.length ? 'btn-ghost-light' : 'btn-primary'} btn-lg" href="${demo}">${icon('play-circle', 20)}<span>${esc(b.cta1)}</span></a></div>`,
        `<p class="note">${esc(t.demoNote)}</p></div></section>`,
    );
    return layout({ lang, depth, page: 'boutique', title: b.title, description: b.description, body, alternate: lang === 'ar' ? 'fr/boutique/index.html' : 'boutique/index.html' });
}

function notFound() {
    const t = CONTENT.ar;
    // At the site root on GitHub Pages: links work from any depth with the root folder name
    const body = `<section class="section"><div class="container narrow center"><h1>404</h1><p>${esc(t.notFound.title)} · ${esc(CONTENT.fr.notFound.title)}</p><p><a class="btn btn-primary" href="./">${esc(t.notFound.back)}</a></p></div></section>`;
    return layout({ lang: 'ar', depth: 0, page: 'nf', title: '404 — Afus', description: t.notFound.title, body, alternate: 'fr/index.html' });
}

function copyDir(from, to) {
    fs.mkdirSync(to, { recursive: true });
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
        const a = path.join(from, e.name); const b = path.join(to, e.name);
        if (e.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
    }
}

function write(rel, text) {
    const p = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text);
}

fs.rmSync(OUT, { recursive: true, force: true });
write('index.html', homePage('ar'));
write('fr/index.html', homePage('fr'));
write('boutique/index.html', boutiquePage('ar'));
write('fr/boutique/index.html', boutiquePage('fr'));
write('404.html', notFound());
write('.nojekyll', '');
write('robots.txt', 'User-agent: *\nAllow: /\nDisallow: /demo/\n');
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
fs.copyFileSync(path.join(HERE, 'site.css'), path.join(OUT, 'assets', 'site.css'));
const FONTS = path.join(ROOT, 'node_modules/@fontsource-variable/cairo/files');
for (const f of ['cairo-arabic-wght-normal.woff2', 'cairo-latin-wght-normal.woff2', 'cairo-latin-ext-wght-normal.woff2']) fs.copyFileSync(path.join(FONTS, f), path.join(OUT, 'assets', f));
copyDir(path.join(HERE, 'img'), path.join(OUT, 'img'));
fs.copyFileSync(path.join(ROOT, 'public', 'icon.svg'), path.join(OUT, 'icon.svg'));
if (fs.existsSync(path.join(ROOT, 'dist-demo', 'index.html'))) copyDir(path.join(ROOT, 'dist-demo'), path.join(OUT, 'demo'));
else console.warn('dist-demo missing: run npm run build:demo first');
console.log('site built in dist-site/');
