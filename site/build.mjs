// Builds the Afus website (npm run build:site -> dist-site/): the company pages
// (home, solutions, software, services, about, contact, privacy, terms), the
// Afus Boutique page and the web demo (dist-demo, built first), in Arabic
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

/** Every page, Arabic at the root and French under fr/. */
const PAGES = { home: '', solutions: 'solutions/', products: 'products/', services: 'services/', boutique: 'boutique/', about: 'about/', contact: 'contact/', privacy: 'privacy/', terms: 'terms/' };
const pagePath = (lang, key) => `${lang === 'fr' ? 'fr/' : ''}${PAGES[key]}index.html`;
const NAV = ['home', 'solutions', 'products', 'services', 'about', 'contact'];

const waDigits = () => String(CONFIG.whatsapp || '').replace(/\D/g, '');
const waUrl = (text) => (waDigits() ? `https://wa.me/${waDigits()}${text ? `?text=${encodeURIComponent(text)}` : ''}` : '');

function ctx(lang, key) {
    const t = CONTENT[lang];
    const depth = pagePath(lang, key).split('/').length - 1;
    const L = linker(depth);
    return {
        lang, t, key, depth, L,
        u: (k) => L(pagePath(lang, k)),
        demo: L(`demo/index.html${lang === 'ar' ? '' : '?lang=fr'}`),
        alternate: pagePath(t.other.code, key),
        arrow: lang === 'ar' ? 'arrow-left' : 'arrow-right',
    };
}

/** The Afus Boutique order buttons (on its dark order band). */
function contact(t) {
    const out = [];
    if (waDigits()) out.push(`<a class="btn btn-wa" href="${esc(waUrl(t.boutique.whatsappText))}" target="_blank" rel="noopener">${icon('message-circle', 20)}<span>${esc(t.boutique.whatsapp)}</span></a>`);
    if (CONFIG.phone) out.push(`<a class="btn btn-ghost-light" href="tel:${esc(String(CONFIG.phone).replace(/\s/g, ''))}">${icon('phone', 20)}<span dir="ltr">${esc(CONFIG.phone)}</span></a>`);
    if (facebookUrl()) out.push(`<a class="btn btn-ghost-light" href="${esc(facebookUrl())}" target="_blank" rel="noopener">${icon('facebook', 20)}<span>Facebook</span></a>`);
    if (CONFIG.email) out.push(`<a class="btn btn-ghost-light" href="mailto:${esc(CONFIG.email)}">${icon('mail', 20)}<span>${esc(t.boutique.email)}</span></a>`);
    return out;
}

/** The ways to reach the company, as a list (contact page, footer). */
function channels(t) {
    const out = [];
    if (waDigits()) out.push(['message-circle', 'WhatsApp', waUrl(t.contactPage.hello), CONFIG.phone || CONFIG.whatsapp, true]);
    if (CONFIG.phone) out.push(['phone', t.boutique.call, `tel:${String(CONFIG.phone).replace(/\s/g, '')}`, CONFIG.phone, false]);
    if (facebookUrl()) out.push(['facebook', 'Facebook', facebookUrl(), `/${String(CONFIG.facebook).replace(/^.*\//, '')}`, true]);
    if (CONFIG.email) out.push(['mail', t.boutique.email, `mailto:${CONFIG.email}`, CONFIG.email, false]);
    return out;
}

