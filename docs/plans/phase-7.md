# المرحلة 7: الميزان (الملف والورقة)

## الملخّص

الميزان يطبع السعر الذي يأخذه الصندوق، فقائمته يجب أن تتبع البرنامج. دون ميزان حقيقي ودليل بروتوكوله لا نبرمج الإرسال المباشر (قرار الدراسة)، فالبرنامج يعطي القائمة بطريقتين:

1. **ملف للميزان:** CSV (الرقم؛ الاسم؛ سعر الكيلوغرام) يقرؤه برنامج الميزان على الحاسوب، أو Excel.
2. **ورقة مطبوعة (A4):** الأرقام والأسماء والأسعار، مع مربع يُعلَّم عند إدخال كل سطر في الميزان.

والبرنامج يتذكر ما أُعطي للميزان آخر مرة: كل سعر تغيّر، وكل سلعة جديدة أو أُزيلت، تظهر حتى يضغط المالك «الميزان محدَّث»، وتظهر بطاقة في الصفحة الرئيسية «أسعار الميزان تحتاج تحديثاً». والسلع بالوزن التي بلا رقم تأخذ الأرقام الحرة التالية بضغطة.

# Phase 7 plan (English)

Branch `phase-7-scale`.

### Task 1 (TDD): the scale's list
`electron/services/scalePluService.js`: `pluList` (active articles sold by weight with a PLU, by number; changes since `settings.scale_plu_sent`: new, price, name, gone; the ones without a number), `assignNumbers`, `markSent`, `pluCsv` (UTF-8 with BOM, `;`, the scale's decimals), `pluSheetHtml` (A4, right to left in Arabic, escaped, only the changes on demand). Tests: `tests/scalePlu.test.ts`.

### Task 2: IPC and screens
`electron/ipc/scale.js` (`scale:plu`, `scale:assignNumbers`, `scale:markSent`, `scale:saveFile` csv|xlsx, `scale:printSheet`), guard rules (numbers and "up to date": products.edit; file and sheet: products.view), Excel kind `scalePlu`. `ScaleList.tsx` under Settings › Label scale; a third card on the home screen when the scale is behind (only once the shop has said the scale was updated).

## Result (2026-11-07)

Done. Checks: lint, typecheck, `vite build`, 103 test files / 608 tests. Real app (demo shop): 4 weighed articles listed, marked up to date, a price changed → «1 تغيير لم يدخل الميزان بعد» and the home card; Arabic and French at 1024/1366/1920; the A4 sheet rendered with the change («كان 120 د.ج»), a new article and one to empty.

Not done (needs a real scale, the owner's step): buy the scale most sold to shops around you with its protocol manual, then the direct sending over the network. The scale's import format (separator, columns, Arabic names) is to be checked on that scale; the file is generic until then.
