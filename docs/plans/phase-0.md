# المرحلة 0: المستودع والهوية

## الملخّص

**الهدف:** أفوس حانوت يحمل اسمه وهويته ومجلد بياناته الخاص، ويقبل ملفات TypeScript جديدة، ولمسة أفوس مكتوبة ومحمية باختبار. لا ميزة جديدة ولا حذف في هذه المرحلة (الحذف في المرحلة 1).

**ما تم قبل الخطة:**
- `main` في afus-hanout يحمل تاريخ Boutique كاملاً (167 commit حتى `d0d5e51`)، و`boutique` مربوط ودفعه `DISABLED`.
- الدراسة وتقرير الفهم في `docs/plans/` على الفرع `phase-0-identity`.

**ما تفعله المرحلة، بالترتيب:**
1. **إصلاح مشترك (`core:`):** اسم ملف المحل التجريبي مكتوب `afus-boutique-demo.db` في `init.js`؛ يصبح من `brand.json`. وأربعة اختبارات تكتب اسم Boutique بيدها؛ تقرؤه من `brand.json`. هذا يصلح للبرنامجين.
2. **الهوية:** `brand.json` و`package.json` = Afus Hanout / afus-hanout / dz.afus.hanout / AfusHanout / afus-hanout.db، وأسماء ملفات المثبّت في GitHub Actions.
3. **سطر Afus Hanout** في جدول المنتجات في `docs/NAMING.md` (داخل afus-hanout فقط).
4. **TypeScript للملفات الجديدة فقط:** `tsconfig.json` (strict)، وlint وvitest يقرآن `.ts` و`.tsx`، وفحص الأنواع في CI.
5. **لمسة أفوس:** `docs/AFUS-DESIGN.md` و`afus-design.json`، و`tests/design.test.ts` يفشل إن تغيّر لون أو خط أو متغير أو مكوّن.
6. **README:** العنوان والفقرة الأولى للحوانيت (عربي وإنجليزي)، مع «لا موقع ولا متجر إلكتروني».
7. **ملاحظات Boutique** في `docs/boutique-notes.md`، وأمر المرحلة في `docs/prompts/phase-0.md`.
8. **التحقق:** lint، فحص الأنواع، كل الاختبارات، البناء؛ ثم PR ودمج بعد CI.

**ما يحتاج قرارك (في هذه الخطة):**
- **Q1 – `tests/brand.test.js`:** أحذف `hanout` من قائمة الأسماء القديمة الممنوعة. لا شيء آخر يتغيّر في الاختبار.
- **Q2 – رقم الإصدار:** أقترح أن يبدأ حانوت من `0.1.0` (و`1.0.0` عند الإطلاق) بدل `1.5.0` الموروث من Boutique.
- **Q3 – TypeScript في عملية Electron الرئيسية:** ملفات `electron/` تُشغَّل بـ Node دون بناء، فملف `.ts` هناك يحتاج خطوة تحويل. أقترح أن نضيفها حين يأتي أول ملف من هذا النوع (المرحلة 1)، لا الآن. في المرحلة 0: TypeScript في `src/` و`tests/` فقط.

**ما يحتاجه التنفيذ منك:**
- **السماح بـ `cdn.sheetjs.com`** في إعدادات شبكة البيئة السحابية: حزمة `xlsx` تُنزَّل من هناك، و`npm ci` يفشل بدونها (403). الخطوات: https://code.claude.com/docs/en/cloud-environments#network-access
- **حذف 5 فروع مؤقتة** من afus-hanout على GitHub (`tmp-import-0`، `tmp-import-1`، `tmp-import-2-0`، `tmp-import-2-1`، `tmp-import-2-2`): استعملتها لرفع التاريخ على دفعات، والجلسة لا تسمح لي بحذفها.
- **تشغيل مهارتين بنفسك** داخل afus-hanout: `/setup-matt-pocock-skills` ثم `/ubiquitous-language` (الناتج `UBIQUITOUS_LANGUAGE.md`). هما مضبوطتان على «المستخدم فقط».
- **شرط الانتقال على حاسوبك:** تثبيت Boutique وحانوت معاً، والتأكد أن لكل واحد مجلده وقاعدته (الخطوات في Task 10).

---

