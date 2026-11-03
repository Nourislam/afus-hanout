# أفوس حانوت: تقرير الفهم (المرحلة 0)

3 نوفمبر 2026 · كُتب بعد قراءة الدراسة (`docs/plans/afus-hanout-study.md`) وكود Afus Boutique، ووافق عليه إسلام نوري.

## القرارات بعد الدراسة

| التاريخ | القرار | أثره |
| --- | --- | --- |
| 2026-11-03 | **لا Supabase.** قاعدة البيانات محلية فقط (sql.js على حاسوب المحل)، والبرنامج يعمل بلا إنترنت. | لا مجلد `cloud/`، ولا مهارات Supabase. قراءة الصور و«اسأل حانوتك» (المرحلة 5) تنتظر قراراً جديداً (السؤال 3 أدناه). |
| 2026-11-03 | **المستودع:** `main` في afus-hanout = تاريخ Boutique كاملاً (167 commit حتى `d0d5e51`، الإصدار 1.5.0)، مع الـ commit الأول للمستودع (`c0c06d1`) أباً ثانياً، دون دفع بالقوة. ملفات `main` مطابقة لـ `boutique/main`. | `git cherry-pick` و`git diff boutique/main` يعملان. |
| 2026-11-03 | **remote `boutique`** عنوان الدفع فيه `DISABLED`. في جلسات Claude السحابية فقط، يُقرأ Boutique باسمه القديم `storeClothes` عبر `url.insteadOf` محلي (لا يُحفظ في المستودع). | لا شيء يُدفع إلى Boutique. |

## 1. ما الموجود عندي