function layout(c, { title, description, body, scripts = '' }) {
    const { lang, t, key, L, u } = c;
    const current = (k) => (k === key || (k === 'products' && key === 'boutique') ? ' aria-current="page"' : '');
    const links = NAV.map(k => `<a href="${u(k)}"${current(k)}>${esc(t.nav[k])}</a>`).join('');
    const cta = key === 'boutique'
        ? `<a class="btn btn-primary btn-sm hdr-cta" href="${c.demo}">${icon('play-circle', 18)}<span>${esc(t.nav.demo)}</span></a>`
        : key === 'contact' && waDigits()
            ? `<a class="btn btn-primary btn-sm hdr-cta" href="${esc(waUrl(t.contactPage.hello))}" target="_blank" rel="noopener">${icon('message-circle', 18)}<span>WhatsApp</span></a>`
            : `<a class="btn btn-primary btn-sm hdr-cta" href="${u('contact')}">${icon('message-circle', 18)}<span>${esc(t.nav.contact)}</span></a>`;
    const f = t.footer;
    const col = (head, items) => `<div class="ftr-col"><h2>${esc(head)}</h2><ul>${items.map(([href, label, ext]) => `<li><a href="${esc(href)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${label}</a></li>`).join('')}</ul></div>`;
    return `<!doctype html>
<html lang="${lang}" dir="${t.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${L(`img/dashboard-${lang}.webp`)}">
<meta name="theme-color" content="#0a2472">
<link rel="icon" type="image/svg+xml" href="${L('icon.svg')}">
<link rel="alternate" hreflang="${t.other.code}" href="${L(c.alternate)}">
<link rel="stylesheet" href="${L(`assets/site.css?v=${VERSION}`)}">
</head>
<body class="page-${key}">
<a class="skip" href="#main">${esc(t.nav.skip)}</a>
<header class="site-header">
  <div class="container hdr">
    <a class="brand" href="${u('home')}" aria-label="Afus"><img src="${L('icon.svg')}" alt="" width="34" height="34"><span>Afus</span></a>
    <nav class="nav" aria-label="${esc(t.nav.menu)}">${links}</nav>
    <a class="lang" href="${L(c.alternate)}" hreflang="${t.other.code}" lang="${t.other.code}">${icon('globe', 16)}<span>${esc(t.other.label)}</span></a>
    ${cta}
    <details class="menu">
      <summary aria-label="${esc(t.nav.menu)}">${icon('menu', 22)}</summary>
      <nav class="menu-panel" aria-label="${esc(t.nav.menu)}">${links}<a href="${L(c.alternate)}" lang="${t.other.code}">${esc(t.other.label)}</a></nav>
    </details>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="container ftr">
    <div class="ftr-brand"><a class="brand" href="${u('home')}"><img src="${L('icon.svg')}" alt="" width="32" height="32"><span>Afus</span></a><p>${esc(f.about)}</p></div>
    ${col(f.company, [[u('about'), esc(t.nav.about)], [u('services'), esc(t.nav.services)], [u('solutions'), esc(t.nav.solutions)], [u('contact'), esc(t.nav.contact)]])}
    ${col(f.software, [[u('boutique'), 'Afus Boutique'], [c.demo, esc(t.nav.demo)], [u('products'), esc(t.nav.products)]])}
    ${col(f.contact, channels(t).map(([ic, label, href, , ext]) => [href, `${icon(ic, 16)}<span>${esc(label)}</span>`, ext]))}
  </div>
  <div class="container ftr-bottom"><p>© ${new Date().getFullYear()} Afus · ${esc(f.rights)} · ${esc(f.made)}</p><nav><a href="${u('privacy')}">${esc(t.privacy.h1)}</a><a href="${u('terms')}">${esc(t.terms.h1)}</a><a href="${L(c.alternate)}" lang="${t.other.code}">${esc(t.other.label)}</a></nav></div>
</footer>
${scripts}</body>
</html>
`;
}

function frame(src, alt, { eager = false } = {}) {
    return `<figure class="frame"><div class="frame-bar"><i></i><i></i><i></i><span>Afus Boutique</span></div><img src="${src}" alt="${esc(alt)}" width="1366" height="820"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"></figure>`;
}