# Phase 0 Implementation Plan: repository and identity

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afus Hanout builds, tests and installs under its own identity (`dz.afus.hanout`, data folder `AfusHanout`, database `afus-hanout.db`), accepts new TypeScript files, and has the Afus look written down and guarded by a test. No feature is added and nothing is removed.

**Architecture:** The identity has one source, `electron/shared/brand.json`, read by `electron/brand.js` (main process) and `src/config/brand.js` (interface); `package.json` repeats what electron-builder needs. Two hard-coded Boutique names (the demo database file and four tests) are first made to read `brand.json` in `core:` commits that also apply to Boutique. TypeScript is added for new files in `src/` and `tests/` only (Vite and vitest compile them); existing `.js`/`.jsx` files stay as they are.

**Tech Stack:** Electron 39, React 18, Vite 7, Tailwind 3, sql.js, vitest 4, ESLint 9 (legacy `.eslintrc.json`, `ESLINT_USE_FLAT_CONFIG=false`), TypeScript 5, typescript-eslint 8.

**Rules for every task:** run `pwd` and `git remote -v` before any push (must be `/home/user/afus-hanout`, `boutique` push `DISABLED`). Commit messages in English, ending with the session's attribution lines. A `core:` commit touches only what is shared with Boutique and contains no Hanout name, so it can be cherry-picked into Boutique as it is; its tests are `.js` because Boutique has no TypeScript.

## File map

| File | Change | Responsibility |
| --- | --- | --- |
| `electron/database/init.js` | Modify line 19 | Demo database file name from `BRAND.fileSlug` |
| `tests/demoFileName.test.js` | Create | Demo file name follows the brand (core) |
| `tests/brand.test.js`, `tests/backup.test.js`, `tests/demo.test.js`, `tests/documents.test.js` | Modify | Read names from `brand.json` instead of writing Boutique's |
| `electron/shared/brand.json` | Modify | Afus Hanout identity |
| `package.json`, `package-lock.json` | Modify | Same identity for electron-builder; TypeScript tooling |
| `tests/hanoutIdentity.test.ts` | Create | The exact Hanout identity values |
| `electron/brand.js`, `src/config/brand.js` | Modify comments | Name the product generically |
| `.github/workflows/build-windows-installer.yml` | Modify | Hanout artifact name, no dead branch trigger |
| `.github/workflows/ci.yml` | Modify | Type check step |
| `docs/NAMING.md` | Modify | Afus Hanout row |
| `tsconfig.json` | Create | Strict TypeScript for new files |
| `.eslintrc.json` | Modify | `.ts`/`.tsx` override |
| `afus-design.json` | Create | Afus design tokens |
| `tests/design.test.ts` | Create | Fails when the look drifts from the tokens |
| `docs/AFUS-DESIGN.md` | Create | The Afus look in words |
| `README.md` | Modify title and first paragraph | Grocery shops, no website or online store |
| `docs/boutique-notes.md` | Create | Problems found in Boutique (not fixed there) |
| `docs/prompts/phase-0.md` | Create | The phase 0 prompt from the study |

---

### Task 0: Install and record the baseline

**Files:** none changed.

- [ ] **Step 1: Install** (needs `cdn.sheetjs.com` allowed)

Run: `cd /home/user/afus-hanout && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --no-audit --no-fund`
Expected: `added NNN packages`, exit 0.

- [ ] **Step 2: Baseline checks**

Run: `npm run lint && npm test && npx vite build`
Expected: lint exit 0; vitest `Test Files 99 passed`; vite `built in`. Record the numbers in the phase report. If anything fails here, stop and report it: it is a Boutique problem, to be written in `docs/boutique-notes.md`, not fixed silently.

---

### Task 1 (core): the demo database file name comes from the brand

**Files:**
- Create: `tests/demoFileName.test.js`
- Modify: `electron/database/init.js:6` and `:19`

- [ ] **Step 1: Write the failing test**

