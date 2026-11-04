# المرحلة 1: التنظيف وأساس المواد الغذائية

## الملخّص

**الهدف:** يصبح البرنامج برنامج حانوت: بلا موقع، ولا متجر إلكتروني، ولا ربط محلات، ولا بريد إلكتروني، ولا شاشات ملابس. ويعرف السلعة التي تُباع بالكرطونة أو بالوزن، والسعر المسقّف، ورقم الميزان (PLU)، ونافذة السلعة بثلاث خانات، ومحل تجريبي فيه مواد غذائية.

**قرارات إسلام (4 نوفمبر 2026):** حذف البريد الإلكتروني؛ لا قراءة صور ولا إنترنت؛ خادم WiFi المحل بالاقتران بـ QR (المرحلة 6)؛ دمج كل مرحلة بعد الفحص المحلي ما دام GitHub Actions لا يعمل؛ كل المراحل دون توقف بينها.

**قرارات أخذتها بالمقترح (يمكن تغييرها):**
- **الوزن:** سلعة الوزن مخزونها بالغرام (عدد صحيح) وسعرها للكيلوغرام. سطر البيع بالوزن = كمية 1، ومعه `weight_grams`، وسعر السطر = سعر الكيلو × الوزن ÷ 1000. هكذا لا يتغيّر حساب المجاميع ولا الإرجاع في المحرك المشترك.
- **الكرطونة:** للسلعة «عدد القطع في الكرطونة» وباركود الكرطونة وسعرها الاختياري. مسح باركود الكرطونة يضيف سطراً بعدد قطعها، وإن كان لها سعر خاص يُحسب الفرق تخفيضاً على السطر.
- **الألوان والمقاسات:** تُحذف شاشاتها (الألوان والمقاسات، المصفوفة، تقرير الموسم)، ويبقى المحرك مخفياً لأنه في قلب البيع والإرجاع والجرد.
- **جداول الموقع في الهجرات القديمة:** تبقى فارغة؛ لا تُعدَّل هجرة قديمة.
- **TypeScript في عملية Electron الرئيسية:** يُحمَّل الملف `.ts` مباشرة بفضل «نزع الأنواع» المدمج في Node 22.21 داخل Electron 39، دون خطوة بناء. جرّبته: `require('./x.ts')` يعمل، حتى لوحدة ESM. الشرطان: صياغة قابلة للمحو فقط (`erasableSyntaxOnly`)، وكتابة الامتداد `.ts` في كل `require`. المنطق المشترك بين النافذة والعملية الرئيسية في `electron/shared/*.ts`. يبقى التأكد منه في البرنامج المثبّت (asar) عند تجربة إسلام.

**شرط الانتقال:** كل الاختبارات ناجحة، ولا «Boutique» ولا «الموقع» في الواجهة، وبيع كامل بالقطعة والكرطونة في المحل التجريبي.

---

# Phase 1 plan (English)

**Goal:** a grocery program: website, online store, shops link, e-mail and clothing screens removed; units, carton, weight, PLU and capped price in the database; a three-field article form; a grocery demo shop.

### Task 1: remove the website, online store and shops link
Delete (counted from the code, `docs/plans/00-understanding.md` §5): `electron/website/`, `electron/ecommerce/`, `electron/shops/`, `src/components/website/`, `site/`, `demo-web/`, `src/pages/WebsitePage.jsx`, `electron/ipc/website.js`, `electron/ipc/shops.js`, `electron/database/ecommerce_schema.sql` (and its loading in `init.js`), `EcommerceSettings.jsx`, `ShopsSettings.jsx`, i18n `website.js`/`ecommerce.js`/`shops.js`, `scripts/website-apps-check.mjs`, `scripts/cloudflare-oauth-scopes.mjs`, website docs, the 28 website/store/shops tests (the communes list test moves to `tests/communes.test.js`), npm scripts `check:website-apps`/`build:demo`/`build:site`, packages `node-fetch`, `@fontsource-variable/alexandria`, `@fontsource/ibm-plex-sans-arabic`, the GitHub/Cloudflare keys of `electron/shared/profile.json`. Then fix every reference (main, preload, ipcGuard, App, Settings, Products, product form, features, nav, permissions, i18n). Check: every `require`/`import` resolves (script), lint, vite build, tests.

