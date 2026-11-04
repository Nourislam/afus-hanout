import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import postcss from 'postcss';

// The Afus look (docs/AFUS-DESIGN.md): the values in afus-design.json must be
// the ones src/index.css and tailwind.config.js really use. To change the look
// on purpose, change both and say why in the commit.
const require = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, '..');
const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');

interface AfusDesign {
    fonts: { packages: string[]; body: string[]; bodyArabic: string[]; sans: string[]; arabic: string[] };
    theme: { default: 'dark'; dark: Record<string, string>; light: Record<string, string> };
    accent: Record<string, string>;
    animation: Record<string, string>;
    selectors: string[];
    components: { ui: string[]; layout: string[] };
    icons: string;
}

interface TailwindTheme {
    theme: { extend: { colors: { accent: Record<string, string> }; fontFamily: Record<string, string[]>; animation: Record<string, string> } };
}

const design = JSON.parse(read('afus-design.json')) as AfusDesign;
const css = postcss.parse(read('src/index.css'));
const loadConfig = require('tailwindcss/loadConfig') as (file: string) => TailwindTheme;
const tailwind = loadConfig(path.join(ROOT, 'tailwind.config.js')).theme.extend;

/** Every declaration of the rules that list `selector`, in file order (a later one wins). */
function declarations(selector: string): Record<string, string> {
    const found: Record<string, string> = {};
    css.walkRules(rule => {
        if (rule.selectors.includes(selector)) rule.walkDecls(decl => { found[decl.prop] = decl.value; });
    });
    return found;
}

/** The custom properties (without `--`) set for `selector`. */
function variables(selector: string): Record<string, string> {
    return Object.fromEntries(Object.entries(declarations(selector))
        .filter(([prop]) => prop.startsWith('--'))
        .map(([prop, value]) => [prop.slice(2), value]));
}

/** A font-family value as a list of names without quotes. */
const fontList = (value = ''): string[] => value.split(',').map(name => name.trim().replace(/^['"]|['"]$/g, ''));

const lower = (colours: Record<string, string>): Record<string, string> =>
    Object.fromEntries(Object.entries(colours).map(([name, value]) => [name, value.toLowerCase()]));

describe('Afus look (docs/AFUS-DESIGN.md)', () => {
    it('fonts: Inter and Cairo, bundled with the program', () => {
        const imports: string[] = [];
        css.walkAtRules('import', rule => { imports.push(rule.params.replace(/^['"]|['"]$/g, '')); });
        for (const pkg of design.fonts.packages) expect(imports).toContain(pkg);
    });

    it('fonts used on screen: Inter for Latin text, Cairo for Arabic', () => {
        expect(fontList(declarations('body')['font-family'])).toEqual(design.fonts.body);
        expect(fontList(declarations('html.lang-ar body')['font-family'])).toEqual(design.fonts.bodyArabic);
    });

    it('Tailwind font families', () => {
        expect(tailwind.fontFamily.sans).toEqual(design.fonts.sans);
        expect(tailwind.fontFamily.arabic).toEqual(design.fonts.arabic);
    });

    it('theme colours: dark by default, light under html.theme-light', () => {
        expect(variables(':root')).toEqual(design.theme.dark);
        expect(variables('html.theme-light')).toEqual(design.theme.light);
    });

    it('accent colours', () => {
        expect(lower(tailwind.colors.accent)).toEqual(lower(design.accent));
    });

    it('animations', () => {
        expect(tailwind.animation).toEqual(design.animation);
    });

    it('Arabic text helpers: .tabular, .ltr, .flip-rtl', () => {
        const selectors = new Set<string>();
        css.walkRules(rule => { for (const s of rule.selectors) selectors.add(s); });
        for (const selector of design.selectors) expect([...selectors]).toContain(selector);
    });

    it('shared components and icons are still there', () => {
        const ui = fs.readdirSync(path.join(ROOT, 'src/components/ui'));
        const layout = fs.readdirSync(path.join(ROOT, 'src/components/layout'));
        for (const file of design.components.ui) expect(ui).toContain(file);
        for (const file of design.components.layout) expect(layout).toContain(file);
        expect(JSON.parse(read('package.json')).devDependencies[design.icons]).toBeTruthy();
    });
});
