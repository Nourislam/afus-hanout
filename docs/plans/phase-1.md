# المرحلة 1: التنظيف وأساس المواد الغذائية

## الملخّص

**الهدف:** يصبح البرنامج برنامج حانوت: بلا موقع، ولا متجر إلكتروني، ولا ربط محلات، ولا بريد إلكتروني، ولا شاشات ملابس. ويعرف السلعة التي تُباع بالكرطونة أو بالوزن، والسعر المسقّف، ورقم الميزان (PLU)، ونافذة السلعة بثلاث خانات، ومحل تجريبي فيه مواد غذائية.

**قرارات إسلام (4 نوفمبر 2026):** حذف البريد الإلكتروني؛ لا قراءة صور ولا إنترنت؛ خادم WiFi المحل بالاقتران بـ QR (المرحلة 6)؛ دمج كل مرحلة بعد الفحص المحلي ما دام GitHub Actions لا يعمل؛ كل المراحل دون توقف بينها.

**قرارات أخذتها بالمقترح (يمكن تغييرها):**
- **الوزن:** سلعة الوزن مخزونها بالغرام (عدد صحيح) وسعرها للكيلوغرام. سطر البيع بالوزن = كمية 1، ومعه `weight_grams`، وسعر السطر = سعر الكيلو × الوزن ÷ 1000. هكذا لا يتغيّر حساب المجاميع ولا الإرجاع في المحرك المشترك.
- **الكرطونة:** للسلعة «عدد القطع في الكرطونة» وباركود الكرطونة وسعرها الاختياري. مسح باركود الكرطونة يضيف سطراً بعدد قطعها، وإن كان لها سعر خاص يُحسب الفرق تخفيضاً على السطر.
- **الألوان والمقاسات:** تُحذف شاشاتها (الألوان والمقاسات، المصفوفة، تقرير الموسم)، ويبقى المحرك مخفياً لأنه في قلب البيع والإرجاع والجرد.
- **جداول الموقع في الهجرات القديمة:** تبقى فارغة؛ لا تُعدَّل هجرة قديمة.

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