```js
// tests/demoFileName.test.js
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// A product with another file prefix: the demo shop's file must follow it
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afus-demo-name-'));
const electronPath = require.resolve('electron');
require.cache[electronPath] = { id: electronPath, filename: electronPath, loaded: true, exports: { app: { getPath: () => dir } } };
const brandPath = require.resolve('../electron/brand');
const FAKE = { fileSlug: 'afus-test', databaseFile: 'afus-test.db', dataDirName: 'AfusTest' };
require.cache[brandPath] = {
    id: brandPath, filename: brandPath, loaded: true,
    exports: { BRAND: FAKE, databasePath: (p) => path.join(p, FAKE.databaseFile), dataDirectory: (p) => path.join(p, FAKE.dataDirName) },
};
const init = require('../electron/database/init');

describe('demo shop file name', () => {
    it('uses the product file prefix (brand.json fileSlug)', () => {
        init.setProfile('demo');
        expect(init.getDbPath()).toBe(path.join(dir, 'demo', 'afus-test-demo.db'));
        init.setProfile('real');
        expect(init.getDbPath()).toBe(path.join(dir, 'afus-test.db'));
    });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/demoFileName.test.js`
Expected: FAIL, received `…/demo/afus-boutique-demo.db`.

- [ ] **Step 3: Minimal fix** in `electron/database/init.js`

```js
// line 6
const { databasePath, BRAND } = require('../brand');
// line 19
const DEMO_FILE = `${BRAND.fileSlug}-demo.db`;
```

- [ ] **Step 4: Run it and the demo tests**

Run: `npx vitest run tests/demoFileName.test.js tests/demo.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/demoFileName.test.js electron/database/init.js
git commit -m "core: name the demo shop database after the product (brand.json fileSlug)"
```

### Task 2 (core): tests read the product names from brand.json

**Files:** Modify `tests/brand.test.js:43-46`, `tests/backup.test.js:48-49`, `tests/demo.test.js:24,52,229`, `tests/documents.test.js:115-116`.

- [ ] **Step 1: Edit the four tests**

`tests/brand.test.js`, test "keeps the data in its own folder and database file":
```js
    it('keeps the data in its own folder and database file', () => {
        expect(dataDirectory('/appdata')).toBe(path.join('/appdata', BRAND.dataDirName));
        expect(databasePath(path.join('/appdata', BRAND.dataDirName))).toBe(path.join('/appdata', BRAND.dataDirName, BRAND.databaseFile));
    });
```
`tests/backup.test.js` (add `const BRAND = require('../electron/shared/brand.json');` under the other requires):
```js
        expect(backup.isBackupName(`../${BRAND.databaseFile}`)).toBe(false);
        expect(backup.isBackupName(`${BRAND.fileSlug}-2026-10-01_09-00-00.db`)).toBe(true);
```
`tests/demo.test.js` (add `const BRAND = require('../electron/shared/brand.json');` after line 8):
```js
const REAL_FILE = path.join(dir, BRAND.databaseFile);
// line 52
        expect(init.getDbPath()).toBe(path.join(dir, 'demo', `${BRAND.fileSlug}-demo.db`));
// line 229
        expect(fs.existsSync(path.join(dir, 'demo', `${BRAND.fileSlug}-demo.db`))).toBe(true);
```
`tests/documents.test.js` (add `const BRAND = require('../electron/shared/brand.json');` after line 6):
```js
    it('prints the small product name line unless it is turned off', () => {
        expect(receiptService.generateThermalReceiptHtml(SALE, { ...SHOP })).toContain(`class="brand">${BRAND.productName}<`);
```

- [ ] **Step 2: Run them**

Run: `npx vitest run tests/brand.test.js tests/backup.test.js tests/demo.test.js tests/documents.test.js`
Expected: PASS (same values as before, now read from the brand).

- [ ] **Step 3: Commit**

```bash
git add tests/brand.test.js tests/backup.test.js tests/demo.test.js tests/documents.test.js
git commit -m "core: tests read the product names from brand.json"
```

### Task 3: the Afus Hanout identity

**Files:**
- Create: `tests/hanoutIdentity.test.ts`
- Modify: `electron/shared/brand.json`, `package.json` (fields below), `package-lock.json` (root `name`/`version`), `tests/brand.test.js:13` (after Q1 approval), comments in `electron/brand.js:1-13` and `src/config/brand.js:1-2`

- [ ] **Step 1: Write the failing test** (TypeScript works in vitest without extra setup; `tsc` comes in Task 5)

