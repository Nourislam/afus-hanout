// The Afus website: Arabic and French say the same things (same sections,
// same features, same questions), and the web demo's shims stay offline.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CONTENT } from '../site/content.mjs';

const shape = (v) => (Array.isArray(v) ? v.map(shape) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, shape(v[k])])) : typeof v);

describe('Afus website', () => {
    it('Arabic and French have the same sections, features and questions', () => {
        expect(shape(CONTENT.fr)).toEqual(shape(CONTENT.ar));
        expect(CONTENT.ar.boutique.features.length).toBeGreaterThanOrEqual(8);
        for (const [img] of CONTENT.ar.boutique.show) {
            for (const lang of ['ar', 'fr']) expect(fs.existsSync(path.join(__dirname, '../site/img', `${img}-${lang}.webp`)), `${img}-${lang}`).toBe(true);
        }
    });

    it('every company page has its title and description, and the demo button stays on the Afus Boutique page', () => {
        for (const lang of ['ar', 'fr']) {
            const t = CONTENT[lang];
            for (const page of [t.home, t.solutions, t.products, t.servicesPage, t.boutique, t.about, t.contactPage, t.privacy, t.terms]) {
                expect(page.title).toBeTruthy();
                expect(page.description).toBeTruthy();
            }
            expect(t.audiences.map(a => a[0])).toEqual(['shops', 'companies', 'administrations']);
        }
        const build = fs.readFileSync(path.join(__dirname, '../site/build.mjs'), 'utf8');
        const header = build.slice(build.indexOf('const cta = '), build.indexOf('const f = t.footer'));
        expect(header).toMatch(/^const cta = key === 'boutique'\s*\?[^:]*t\.nav\.demo/);
        expect((header.match(/t\.nav\.demo/g) || []).length).toBe(1);
    });

    it('no contact detail is invented: the order section shows only what config.json gives', () => {
        const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../site/config.json'), 'utf8'));
        expect(Object.keys(config).sort()).toEqual(['email', 'facebook', 'phone', 'whatsapp']);
        // The WhatsApp number is an Algerian mobile in international form
        expect(config.whatsapp.replace(/\D/g, '')).toMatch(/^213[5-7]\d{8}$/);
    });

    it('the web demo has no network: its Electron net and online modules refuse', () => {
        const electronShim = fs.readFileSync(path.join(__dirname, '../demo-web/shims/electron.js'), 'utf8');
        expect(electronShim).toMatch(/fetch: async \(\) => \{ throw new Error\('demo: offline'\)/);
        const empty = fs.readFileSync(path.join(__dirname, '../demo-web/shims/empty.js'), 'utf8');
        expect(empty).toMatch(/demo: offline/);
        expect(electronShim).not.toMatch(/\bfetch\s*\(\s*['"`h]/);
    });
});
