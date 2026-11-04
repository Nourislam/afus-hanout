# Prompt: Afus Hanout, phase 0 (repository and identity)

From the study (`docs/plans/afus-hanout-study.md`, «البداية: المرحلة 0»). The plan that carried it out is
`docs/plans/phase-0.md`.

```text
Afus Hanout is a new Afus product for Algerian grocery shops (حوانيت، سوبيرات).
This repo is a full copy of Afus Boutique with its history; the remote `boutique`
is the original and must never be pushed to. Arabic first; the program thinks like
the shop worker, and ease of use comes before every feature. Afus Hanout has NO
website, NO online store and NO online orders. Build PHASE 0 ONLY: identity and
tooling, no new feature, and do NOT remove anything yet (that is phase 1).

1. Follow docs/NAMING.md "Starting a new product": brand.json = Afus Hanout /
   afus-hanout / dz.afus.hanout / AfusHanout (executable and data folder) /
   afus-hanout.db / afus-hanout; same fields in package.json; artifact names in
   .github/workflows/*.yml. Keep tests/brand.test.js green.
2. Add the Afus Hanout row to the planned products table in docs/NAMING.md.
3. Keep public/icon.svg for now (I will give the Hanout logo later).
4. TypeScript for NEW files only: tsconfig.json (allowJs, jsx react-jsx, strict for
   .ts/.tsx), typescript + @typescript-eslint, the lint script and vitest also cover
   .ts/.tsx. Do not convert existing .js/.jsx files.
5. docs/AFUS-DESIGN.md: write down the shared Afus look exactly as it is today
   (Cairo/Inter fonts, the CSS variables of src/index.css, accent colours,
   src/components/ui, animations, .ltr/.tabular/.flip-rtl, menu groups, the rules).
   Also afus-design.json with the tokens, and tests/design.test.js that fails if
   tailwind.config.js or src/index.css drift from it.
6. README: title and first paragraph for grocery shops (Arabic + English), and say
   there is no website or online store; keep the rest for now.
7. npm ci, npm run lint, npm test. Small commits, push to origin only.
At the end, list every file and test that belongs to the website, the online
store (Shopify/WooCommerce), the Cloudflare shops link and the clothing features,
so phase 1 can remove them.
```