```ts
// tests/hanoutIdentity.test.ts
import { describe, it, expect } from 'vitest';
import BRAND from '../electron/shared/brand.json';
import pkg from '../package.json';

describe('Afus Hanout identity (docs/NAMING.md)', () => {
    it('brand.json names Afus Hanout', () => {
        expect(BRAND).toEqual({
            companyName: 'Afus',
            productName: 'Afus Hanout',
            shortName: 'Afus',
            appId: 'dz.afus.hanout',
            packageName: 'afus-hanout',
            executableName: 'AfusHanout',
            dataDirName: 'AfusHanout',
            databaseFile: 'afus-hanout.db',
            fileSlug: 'afus-hanout',
        });
    });

    it('macOS files carry the Hanout name', () => {
        expect(pkg.build.mac.artifactName).toBe('Afus-Hanout-${version}-${arch}-mac.${ext}');
        expect(pkg.build.dmg.artifactName).toBe('Afus-Hanout-${version}-${arch}.${ext}');
    });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/hanoutIdentity.test.ts`
Expected: FAIL, `productName: 'Afus Boutique'`.

- [ ] **Step 3: Change the identity**

`electron/shared/brand.json`:
```json
{
  "companyName": "Afus",
  "productName": "Afus Hanout",
  "shortName": "Afus",
  "appId": "dz.afus.hanout",
  "packageName": "afus-hanout",
  "executableName": "AfusHanout",
  "dataDirName": "AfusHanout",
  "databaseFile": "afus-hanout.db",
  "fileSlug": "afus-hanout"
}
```
`package.json`:
```json
  "name": "afus-hanout",
  "productName": "Afus Hanout",
  "version": "0.1.0",
  "description": "Afus Hanout - offline sales and stock management for Algerian grocery shops (Windows and macOS desktop, Electron)",
  "keywords": ["pos", "point-of-sale", "electron", "retail", "grocery"],
  ...
  "build": {
    "appId": "dz.afus.hanout",
    "productName": "Afus Hanout",
    "executableName": "AfusHanout",
    "nsis": { ... "shortcutName": "Afus Hanout", ... },
    "mac": { ... "artifactName": "Afus-Hanout-${version}-${arch}-mac.${ext}", ... },
    "dmg": { "artifactName": "Afus-Hanout-${version}-${arch}.${ext}" }
  }
```
(`"version": "0.1.0"` only if Q2 is approved; otherwise keep `1.5.0`.) In `package-lock.json` set the top-level `"name"`/`"version"` and `packages[""].name`/`.version` to the same values.

`tests/brand.test.js:13` (after Q1 approval):
```js
const OLD_NAMES = /storepos|store-pos|store_pos|com\.storepos|cirvex|storeclothes/i;
```
`electron/brand.js` header comment: `Product identity, read by the main process.` and `/** Folder of the shop's data: %APPDATA%\<dataDirName> (macOS: ~/Library/Application Support/<dataDirName>). */`. `src/config/brand.js` first line: `// Product identity for the interface.`

- [ ] **Step 4: Run the identity tests**

Run: `npx vitest run tests/hanoutIdentity.test.ts tests/brand.test.js tests/demo.test.js tests/backup.test.js tests/documents.test.js tests/demoFileName.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/shared/brand.json package.json package-lock.json tests/hanoutIdentity.test.ts tests/brand.test.js electron/brand.js src/config/brand.js
git commit -m "Afus Hanout identity: dz.afus.hanout, AfusHanout data folder, afus-hanout.db"
```

### Task 4: installer workflow and the naming table

**Files:** Modify `.github/workflows/build-windows-installer.yml`, `docs/NAMING.md:21-27`.

- [ ] **Step 1: Workflow** — remove the `push:` trigger on the old branch `claude/keen-wright-cushvb` (keep `workflow_dispatch`), and name the artifact from `package.json`:

```yaml
      - name: Read the version
        id: version
        shell: bash
        run: echo "version=$(node -p "require('./package.json').version")" >> "$GITHUB_OUTPUT"

      - name: Upload installer
        uses: actions/upload-artifact@v4
        with:
          name: Afus-Hanout-Setup-${{ steps.version.outputs.version }}-win
          path: release/Afus Hanout Setup *.exe
          if-no-files-found: error
          retention-days: 90
```

- [ ] **Step 2: NAMING.md** — add the row after Afus Boutique in "Planned products":

