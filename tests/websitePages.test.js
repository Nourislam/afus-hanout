// Website › Pages: the owner's own texts for "About us" and the policy pages
// (empty: the ready-made text). The program's preview: its links open pages
// inside the preview, the commune is a list.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { createShop } from './helpers/shop';

const require = createRequire(import.meta.url);
const { buildPublicData } = require('../electron/website/publicData');
const { renderPage } = require('../electron/website/storefront/render');
const { registry } = require('../electron/website/themes/registry');
const { legalText, ownSections } = require('../electron/website/storefront/legal');

const NOW = Date.parse('2026-10-18T12:00:00Z');

describe('website pages', () => {
    it('the owner\'s text replaces the ready-made one; empty keeps it; written text is never HTML', async () => {
        const { api } = await createShop();
        const pages = { returns: '# Échange\nSous 7 jours.\n\nGardez le ticket <b>svp</b>.', about: 'Depuis 1998 à Alger.' };
        const data = buildPublicData(api, { now: NOW, info: { pages } });
        const theme = registry.get('classic');
        const returns = renderPage({ snapshot: data, theme, page: 'page', id: 'returns', lang: 'fr' });
        expect(returns).toContain('<h2>Échange</h2><p>Sous 7 jours.</p>');
        expect(returns).toContain('Gardez le ticket &lt;b&gt;svp&lt;/b&gt;.');
        const terms = renderPage({ snapshot: data, theme, page: 'page', id: 'terms', lang: 'fr' });
        expect(terms.replace(/<[^>]+>/g, ' ')).toMatch(legalText('terms', 'fr', data.shop).split('\n')[0].replace(/^# /, ''));
        const about = renderPage({ snapshot: data, theme, page: 'page', id: 'about', lang: 'fr' });
        expect(about).toContain('Depuis 1998 à Alger.');
    });

    it('the ready-made text, as the owner edits it, comes back as the same page', () => {
        const text = legalText('shipping', 'ar', { name: 'بوتيك', phone: '0555' });
        expect(text.startsWith('# ')).toBe(true);
        expect(ownSections(text).length).toBeGreaterThan(2);
        expect(ownSections(text).every(s => s.h && s.p.length)).toBe(true);
    });

    it('in the program\'s preview the commune is a list (the website\'s script fills it)', async () => {
        const { api } = await createShop();
        const data = buildPublicData(api, { now: NOW, preview: true });
        const html = renderPage({ snapshot: data, theme: registry.get('kids'), page: 'page', id: 'checkout', lang: 'ar', preview: true });
        expect(html).toMatch(/<select name="commune"/);
        expect(html).not.toMatch(/<input name="commune"/);
        const site = renderPage({ snapshot: data, theme: registry.get('kids'), page: 'page', id: 'checkout', lang: 'ar' });
        expect(site).toMatch(/<input name="commune"/);
    });
});