**Afus Boutique 1.5.0**، آخر commit `d0d5e51` «1.5.0 (#41)» بتاريخ 26 أكتوبر 2026.

- التقنية: Electron 39، React 18، Vite 7، Tailwind 3، sql.js، zustand، vitest 4. لا TypeScript.
- الحجم: 99 ملف اختبار (652 اختباراً)، و29 هجرة مرقّمة في `electron/database/migrations.js`، و`main.js` مقسّم على 20 ملفاً في `electron/ipc/`.
- المال: `REAL` مع تقريب لرقمين (`round2`)، فـ 7.50 دج تعمل اليوم.

| ما يُعاد استعماله | الملفات |
| --- | --- |
| البيع والصندوق | `src/pages/POSPage.jsx` (أزرار سريعة لأكثر السلع مبيعاً في الأسبوع)، `src/components/pos/PaymentModal.jsx` (نقد، بطاقة CIB، تحويل، دفع مجزأ)، `shiftService.js`، `receiptService.js` |
| الكريدي وواتساب | `creditSaleService.js`، `src/pages/CreditSalesPage.jsx`، `src/lib/whatsapp.js` |
| الماسح والباركود | `src/lib/scanner.js` (يقرأ صحيحاً مع لوحة عربية أو AZERTY)، `src/lib/barcodes.js` (رقم التحقق GS1) |
| الملصقات | `electron/services/labelService.js` |
| الموردون | `purchaseImport.js` (ملف Excel للمورد: بالرمز ثم بالاسم، والباقي برقم سطره)، أوامر الشراء، الاستلام، دفعات الموردين |
| الطلبية | `electron/services/reorderService.js` (تغطية 30 يوماً) |
| المواسم | `electron/services/shopRhythm.js`: رمضان والعيدان والمولد بالتقويم الهجري، ويناير، والدخول المدرسي، وتواريخ المحل (`shop_events`) |
| القفة | `bundles` و`bundle_items` |
| سعر الجملة | `products.wholesale_price` و`customers.is_wholesale` (موجودان) |
| العمال | PIN مشفّر (`pinService.js`)، الأدوار في `electron/shared/permissions.mjs`، الحراسة في `ipcGuard.js` |
| البيانات | `runTransaction` في `electron/database/init.js`، ونسخة قبل كل ترقية، و`backupService.js` (نسخ إلى USB) |
| الهوية | `electron/shared/brand.json` ← `electron/brand.js` و`src/config/brand.js`، يفحصها `tests/brand.test.js` |
| اللمسة | متغيرات `src/index.css`، ألوان `tailwind.config.js`، Cairo وInter، `src/components/ui` |
| أخرى | `uiMode.js`، معالج الإعداد، المحل التجريبي، الرخصة بلا إنترنت، فحص التحديث عند الطلب، `communes.json` (58 ولاية، 1541 بلدية) |

## 2. ما سنبني

1. أفوس حانوت: صندوق ومخزون للحوانيت والسوبيرات والميني ماركت في الجزائر.
2. سهل جداً، ثم يساعد، ثم ذكي. لا شيء يبطئ البيع.
3. نسخة من Boutique بتاريخه، بلا موقع ولا متجر إلكتروني ولا ربط Cloudflare ولا ميزات الملابس.
4. البيع بالقطعة والكرطونة والوزن، مع أزرار بالصور، وباركود الميزان، والسنتيم، والصرف.
5. الكريدي على طريقة الكارني، والكشف بواتساب يرسله صاحب المحل بنفسه.
6. الموردون والموزّع ويوم مروره، والطلبية المقترحة، والصلاحية، والأسعار المسقّفة.
7. كل البيانات على حاسوب المحل، والبرنامج يعمل بلا إنترنت. لا Supabase.
8. هاتف (Expo) وقارئ أسعار يأخذان من حاسوب الصندوق على WiFi المحل.
9. المواسم بالتقويم الهجري، وملخص الغلق، وبطاقات ذكية (3 في اليوم على الأكثر)، وزكاة تقديرية.
10. هوية منفصلة (`dz.afus.hanout`)، فيُثبّت بجانب Boutique دون أن يلمس بياناته.

## 3. أين

- GitHub: `Nourislam/afus-hanout`، خاص.
- على الماك: مجلد `afus-hanout` بجانب مجلد Boutique، لا داخله.
- remotes: `origin` = afus-hanout، `boutique` = afus-boutique بدفع `DISABLED`.

```
afus-hanout/
├── electron/ src/ tests/ public/ scripts/   برنامج الحاسوب (من Boutique)
├── mobile/        تطبيق Expo، TypeScript، RTL      (المرحلة 6)
├── docs/plans/    afus-hanout-study.md · 00-understanding.md · phase-N.md
├── docs/prompts/  أمر لكل مرحلة
├── docs/AFUS-DESIGN.md · afus-design.json · docs/boutique-notes.md
└── UBIQUITOUS_LANGUAGE.md
```

## 4. كيف

| المرحلة | المحتوى | شرط الانتقال |
| --- | --- | --- |
| 0 | المستودع، الهوية، TypeScript للجديد، `AFUS-DESIGN.md` و`design.test.js` | البرنامجان على حاسوب واحد، والاختبارات ناجحة |
| 1 | التنظيف، هجرة الوحدات والكرطونة والوزن وPLU والسعر المسقّف، نافذة سلعة بثلاث خانات، محل تجريبي غذائي | لا «Boutique» ولا «الموقع» في الواجهة، وبيع كامل |
| 2 | شاشة البيع السهلة | اختبار العمّ، ويوم في محل حقيقي |
| 3 | الكريدي الجزائري | اختبار العمّ |
| 4 | الموردون والموزعون والطلبية | أسبوعان في محل حقيقي |
| 5 | الفاتورة والكارني بالتصوير، «اسأل حانوتك» (بلا Supabase، الطريقة لم تُحسم) | فاتورة من 10 أسطر في أقل من دقيقتين |
| 6 | الخادم المحلي، Expo، قارئ الأسعار | يعملان والإنترنت مقطوع |
| 7 | الميزان | تغيير السعر يصل إلى الملصق |
| 8 | المواسم والملخصات والزكاة | تاجر يقول إنها ساعدته |
| 9 | الإطلاق | قرار إسلام |

في كل مرحلة: خطة بـ `writing-plans` في `docs/plans/phase-N.md` وموافقة ← فرع `phase-N-<name>` ← اختبار أولاً وcommits صغيرة، والإصلاح المشترك وحده بـ `core:` ← فحص الشاشات بـ `webapp-testing` (ar وfr، 1024 و1366 و1920) والقواعد العشر ← lint وtest والبناء و`independence` و`brand` و`design` ← `verification-before-completion` ومراجعة الكود ← PR ودمج بعد CI ← تعليم المهام في الدراسة ← تقرير بالعربية، ثم توقّف.

## 5. قائمة الحذف (محسوبة من الكود، تُنفَّذ في المرحلة 1)

**أ. مجلدات كاملة: 179 ملفاً**

| المجلد | ملفات | أسطر كود |
| --- | --- | --- |
| `electron/website/` | 95 | 10,143 |
| `electron/ecommerce/` | 5 | 1,677 |
| `electron/shops/` | 4 | 574 |
| `src/components/website/` | 12 | 2,665 |
| `site/` | 49 | 846 |
| `demo-web/` | 14 | 541 |

**ب. ملفات منفردة**
- `src/pages/WebsitePage.jsx`، `electron/ipc/website.js`، `electron/ipc/shops.js`
- `electron/database/ecommerce_schema.sql` وأسطر تحميله في `init.js`
- `src/components/settings/EcommerceSettings.jsx`، `ShopsSettings.jsx`
- `src/i18n/messages/website.js`، `ecommerce.js`، `shops.js`
- `scripts/website-apps-check.mjs`، `scripts/cloudflare-oauth-scopes.mjs`
- `docs/WEBSITE-ACCOUNTS-SETUP.md`، `docs/prompts/shops-link-phase-2.md`، `docs/proposals/2026-10-multi-shop-demo-site.md`، `docs/superpowers/plans/2026-10-17-phase-a-website.md`
- `package.json`: السكربتات `check:website-apps` و`build:demo` و`build:site`، والحزم `node-fetch` و`@fontsource-variable/alexandria` و`@fontsource/ibm-plex-sans-arabic`
- `profile.json`: `githubClientId`، `cloudflareClientId`، `cloudflareScopes`، `cloudflareRedirectPorts`، `domainProviders`
- README: «Future online store» و«Shop website»

**ج. الاختبارات: 28 تُحذف**
- 23 للموقع: `website`، `websiteCloudflare`، `websiteCommunes`*، `websiteDomain`، `websiteGithub`، `websiteHostinger`، `websiteLegal`، `websiteManage`، `websiteOrderConfirm`، `websiteOrderCycle`، `websiteOrderHistory`، `websiteOrderQueue`، `websiteOrderTools`، `websitePages`، `websitePhotos`، `websitePublicData`، `websitePublish`، `websiteSections`، `websiteShopContact`، `websiteStoreTools`، `websiteThemes`، `websiteTokenLink`، `websiteVisibility`
- `ecommerceLifecycle`، `ecommerceLimits`، `shopsCatalog`، `shopsLink`، `afusSite`
- *اختبار القائمة المشتركة (58 ولاية، 1541 بلدية) في `websiteCommunes` يُنقل إلى `tests/communes.test.js`.

**د. ملفات تبقى وتُعدَّل:** `electron/main.js`، `preload.js`، `ipcGuard.js`، `init.js`، `catalogService.js`، `exportService.js`، `storeRankings.js`، `demoData.js`، `ipc/app.js`، `ipc/settings.js`، `App.jsx`، `SettingsPage.jsx`، `ProductsPage.jsx`، `ProductFormModal.jsx`، `ModulesSettings.jsx`، `features.js`، `HelpButton.jsx`، `navItems.js`، `permissions.js`، وستة ملفات ترجمة. و9 اختبارات: `demo`، `demoOffered`، `errorMessages`، `independence`، `ipcGuard`، `proposals`، `storeRankings`، `uiMode`، `whatsapp`.

**هـ. ميزات الملابس (المقترح، ينتظر القرار)**
- تُحذف: `ColorsSizesPage.jsx`، `ProductMatrixModal.jsx`، `SeasonReport.jsx`، `src/lib/clothing.js`، `electron/services/demoPhotos/`، `seasonMarkdown.test.js`.
- يُعاد كتابته: `demoData.js` (محل غذائي).
- يُخفى ولا يُحذف: محرك الألوان والمقاسات (`VariantEditor.jsx`، `VariantPickerModal.jsx`، `product_variants`)، لأنه في 63 من 99 ملف اختبار.
- `MarkdownManager.jsx` و`markdownService.js`: أساس «بِعها قبل ما تفسد».
- `electron/shared/clothing.json` يبقى: الهجرة القديمة `2025_03_brands_and_color_codes` تحتاجه.

**و. البريد الإلكتروني (ينتظر القرار):** `emailService.js`، `emailTemplates.js`، `electron/ipc/email.js`، `nodemailer`، اختبارا `emailQuotation` و`emailTemplates`؛ ويُعدَّل `ipc/credit.js` و`invoiceService.js` و`GiftCardPrintModal.jsx`.

## 6. ما تغيّر في Boutique بعد الدراسة

لا commit جديد بعد `d0d5e51` (26 أكتوبر). ما أظهره الكود ولم تذكره الدراسة:
- **موجود أصلاً:** سعر الجملة، والتقويم الهجري للمواسم، والطلبية المقترحة، والأزرار السريعة.
- **الكميات أعداد صحيحة** في كل مكان (`INTEGER`، و`parseInt` في `adjustStock`، و`purchaseImport.js` يرفض الكسور، وحوالي 31 موضعاً). البيع بالوزن عمل أكبر مما تقوله الدراسة.
- **الوضع البسيط** فيه 6 صفحات (`src/lib/uiMode.js`)، والدراسة تقول 5.
- **`tests/brand.test.js`** يعدّ «hanout» اسماً قديماً ممنوعاً.
- **`xlsx`** يُنزَّل من `cdn.sheetjs.com` لا من npm، وهذا العنوان ممنوع في جلسات Claude السحابية الحالية.
- **أخطاء في Boutique** تُسجَّل في `docs/boutique-notes.md`.

## 7. المهارات والأدوات

- موجودة: using-superpowers، brainstorming، grill-with-docs، writing-plans، subagent-driven-development، executing-plans، dispatching-parallel-agents، test-driven-development، tdd، systematic-debugging، diagnose، improve-codebase-architecture، request-refactor-plan، design-an-interface، ui-ux-pro-max، emil-design-eng، flpbalada-hicks-law، webapp-testing، verification-before-completion، requesting-code-review، receiving-code-review، finishing-a-development-branch، using-git-worktrees، to-prd، to-issues، qa، changelog-generator.
- يشغّلها إسلام بنفسه (`/zoom-out`، `/setup-matt-pocock-skills`، `/ubiquitous-language`): مضبوطة على «المستخدم فقط».
- ناقصة: `frontend-design`.
- لا Supabase (قرار 3 نوفمبر).

## 8. أسئلة مفتوحة

1. **`tests/brand.test.js`:** حذف `hanout` من `OLD_NAMES` في afus-hanout وحده (مطلوب للمرحلة 0).
2. **البريد الإلكتروني:** حذفه (المقترح) أم إبقاؤه؟ قبل المرحلة 1.
3. **قراءة الصور و«اسأل حانوتك» بلا Supabase:** حذفهما، أم وسيط آخر لاحقاً (المفتاح خارج البرنامج دائماً)؟ قبل المرحلة 5.
4. **الوزن:** بالغرام عدداً صحيحاً (المقترح) أم كميات بفاصلة في كل الكود؟ قبل المرحلة 1.
5. **الألوان والمقاسات:** حذف الشاشات وإخفاء المحرك (المقترح) أم حذف المحرك؟ قبل المرحلة 1.
6. **جداول الموقع في الهجرات القديمة:** تركها فارغة (المقترح) أم هجرة جديدة تحذفها؟ قبل المرحلة 1.
7. **الشعار:** `public/icon.svg` يبقى حتى يصل شعار حانوت.
8. لاحقاً: التسعير، وبريدي باي، وعلامة الميزان، وجهاز قارئ الأسعار، وصياغة الزكاة، ومدة قائمة رمضان (الدراسة 3 أسابيع، الكود 14 يوماً)، واختبار `independence` حين يأتي الخادم المحلي.