### Task 2: remove e-mail
Delete `emailService.js`, `emailTemplates.js`, `electron/ipc/email.js`, `nodemailer`, tests `emailQuotation`/`emailTemplates`; remove the e-mail paths of credit invoices, gift cards and receipts (WhatsApp and print stay).

### Task 3: independence test for Hanout
Network allowed only in `electron/services/updateService.js` (on demand); no server at all until phase 6; no address built in except `wa.me`.

### Task 4: clothing screens
Delete `ColorsSizesPage.jsx`, `ProductMatrixModal.jsx`, `SeasonReport.jsx`, `src/lib/clothing.js` (if nothing else needs it), demo photos, `seasonMarkdown.test.js`; colours and sizes off for new articles. Keep `electron/shared/clothing.json` (migration `2025_03` needs it).

### Task 5 (TDD): grocery migration `2026_11_hanout_grocery`
Products: `unit` ('piece' | 'kg'), `carton_qty`, `carton_barcode` (unique when set), `carton_price`, `plu` (unique when set), `capped_price`. Sale lines: `weight_grams`, `carton` flag. New tables: `product_barcodes`, `product_suppliers`, `supplier_item_names`, `product_batches`, `supplier_visits`. Test on a fresh database and on an upgraded one.

### Task 6 (TDD): carton and weight in the catalogue and the sale
`lookupCode` finds a carton barcode (→ carton line) and a scale PLU later (phase 2). Weight helpers in `src/lib/weight.ts`: price of a weighed line, grams ↔ kg display. Sale of a carton moves `carton_qty` pieces; sale by weight moves `weight_grams`; capped price refused above the cap.

### Task 7: three-field article form
Name, barcode, price on the first screen; the rest (category, cost, stock, carton, weight, PLU, capped price, supplier, picture) under «المزيد».

### Task 8: grocery demo shop and wording
`demoData.js` becomes a grocery shop (milk, bread, oil, sugar, semolina, coffee, sodas, cheese, vegetables by weight); no clothing pictures. Interface texts: no «Boutique», no «الموقع»; clothing words replaced by shop words.

### Task 9: verify, review, merge
lint, tsc, tests, build, review, PR, merge after local checks; tick phase 1 in the study.

## Result (2026-11-04)

Done on branch `phase-1-cleanup`:

- Website, online store, shops link, e-mail and the clothing screens removed (Task 1-4). IPC handlers that still took removed names from the context are fixed; `tests/ipcContext.test.ts` fails on any name `main.js` no longer passes.
- Migration `2026_11_hanout_grocery` (Task 5), then `2026_11_hanout_no_clothing_brands`: the clothing brands of the old 2025_03 seed are removed unless an article names one.
- Weight, carton and official price in the catalogue, the sale and the returns (Task 6). Stock value of an article sold by weight is grams / 1000 × price everywhere (home screen, stock list, decisions, Excel).
- Three-field article form (Task 7). The screens show kg stock and price per kg (`src/lib/units.ts`).
- Grocery demo shop (Task 8): today's open drawer is the owner's, so the owner sells at once. A new shop gets grocery categories (`electron/shared/groceryCatalog.json`).
- Excel: the stock file has pieces and kg columns and a PLU column; a counted file sent back reads kg; the product import takes one row per article with a «sold by» column.
- Wording: tests refuse «boutique» (any case), «الموقع» and clothes (garments, an article's colour/size) in every interface and document text. French says «magasin».

Checks: `npm run lint`, `npm run typecheck`, `npx vitest run` (81 files, 493 tests; the 3 Excel files run here with `xlsx@0.18.5` from npm in the scratch install only, `package.json` unchanged). Screens checked in the real Electron app (demo shop) in Arabic and French at 1024, 1366 and 1920: article form, sales screen with a piece, a carton and a weighed article, payment and ticket. A full sale by piece, carton and weight moves the stock by 1 piece, 4 pieces and 500 g.

Left for later phases (seen while checking):

- Phase 2: the ticket area is small at 1024 px; Enter in the payment window does not pay the exact amount; the ticket and the subtotal count a weight line as one piece and the printed ticket does not show the weight.
- Phase 4: reorder suggestions use the quantity of weighed lines; the stock count screen types grams for an article sold by weight (the counted Excel file already reads kg).
- The variant code (colour/size) stays in the program, unreachable from the article form and the import; its texts say «variant» (النوع).