const pageHero = ({ eyebrow, h1, lead }, ctas = '') => `<section class="page-hero"><div class="container narrow-hero">${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ''}<h1>${esc(h1)}</h1>${lead ? `<p class="lead">${esc(lead)}</p>` : ''}${ctas}</div></section>`;
const head = (title, lead) => `<div class="section-head"><h2 class="section-title">${esc(title)}</h2>${lead ? `<p>${esc(lead)}</p>` : ''}</div>`;
const card = ([ic, title, text]) => `<div class="card"><span class="ic">${icon(ic, 24)}</span><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
const checks = (points) => `<ul class="checks">${points.map(p => `<li>${icon('check', 18)}<span>${esc(p)}</span></li>`).join('')}</ul>`;
const callout = (text) => `<p class="callout">${icon('user-check', 20)}<span>${esc(text)}</span></p>`;
const steps = (list) => `<ol class="steps">${list.map(([title, text]) => `<li><h3>${esc(title)}</h3><p>${esc(text)}</p></li>`).join('')}</ol>`;

function ctaBand(c) {
    const h = c.t.home;
    const wa = waUrl(c.t.contactPage.hello);
    return `<section class="cta-band"><div class="container cta-inner"><div><h2>${esc(h.ctaTitle)}</h2><p>${esc(h.ctaText)}</p></div><div class="ctas">${wa ? `<a class="btn btn-wa btn-lg" href="${esc(wa)}" target="_blank" rel="noopener">${icon('message-circle', 20)}<span>WhatsApp</span></a>` : ''}<a class="btn btn-ghost-light btn-lg" href="${c.u('contact')}">${esc(c.t.nav.contact)}</a></div></div></section>`;
}

function boutiqueCard(c) {
    const b = c.t.home.boutique;
    return `<article class="product-card"><div class="pc-text"><span class="tag tag-ok">${esc(b.tag)}</span><h3>${esc(b.name)}</h3><p class="muted">${esc(b.for)}</p>${checks(b.points)}`
        + `<div class="ctas"><a class="btn btn-primary" href="${c.u('boutique')}">${esc(b.more)}</a><a class="btn btn-ghost" href="${c.demo}">${icon('play-circle', 18)}<span>${esc(c.t.nav.demo)}</span></a></div></div>`
        + `<div class="pc-media">${frame(c.L(`img/pos-${c.lang}.webp`), b.name)}</div></article>`;
}

function homePage(c) {
    const { t, u, L, lang } = c; const h = t.home;
    const body = html(
        `<section class="hero"><div class="container hero-grid">`,
        `<div class="hero-text"><span class="eyebrow">${esc(h.eyebrow)}</span><h1>${esc(h.h1)}</h1><p class="lead">${esc(h.lead)}</p>`,
        `<div class="ctas"><a class="btn btn-light btn-lg" href="${u('solutions')}">${esc(h.cta1)}${icon(c.arrow, 20)}</a><a class="btn btn-ghost-light btn-lg" href="${u('contact')}">${esc(h.cta2)}</a></div></div>`,
        `<div class="hero-media">${frame(L(`img/dashboard-${lang}.webp`), 'Afus Boutique', { eager: true })}</div>`,
        `</div></section>`,
        `<div class="strip"><div class="container strip-row">${h.strip.map(s => `<span>${icon('check-circle-2', 18)}${esc(s)}</span>`).join('')}</div></div>`,
        `<section class="section"><div class="container">${head(h.solutionsTitle, h.solutionsLead)}<div class="grid-3">`,
        t.audiences.map(([id, ic, title, text, , , more]) => `<a class="card card-link" href="${u('solutions')}#${id}"><span class="ic">${icon(ic, 26)}</span><h3>${esc(title)}</h3><p>${esc(text)}</p><span class="more">${esc(more)}${icon(c.arrow, 18)}</span></a>`),
        `</div></div></section>`,
        `<section class="section alt"><div class="container">${head(h.productTitle)}${boutiqueCard(c)}</div></section>`,
        `<section class="section"><div class="container">${head(h.servicesTitle)}<div class="grid-3">${t.services.slice(0, 6).map(card).join('')}</div>`,
        `<p class="center more-row"><a class="btn btn-ghost" href="${u('services')}">${esc(h.servicesMore)}${icon(c.arrow, 18)}</a></p></div></section>`,
        `<section class="section alt"><div class="container">${head(h.processTitle)}${steps(t.process)}${callout(t.buyNote)}</div></section>`,
        `<section class="section"><div class="container">${head(h.whyTitle)}<div class="grid-4">${h.why.map(card).join('')}</div></div></section>`,
        ctaBand(c),
    );
    return layout(c, { title: h.title, description: h.description, body });
}

function solutionsPage(c) {
    const { t, u, L, lang } = c; const s = t.solutions;
    const body = html(
        pageHero(s),
        `<section class="section"><div class="container">`,
        t.audiences.map(([id, ic, title, text, points, link, more], i) => html(
            `<article class="sol${i % 2 ? ' is-reverse' : ''}" id="${id}"><div class="sol-text"><span class="ic">${icon(ic, 26)}</span><h2>${esc(title)}</h2><p>${esc(text)}</p>${checks(points)}`,
            `<a class="btn ${link === 'boutique' ? 'btn-primary' : 'btn-ghost'}" href="${u(link)}">${esc(more)}${icon(c.arrow, 18)}</a></div>`,
            `<div class="sol-media">${id === 'shops' ? frame(L(`img/products-${lang}.webp`), title) : `<div class="sol-art" aria-hidden="true">${icon(ic, 72)}<div class="sol-tags">${points.map(p => `<span>${esc(p)}</span>`).join('')}</div></div>`}</div></article>`,
        )),
        `<p class="callout">${icon('info', 20)}<span>${esc(s.custom)}</span></p>`,
        `</div></section>`,
        ctaBand(c),
    );
    return layout(c, { title: s.title, description: s.description, body });
}

function productsPage(c) {
    const { t, u } = c; const p = t.products;
    const body = html(
        pageHero(p),
        `<section class="section"><div class="container">${head(t.home.productTitle)}${boutiqueCard(c)}<div class="grid-2 mt">`,
        `<article class="card"><span class="tag">${esc(p.soon.tag)}</span><h3>${esc(p.soon.name)}</h3><p>${esc(p.soon.text)}</p></article>`,
        `<article class="card"><span class="tag tag-blue">${esc(p.custom.tag)}</span><h3>${esc(p.custom.name)}</h3><p>${esc(p.custom.text)}</p><a class="btn btn-ghost" href="${u('contact')}">${esc(p.custom.cta)}${icon(c.arrow, 18)}</a></article>`,
        `</div></div></section>`,
        ctaBand(c),
    );
    return layout(c, { title: p.title, description: p.description, body });
}

function servicesPage(c) {
    const { t } = c; const s = t.servicesPage;
    const body = html(
        pageHero(s),
        `<section class="section"><div class="container">${head(t.home.servicesTitle)}<div class="grid-4">${t.services.map(card).join('')}</div></div></section>`,
        `<section class="section alt"><div class="container">${head(t.home.processTitle)}${steps(t.process)}${callout(t.buyNote)}</div></section>`,
        ctaBand(c),
    );
    return layout(c, { title: s.title, description: s.description, body });
}

function aboutPage(c) {
    const { t } = c; const a = t.about;
    const body = html(
        pageHero(a),
        `<section class="section"><div class="container about-grid"><div class="prose">${a.story.map(p => `<p>${esc(p)}</p>`).join('')}</div>`,
        `<aside class="mission"><span class="ic ic-light">${icon('target', 26)}</span><h2>${esc(a.missionTitle)}</h2><p>${esc(a.mission)}</p></aside></div></section>`,
        `<section class="section alt"><div class="container">${head(a.valuesTitle)}<div class="grid-4">${a.values.map(card).join('')}</div></div></section>`,
        ctaBand(c),
    );
    return layout(c, { title: a.title, description: a.description, body });
}

function contactPage(c) {
    const { t } = c; const k = t.contactPage;
    const form = waDigits() ? html(
        `<form class="form card" id="wa-form" novalidate><h2>${esc(k.formTitle)}</h2>`,
        `<label for="f-name">${esc(k.name)} <b aria-hidden="true">*</b></label><input id="f-name" name="name" autocomplete="name" required>`,
        `<div class="form-row"><div><label for="f-activity">${esc(k.activity)}</label><select id="f-activity" name="activity">${k.activities.map(a => `<option>${esc(a)}</option>`).join('')}</select></div>`,
        `<div><label for="f-city">${esc(k.city)}</label><input id="f-city" name="city" autocomplete="address-level1"></div></div>`,
        `<label for="f-message">${esc(k.message)} <b aria-hidden="true">*</b></label><textarea id="f-message" name="message" rows="5" required aria-describedby="f-hint"></textarea><small id="f-hint">${esc(k.messageHint)}</small>`,
        `<p class="form-error" role="alert" hidden>${esc(k.required)}</p>`,
        `<button class="btn btn-wa btn-lg" type="submit">${icon('send', 20)}<span>${esc(k.send)}</span></button><p class="form-note">${esc(k.formNote)}</p></form>`,
    ) : '';
    const list = channels(t).map(([ic, label, href, value, ext]) => `<a class="channel" href="${esc(href)}"${ext ? ' target="_blank" rel="noopener"' : ''}><span class="ic">${icon(ic, 22)}</span><span><b>${esc(label)}</b><span dir="ltr">${esc(value)}</span></span></a>`).join('');
    const labels = JSON.stringify({ hello: k.hello, name: k.name, activity: k.activity, city: k.city, url: `https://wa.me/${waDigits()}?text=` }).replace(/</g, '\\u003c');
    const script = form ? `<script>(function(){var L=${labels},f=document.getElementById('wa-form');f.addEventListener('submit',function(e){e.preventDefault();var v=function(n){return f.elements[n].value.trim()},err=f.querySelector('.form-error');if(!v('name')||!v('message')){err.hidden=false;f.elements[v('name')?'message':'name'].focus();return}err.hidden=true;var lines=[L.hello,L.name+': '+v('name'),L.activity+': '+v('activity')];if(v('city'))lines.push(L.city+': '+v('city'));lines.push('',v('message'));window.open(L.url+encodeURIComponent(lines.join('\\n')),'_blank','noopener')})})();</script>\n` : '';
    const body = html(
        pageHero(k),
        `<section class="section"><div class="container contact-grid">${form}<div class="channels"><h2>${esc(k.channelsTitle)}</h2>${list}${callout(t.buyNote)}</div></div></section>`,
    );
    return layout(c, { title: k.title, description: k.description, body, scripts: script });
}