```markdown
| Afus Hanout | afus-hanout | dz.afus.hanout | AfusHanout.exe | AfusHanout | afus-hanout.db |
```

- [ ] **Step 3: Check** `npx vitest run tests/brand.test.js` → PASS (the docs scan no longer refuses "hanout").

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/build-windows-installer.yml docs/NAMING.md
git commit -m "Hanout installer artifact named from package.json; Afus Hanout in the naming table"
```

### Task 5: TypeScript for new files

**Files:** Create `tsconfig.json`; modify `.eslintrc.json`, `package.json` (scripts, devDependencies), `package-lock.json`, `.github/workflows/ci.yml`.

- [ ] **Step 1: Install the tools**

Run: `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install --save-dev typescript@^5.9 @typescript-eslint/parser@^8 @typescript-eslint/eslint-plugin@^8 @types/node@^22`
Expected: `package.json` and `package-lock.json` updated, exit 0.

- [ ] **Step 2: `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "allowJs": true,
    "checkJs": false,
    "noEmit": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src", "tests"],
  "exclude": ["node_modules", "dist", "release", "site", "demo-web"]
}
```
`allowJs` lets `.ts` files import existing `.js` modules; `checkJs: false` keeps the old files unchecked, so `strict` applies to `.ts`/`.tsx` only.

- [ ] **Step 3: Lint `.ts`/`.tsx`** — add to `.eslintrc.json`:

```json
    "overrides": [
        {
            "files": ["*.ts", "*.tsx"],
            "parser": "@typescript-eslint/parser",
            "plugins": ["@typescript-eslint"],
            "extends": ["plugin:@typescript-eslint/recommended"],
            "rules": {
                "no-unused-vars": "off",
                "@typescript-eslint/no-unused-vars": ["warn", { "ignoreRestSiblings": true, "argsIgnorePattern": "^_" }]
            }
        }
    ]
```
and in `package.json` scripts:
```json
    "lint": "cross-env ESLINT_USE_FLAT_CONFIG=false eslint src electron tests --ext .js,.jsx,.ts,.tsx --max-warnings 0",
    "typecheck": "tsc --noEmit -p tsconfig.json",
```

- [ ] **Step 4: Check that a type error is caught** — temporarily add `const n: number = 'x';` at the end of `tests/hanoutIdentity.test.ts`.

Run: `npm run typecheck`
Expected: FAIL, `Type 'string' is not assignable to type 'number'`. Remove the line; run again → exit 0.

- [ ] **Step 5: CI** — in `.github/workflows/ci.yml`, job `lint`, after `Lint`:

```yaml
      - name: Type check
        run: npm run typecheck
