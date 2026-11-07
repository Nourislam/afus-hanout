# المرحلة 8: المواسم والملخصات والزكاة

## الملخّص

1. **المواسم بالتقويم الهجري:** رمضان، عيد الفطر، عيد الأضحى، والدخول المدرسي. قبل الموسم بثلاثة أسابيع تظهر بطاقة، وصفحة «المواسم» تعطي ما بِيع **أكثر من العادة** في الموسم نفسه العام الماضي (×1.3 مقارنة بالأسابيع الأربعة قبله)، ناقص المخزون، بالكرطونة أو الكيلوغرام. المحل الجديد يأخذ القائمة العامة مع سلعه.
2. **قفة رمضان للجمعية:** من صفحة الحزم: عدد القفف، وورقة مطبوعة بما تأخذه من الرفوف وثمنها.
3. **ملخص الغلق:** عند غلق الصندوق: بعت كذا، ربحت تقريباً كذا (للمالك فقط)، الكريدي زاد أو نقص كذا، وزر «أرسل بواتساب».
4. **البطاقات الذكية:** ثلاث في اليوم على الأكثر، الأهم أولاً، زر واحد لكل بطاقة، و«ليس اليوم» يخفيها حتى الغد.
5. **الغرائب (للمالك):** نقص أو زيادة في الصندوق عند الغلق (100 دج فأكثر)، بيع تحت سعر الشراء، عامل يُرجع أكثر بكثير من غيره، في الأسبوع الأخير.
6. **حاسبة الزكاة التقديرية (للمالك):** السلع بسعر الشراء أو البيع (يختار التاجر)، النقود، الكريدي المرجوّ، ناقص ديون الموردين، والنصاب إن أدخله، ثم 2.5%. ويوم الزكاة الهجري يذكّر به قبل أسبوع.

**تنبيه:** صياغة شاشة الزكاة **تُراجع مع مختص قبل النشر** (قرار مفتوح في الدراسة). البرنامج يجمع الأرقام فقط، والشاشة تقول ذلك.

# Phase 8 plan (English)

Branch `phase-8-seasons`.

1. `electron/shared/hijri.ts` (ICU Umm al-Qura; Algeria's moon sighting is a day apart at most), `seasonService.js` + `seasonStaples.json`; page `/seasons` (inventory.adjust). Tests: `hijri.test.ts`, `seasons.test.ts`.
2. `src/lib/qoffa.ts` and the «للجمعية» button on the packs page. Test: `qoffa.test.ts`.
3. `dayService.daySummary` and `closingText` (WhatsApp share); the box in `ShiftSummaryDialog`; the profit dropped for other roles in `day:summary`. Tests: `dayService.test.ts`, `whatsappStatement.test.ts`.
4. `src/lib/smartCards.ts` (three at most, «not today» in local storage) and `HanoutToday.tsx` rebuilt on it. Test: `smartCards.test.ts`.
5. `dayService.oddities` (cash gaps from `shiftService.getShiftStats`, below cost, refunds per employee), owner only.
6. `zakatService.js` + `shared/zakat.ts`; page `/zakat` behind a new owner-only permission `zakat.view`; setting `zakat` (Hijri day, nisab) owner-only. Test: `zakat.test.ts`.

## Result (2026-11-07)

Done. Checks: lint, typecheck, `vite build`, 109 test files / 633 tests. Real app (demo shop), Arabic and French at 1024/1366/1920: the home cards (visits, scale), the seasons (Ramadan in 93 days with the general list; the school start from September 2026), the zakat estimate on the demo's figures (2 339,88 د.ج at sale price), the qoffa dialog, and the day in three lines at the drawer's closing («بعت 7 105 د.ج (26 تذكرة) · ربحت تقريباً 1 173,25 د.ج · الكريدي زاد 665 د.ج»).

Not done here: the specialist's review of the zakat wording (before release); the transition test (a real owner reads the cards for a week).