const legalPage = (name) => (c) => {
    const p = c.t[name];
    const body = html(pageHero({ h1: p.h1 }), `<section class="section"><div class="container narrow prose legal">${p.sections.map(([h, text]) => `<h2>${esc(h)}</h2><p>${esc(text)}</p>`).join('')}</div></section>`);
    return layout(c, { title: p.title, description: p.description, body });
};

function boutiquePage(c) {
    const { t, L, lang, demo } = c; const b = t.boutique;
    const links = contact(t);
    const body = html(
        `<section class="hero"><div class="container hero-grid">`,
        `<div class="hero-text"><span class="eyebrow">${esc(b.eyebrow)}</span><h1>${esc(b.h1)}</h1><p class="lead">${esc(b.lead)}</p>`,
        `<div class="ctas"><a class="btn btn-light btn-lg" href="${demo}">${icon('play-circle', 20)}<span>${esc(b.cta1)}</span></a><a class="btn btn-ghost-light btn-lg" href="#order">${esc(b.cta2)}</a></div>`,
        `<p class="note">${esc(b.cta1note)}</p></div>`,
        `<div class="hero-media">${frame(L(`img/pos-${lang}.webp`), b.show[0][1], { eager: true })}</div>`,
        `</div></section>`,
        `<div class="strip"><div class="container strip-row">${b.strip.map(s => `<span>${icon('check-circle-2', 18)}${esc(s)}</span>`).join('')}</div></div>`,
        `<section class="section"><div class="container">${head(b.featuresTitle)}<div class="grid-3">${b.features.map(card).join('')}</div></div></section>`,
        `<section class="section alt"><div class="container">${head(b.showTitle)}`,
        b.show.map(([img, title, text], i) => `<div class="show${i % 2 ? ' is-reverse' : ''}"><div class="show-text"><h3>${esc(title)}</h3><p>${esc(text)}</p></div><div class="show-media">${frame(L(`img/${img}-${lang}.webp`), title)}</div></div>`),
        `<p class="center"><a class="btn btn-primary btn-lg" href="${demo}">${icon('play-circle', 20)}<span>${esc(b.cta1)}</span></a></p>`,
        `</div></section>`,
        `<section class="section"><div class="container">${head(b.stepsTitle)}${steps(b.steps)}</div></section>`,
        `<section class="section alt"><div class="container narrow">${head(b.faqTitle)}<div class="faq">`,
        b.faq.map(([q, a]) => `<details><summary>${esc(q)}${icon('chevron-down', 20)}</summary><p>${esc(a)}</p></details>`),
        `</div></div></section>`,
        `<section class="order" id="order"><div class="container narrow center"><h2>${esc(b.orderTitle)}</h2><p>${esc(links.length ? b.orderText : b.orderNoContact)}</p>`,
        `<div class="ctas center">${links.join('')}<a class="btn ${links.length ? 'btn-ghost-light' : 'btn-primary'} btn-lg" href="${demo}">${icon('play-circle', 20)}<span>${esc(b.cta1)}</span></a></div>`,
        `<p class="note">${esc(t.demoNote)}</p></div></section>`,
    );
    return layout(c, { title: b.title, description: b.description, body });
}

const RENDER = { home: homePage, solutions: solutionsPage, products: productsPage, services: servicesPage, boutique: boutiquePage, about: aboutPage, contact: contactPage, privacy: legalPage('privacy'), terms: legalPage('terms') };

function notFound() {
    const c = { ...ctx('ar', 'home'), key: 'nf' };
    const body = `<section class="section"><div class="container narrow center"><h1 class="nf">404</h1><p>${esc(CONTENT.ar.notFound.title)} · ${esc(CONTENT.fr.notFound.title)}</p><p class="more-row"><a class="btn btn-primary" href="./">${esc(CONTENT.ar.notFound.back)}</a></p></div></section>`;
    return layout(c, { title: '404 — Afus', description: CONTENT.ar.notFound.title, body });
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
for (const lang of ['ar', 'fr']) for (const key of Object.keys(PAGES)) write(pagePath(lang, key), RENDER[key](ctx(lang, key)));
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