```

- [ ] **Step 6: Run** `npm run lint && npm run typecheck && npm test` → all pass.

- [ ] **Step 7: Commit**

```bash
git add tsconfig.json .eslintrc.json package.json package-lock.json .github/workflows/ci.yml
git commit -m "TypeScript for new files only: strict tsconfig, lint and type check for .ts/.tsx"
```

### Task 6: the Afus look, written and guarded

**Files:** Create `afus-design.json`, `tests/design.test.ts`, `docs/AFUS-DESIGN.md`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/design.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');
const design = JSON.parse(read('afus-design.json')) as {
    fonts: { packages: string[]; sans: string[]; arabic: string[] };
    theme: { default: 'dark'; dark: Record<string, string>; light: Record<string, string> };
    accent: Record<string, string>;
    animation: Record<string, string>;
    utilities: string[];
    components: { ui: string[]; layout: string[] };
    icons: string;
};
const css = read('src/index.css');
const tailwind = read('tailwind.config.js');

/** Custom properties declared in the CSS block that opens with `selector {`. */
function cssVariables(selector: string): Record<string, string> {
    const start = css.indexOf(`${selector} {`);
    if (start < 0) throw new Error(`${selector} not found in src/index.css`);
    const body = css.slice(start, css.indexOf('}', start));
    return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
}

/** The text between `key: <open>` and its closing bracket in tailwind.config.js. */
function block(key: string, open: '[' | '{'): string {
    const close = open === '[' ? ']' : '}';
    const at = tailwind.search(new RegExp(`${key}:\\s*\\${open}`));
    if (at < 0) throw new Error(`${key} not found in tailwind.config.js`);
    return tailwind.slice(at, tailwind.indexOf(close, at));
}

describe('Afus look (docs/AFUS-DESIGN.md)', () => {
    it('fonts: Inter and Cairo, bundled', () => {
        for (const pkg of design.fonts.packages) expect(css).toContain(`@import '${pkg}';`);
        expect([...block('sans', '[').matchAll(/'([^']*)'/g)].map(m => m[1])).toEqual(design.fonts.sans);
        expect([...block('arabic', '[').matchAll(/'([^']*)'/g)].map(m => m[1])).toEqual(design.fonts.arabic);
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/design.test.ts`
Expected: FAIL, `ENOENT … afus-design.json`.

- [ ] **Step 3: `afus-design.json`** (values copied from `src/index.css` and `tailwind.config.js` as they are today)

```json
{
  "fonts": {
    "packages": ["@fontsource-variable/inter", "@fontsource-variable/cairo"],
    "sans": ["\"Inter Variable\"", "\"Cairo Variable\"", "system-ui", "-apple-system", "\"Segoe UI\"", "sans-serif"],
    "arabic": ["\"Cairo Variable\"", "\"Inter Variable\"", "system-ui", "sans-serif"]
  },
  "theme": {
    "default": "dark",
    "dark": {
      "surface-0": "11 11 13", "surface-1": "19 19 22", "surface-2": "28 28 33", "surface-border": "38 38 44",
      "fg": "244 244 245", "scrollbar": "42 42 49",
      "zinc-50": "250 250 250", "zinc-100": "244 244 245", "zinc-200": "228 228 231", "zinc-300": "212 212 216",
      "zinc-400": "161 161 170", "zinc-500": "113 113 122", "zinc-600": "82 82 91", "zinc-700": "63 63 70",
      "zinc-800": "39 39 42", "zinc-900": "24 24 27", "zinc-950": "9 9 11",
      "accent-primary": "#6366f1", "accent-secondary": "#8b5cf6", "accent-success": "#22c55e",
      "accent-warning": "#f59e0b", "accent-danger": "#ef4444",
      "titlebar-height": "40px"
    },
    "light": {
      "surface-0": "243 244 247", "surface-1": "255 255 255", "surface-2": "236 237 241", "surface-border": "222 223 229",
      "fg": "24 24 27", "scrollbar": "205 206 213",
      "zinc-50": "9 9 11", "zinc-100": "24 24 27", "zinc-200": "39 39 42", "zinc-300": "63 63 70",
      "zinc-400": "82 82 91", "zinc-500": "113 113 122", "zinc-600": "161 161 170", "zinc-700": "212 212 216",
      "zinc-800": "228 228 231", "zinc-900": "244 244 245", "zinc-950": "250 250 250"
    }
  },
  "accent": { "primary": "#6366f1", "secondary": "#8b5cf6", "success": "#22c55e", "warning": "#f59e0b", "danger": "#ef4444" },
  "animation": {
    "fade-in": "fadeIn 0.2s ease-out",
    "slide-up": "slideUp 0.3s ease-out",
    "scale-in": "scaleIn 0.2s ease-out",
    "pulse-soft": "pulseSoft 2s infinite"
  },
  "utilities": ["tabular", "ltr", "flip-rtl"],
  "components": {
    "ui": ["Badge.jsx", "Button.jsx", "Card.jsx", "Combobox.jsx", "ConfirmDialog.jsx", "DatePicker.jsx", "ExcelImport.jsx", "ExportButton.jsx", "Input.jsx", "Menu.jsx", "Modal.jsx", "NumPad.jsx", "PageHeader.jsx", "Select.jsx", "StatTile.jsx", "Table.jsx", "Tabs.jsx", "Toast.jsx"],
    "layout": ["HelpButton.jsx", "HubPage.jsx", "MainLayout.jsx", "Sidebar.jsx", "TitleBar.jsx", "navItems.js"]
  },
  "icons": "lucide-react"
}
```

- [ ] **Step 4: Run it** `npx vitest run tests/design.test.ts` → PASS. If one value differs, the JSON was mistyped: correct the JSON from the CSS, never the CSS.

- [ ] **Step 5: Check it really guards** — change `--surface-0: 11 11 13;` to `12 11 13` in `src/index.css`, run the test → FAIL on `surface-0`; undo (`git checkout src/index.css`), run → PASS.

- [ ] **Step 6: `docs/AFUS-DESIGN.md`**

```markdown
# The Afus look

Every Afus program looks the same: same fonts, colours, components and rules. The values live in
`afus-design.json`; `tests/design.test.ts` fails when `src/index.css` or `tailwind.config.js` drift
from it. To change the look on purpose, change both and say why in the commit.

## Fonts
- Inter Variable for Latin text, Cairo Variable for Arabic (`html.lang-ar body`), bundled with
  `@fontsource-variable/*`: no internet needed, same look on Windows and macOS.

## Theme
- Dark by default; light under `html.theme-light`; or the system's choice.
- Colours are space-separated RGB CSS variables (`--surface-0` … `--zinc-950`), so Tailwind can add
  opacity. Light mode reverses the grey scale, so a screen never names a theme.
- Surfaces: `dark.primary` (app background), `dark.secondary` (sidebar, cards), `dark.tertiary`
  (inputs, hover), `dark.border`.

## Accent colours
`accent-primary #6366f1`, `accent-secondary #8b5cf6`, `accent-success #22c55e`,
`accent-warning #f59e0b`, `accent-danger #ef4444`.

## Components and icons
- `src/components/ui` (Button, Input, Select, Combobox, Modal, ConfirmDialog, Table, Tabs, Card,
  Badge, StatTile, NumPad, Toast, Menu, DatePicker, PageHeader, ExcelImport, ExportButton) and
  `src/components/layout` (MainLayout, Sidebar, TitleBar, HubPage, HelpButton, navItems).
- Shared classes in `src/index.css` (`@layer components`): `.btn*`, `.input*`, `.card`, `.badge*`,
  `.table*`, `.modal-*`, `.form-*`, `.stat-*`, `.page`, `.page-body`, `.segmented`, `.fit-grid*`.
- Icons: lucide-react only.
- Animations: `fade-in`, `slide-up`, `scale-in`, `pulse-soft`; none when the system asks for reduced motion.

## Arabic text
- `.tabular`: numbers line up in tables and totals.
- `.ltr`: codes, phone numbers and amounts stay left-to-right inside Arabic text.
- `.flip-rtl`: arrows and chevrons point in the reading direction.

## Menu groups
Sell, Stock, Grow, Manage (`src/components/layout/navItems.js`). Each program chooses its pages;
the groups and their order stay.

## Rules
- Arabic first, then French and English; the shop's own words.
- One button height, one-line tabs, no small scrollbars, amounts never leave their card.
- An error message says what to do next.
```

- [ ] **Step 7: Commit**

```bash
git add afus-design.json tests/design.test.ts docs/AFUS-DESIGN.md
git commit -m "Afus look written down (AFUS-DESIGN.md, afus-design.json) and guarded by tests/design.test.ts"
```

### Task 7: README, Boutique notes, phase prompt

**Files:** Modify `README.md:1-11`; create `docs/boutique-notes.md`, `docs/prompts/phase-0.md`.

- [ ] **Step 1: README title and first paragraph**

```markdown
# Afus Hanout

**Afus Hanout** is the [Afus](docs/NAMING.md) application for Algerian grocery shops (hanout,
superette, mini-market): an offline point of sale and stock manager for Windows and macOS
(Electron + React + SQLite). Every sale, stock movement and kridi is kept in a local database on
the shop's computer; it works without an account and without internet. There is **no website, no
online store and no online orders**.

> **بالعربية:** أفوس حانوت برنامج من شركة Afus لمحلات المواد الغذائية: الحانوت، والسوبيرات، والميني
> ماركت. بيع بالقطعة والكرطونة والوزن، مخزون، كريدي، موردون. يعمل بدون إنترنت وبدون حساب، وكل
> البيانات تبقى على حاسوب المحل. لا موقع إلكتروني، ولا متجر إلكتروني، ولا طلبات عبر الإنترنت.
```
The rest of the README stays for now (phase 1 removes the website sections).

- [ ] **Step 2: `docs/boutique-notes.md`**

```markdown
# Problems found in Afus Boutique

Found while building Afus Hanout. Not fixed in Boutique from here: each one is for Islam to decide.

| Date | Where | Problem | Fixed in Hanout? |
| --- | --- | --- | --- |
| 2026-11-03 | `SECURITY.md` | Says employee PINs are stored without hashing; they are hashed since migration `2026_10_hash_pins`. Supported versions say 1.1.x while the program is 1.5.0. | No (phase 1 rewrites SECURITY.md) |
| 2026-11-03 | `.github/workflows/build-windows-installer.yml` | Artifact name fixed at `Afus-Boutique-Setup-1.2.0-win`; push trigger on an old branch `claude/keen-wright-cushvb`. | Yes, phase 0 (artifact named from package.json) |
| 2026-11-03 | `electron/database/init.js:19` | Demo file name written by hand (`afus-boutique-demo.db`) instead of from `brand.json`. | Yes, `core:` commit, can be cherry-picked |
| 2026-11-03 | `package.json` | `xlsx` comes from `cdn.sheetjs.com/xlsx-latest` (not npm, version "latest"): installs depend on that host. | No |
```

- [ ] **Step 3: `docs/prompts/phase-0.md`** — the phase 0 prompt block from the study (section «البداية: المرحلة 0»), copied as it is.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/boutique-notes.md docs/prompts/phase-0.md
git commit -m "docs: README for grocery shops, Boutique notes, phase 0 prompt"
```

### Task 8: skills run by Islam

- [ ] **Step 1:** In a Claude Code session on afus-hanout, Islam types `/setup-matt-pocock-skills` (issue tracker: GitHub `Nourislam/afus-hanout`).
- [ ] **Step 2:** Then `/ubiquitous-language` for: كريدي، كارني، كرطونة، موزّع، يوم المرور، صرف، سنتيم، فاكتورة، فليكسي، قفة. Output: `UBIQUITOUS_LANGUAGE.md`.
- [ ] **Step 3:** Commit both outputs: `git commit -m "docs: agent skills setup and the shop's ubiquitous language"`.

### Task 9: verify, review, PR

- [ ] **Step 1:** `npm run lint && npm run typecheck && npm test && npx vite build` → all pass; note the test count (99 Boutique files + 3 new).
- [ ] **Step 2:** Run the `verification-before-completion` and `requesting-code-review` skills; apply `receiving-code-review` to the findings.
- [ ] **Step 3:** `pwd && git remote -v` (afus-hanout, `boutique` push `DISABLED`), then `git push -u origin phase-0-identity`.
- [ ] **Step 4:** Open the PR `phase-0-identity → main` in `Nourislam/afus-hanout`; merge once CI (lint, test, Windows build) is green.
- [ ] **Step 5:** Tick the phase 0 boxes in `docs/plans/afus-hanout-study.md`.

### Task 10: transition condition (Islam, on a real computer)

- [ ] **Step 1:** Get the Hanout installer: Actions › *Build Windows Installer* › *Run workflow* on `main`, then download `Afus-Hanout-Setup-<version>-win`. On the Mac: `npm ci && npm run electron:build:mac`.
- [ ] **Step 2:** Install Hanout on a computer where Boutique is installed. Open both.
- [ ] **Step 3:** Check two folders exist side by side, each with its own database:
  Windows `%APPDATA%\AfusBoutique\afus-boutique.db` and `%APPDATA%\AfusHanout\afus-hanout.db`;
  macOS `~/Library/Application Support/AfusBoutique` and `~/Library/Application Support/AfusHanout`.
- [ ] **Step 4:** Make one sale in Hanout; Boutique's sales history is unchanged.

---

## Self-review

- **Study coverage (phase 0 list):** clone and push ✓ (done before the plan); identity per NAMING.md ✓ Tasks 1–3; Hanout row in NAMING.md ✓ Task 4 (Hanout repository only, as the order says); TypeScript for new files ✓ Task 5; AFUS-DESIGN.md + design test ✓ Task 6; README ✓ Task 7; study copied to `docs/plans/` ✓ (done); `setup-matt-pocock-skills` and `ubiquitous-language` ✓ Task 8; transition condition ✓ Task 10. Logo: `public/icon.svg` kept (study item 3).
- **Not in phase 0:** removing the website, online store, shops link and clothing features (phase 1); TypeScript in the main process (Q3).
- **Blocked:** Task 0 and every `npm` step until `cdn.sheetjs.com` is allowed.
