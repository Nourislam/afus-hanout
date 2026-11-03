import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// The Afus look (docs/AFUS-DESIGN.md): the values in afus-design.json must be
// the ones src/index.css and tailwind.config.js really use. To change the look
// on purpose, change both and say why in the commit.
const ROOT = path.resolve(__dirname, '..');
const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');

interface AfusDesign {
    fonts: { packages: string[]; sans: string[]; arabic: string[] };
    theme: { default: 'dark'; dark: Record<string, string>; light: Record<string, string> };
    accent: Record<string, string>;
    animation: Record<string, string>;
    utilities: string[];
    components: { ui: string[]; layout: string[] };
    icons: string;
}

const design = JSON.parse(read('afus-design.json')) as AfusDesign;
const css = read('src/index.css');
const tailwind = read('tailwind.config.js');

/** Custom properties declared in the CSS block that opens with `selector {`. */
function cssVariables(selector: string): Record<string, string> {
    const start = css.indexOf(`${selector} {`);
    if (start < 0) throw new Error(`${selector} not found in src/index.css`);
    const body = css.slice(start, css.indexOf('}', start));
    return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
}

/** The text between `key: <open>` and its first closing bracket in tailwind.config.js. */
function block(key: string, open: '[' | '{'): string {
    const close = open === '[' ? ']' : '}';
    const at = tailwind.search(new RegExp(`${key}:\\s*\\${open}`));
    if (at < 0) throw new Error(`${key} not found in tailwind.config.js`);
    return tailwind.slice(at, tailwind.indexOf(close, at));
}

const quoted = (text: string): string[] => [...text.matchAll(/'([^']*)'/g)].map(m => m[1]);

describe('Afus look (docs/AFUS-DESIGN.md)', () => {
    it('fonts: Inter and Cairo, bundled with the program', () => {
        for (const pkg of design.fonts.packages) expect(css).toContain(`@import '${pkg}';`);
        expect(quoted(block('sans', '['))).toEqual(design.fonts.sans);
        expect(quoted(block('arabic', '['))).toEqual(design.fonts.arabic);
    });

    it('theme colours: dark by default, light under html.theme-light', () => {
        expect(cssVariables(':root')).toEqual(design.theme.dark);
        expect(cssVariables('html.theme-light')).toEqual(design.theme.light);
    });

    it('accent colours', () => {
        const accent = Object.fromEntries([...block('accent', '{').matchAll(/(\w+):\s*'(#[0-9a-f]{6})'/g)].map(m => [m[1], m[2]]));
        expect(accent).toEqual(design.accent);
    });

    it('animations', () => {
        const animation = Object.fromEntries([...block('animation', '{').matchAll(/'([\w-]+)':\s*'([^']+)'/g)].map(m => [m[1], m[2]]));
        expect(animation).toEqual(design.animation);
    });

    it('Arabic text helpers: .tabular, .ltr, .flip-rtl', () => {
        for (const name of design.utilities) expect(css).toMatch(new RegExp(`\\.${name}\\s*\\{`));
    });

    it('shared components and icons are still there', () => {
        const ui = fs.readdirSync(path.join(ROOT, 'src/components/ui'));
        const layout = fs.readdirSync(path.join(ROOT, 'src/components/layout'));
        for (const file of design.components.ui) expect(ui).toContain(file);
        for (const file of design.components.layout) expect(layout).toContain(file);
        expect(JSON.parse(read('package.json')).devDependencies[design.icons]).toBeTruthy();
    });
});
