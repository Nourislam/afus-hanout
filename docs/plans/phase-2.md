# المرحلة 2: شاشة البيع السهلة

## الملخّص

الهدف: أن يبيع العامل 5 سلع منها خبز بلا باركود ويقبض نقداً في أقل من 30 ثانية، دون نافذة تأكيد ودون أن ينتظر البيع.

ما سنبنيه:

1. **باركود الميزان:** الماسح يقرأ ملصق الميزان (يبدأ بـ 2)، فيجد السلعة برقمها PLU ويضع الوزن أو السعر المطبوع، وينقص المخزون بالغرام. صفحة «شكل باركود الميزان» في الإعدادات فيها خانة تجربة: تمسح ملصقاً فتقرأ ما فهمه البرنامج.
2. **أزرار بالصور للسلع بلا باركود:** الخبز والخضر وما شابه، أزرار كبيرة (64 بكسل على الأقل) في أعلى شاشة البيع.
3. **السنتيم:** خيار يكتب «25 ألف» تحت 250 دج، وزر «ألف» في لوحة الأرقام (25 ثم «ألف» = 250 دج).
4. **الصرف أقل من 5 دج:** «اتركه» أو «سجّله للزبون» إن كان معروفاً.
5. **الدفع:** نقداً هو الافتراضي و«Entrée» ينهي البيع بالمبلغ بالضبط. أزرار: نقد، بطاقة، بريدي باي (لا أقل من 100 دج، ويسأل «وصل SMS؟» قبل الإنهاء)، كريدي.
6. **«تراجع» بدل نوافذ التأكيد** أثناء البيع: يبقى ظاهراً 10 ثوانٍ.
7. **يوم المحل ينتهي عند الغلق:** بيع الساعة 00:30 يُحسب في اليوم نفسه في التقارير.
8. **الوزن في التذكرة:** «بصل 0.500 كغ × 70 دج/كغ»، وعدد القطع لا يحسب سطر الوزن قطعة.
9. **شاشة 1024:** مساحة التذكرة أكبر في الشاشات الصغيرة.

شرط الانتقال (من الدراسة): اختبار العمّ (بيع 5 سلع في أقل من 30 ثانية)، ويوم كامل في محل حقيقي دون أن ينتظر البيع. هذا يجربه صاحب المشروع على جهازه في المحل؛ هنا نتحقق بالاختبارات وبتجربة الشاشة في البرنامج الحقيقي.

# Phase 2 plan (English)

Branch `phase-2-sales-screen`. TDD for every rule; screens checked in the real Electron app in ar/fr at 1024/1366/1920.

### Task 1 (TDD): weight on the ticket and piece counts
`receiptService` prints a weighed line as `name  0.500 kg × 70 DA/kg  35 DA`; the ticket count and the cart count say pieces and kg apart (`5 pcs + 0.5 kg`). Shared helper in `electron/shared/grocery.ts` (`cartCounts(lines)`).

### Task 2 (TDD): scale barcodes
`electron/shared/scaleBarcode.ts`: `decodeScaleBarcode(code, format)` with format `{ prefixes, pluDigits (4-6), value: 'price' | 'weight', decimals }`, EAN-13 check digit verified. Default: prefixes 20-29, PLU 5 digits, value = price in dinars with 0 decimals... (the settings page sets what the shop's scale prints). POS: a decoded code finds the article by PLU (`catalog.lookupPlu`), weight label → `addWeighed(product, grams)`, price label → grams = price / price per kg and the line keeps the printed price. Settings page «شكل باركود الميزان» with a try field. Tests for each format, a wrong check digit, an unknown PLU, a piece article with the PLU.

### Task 3: picture buttons for articles without a barcode
POS: a row of big buttons (≥ 64 px) for active articles without a barcode, best sellers first; a weighed one opens the weight window.

### Task 4 (TDD): centimes and the «ألف» key
Setting `show_centimes` (off by default): "25 ألف" under amounts (payment total, customer display). NumPad gets a «ألف» key where a price is typed (payment, weight price): 25 then «ألف» = 250 DA. Pure helper `centimesLabel(amount, lang)` tested.

### Task 5 (TDD): payment
Cash is selected; Enter (or the big button) with nothing typed pays the exact amount. Baridi Pay replaces "BaridiMob / CCP": refused under 100 DA, and asks «وصل SMS؟» before finishing. Change under 5 DA: «اتركه» (default) or «سجّله للزبون» (store credit of the selected customer).

### Task 6: undo instead of confirmations
Emptying the ticket and removing a line act at once and show «تراجع» for 10 s (toast with action).

### Task 7 (TDD): the shop day ends at closing
Setting `day_ends_at` (default 04:00): a sale before that hour counts in the previous day in the day ranges used by the reports and the dashboard.

### Task 8: the ticket area on small screens
At 1024 × 700 the ticket shows at least 4 lines: the month goal box folds away under 800 px of height.

### Task 9: verify, review, merge
lint, typecheck, tests, screens, review, PR, merge, tick the study.

## Result (2026-11-05)

Done on branch `phase-2-sales-screen`:

- Scale labels: `electron/shared/scaleBarcode.ts` reads the label (prefix 21–28, PLU of 4–6 digits, weight in grams or price with 0–2 decimals, check digit); the till finds the article by PLU. Settings › Label scale, with a field to try a real label. The program's own article codes now start with 20.
- Weight on the ticket and the A4 invoice («0.500 kg × 70 DA/kg»), pieces and kg counted apart there and on the sales screen.
- Picture buttons for articles without a barcode (bread, vegetables), best sellers first; the demo's bread has no barcode.
- Payment: nothing typed = the exact amount (Enter finishes the sale); Baridi Pay replaces «BaridiMob / CCP», refuses less than 100 DA (screen and main process) and finishes only once «SMS received» is ticked.
- Centimes option: «25 ألف» under 250 DA and a «ألف» key (25 then ألف = 250 DA).
- «تراجع» for 10 s instead of the confirmation when emptying the ticket or removing a line.
- The shop day runs from 04:00 to 04:00: home screen, charts, reports, today's sales.
- At 1024 × 700 the ticket shows three lines instead of two (compact buttons on short screens).

Moved to phase 3: the change under 5 DA «سجّله للزبون» needs the customer's karni balance, built there.

Code review: five bugs found and fixed (undo restoring a sold ticket, price labels refused at the official price, charts losing days with the 04:00 start, the Baridi SMS tick surviving Cancel, report periods mixing midnight and 04:00), plus three small ones.

Checks: lint, typecheck, `vite build`, 90 test files / 540 tests. Screens in the real Electron app (demo shop), Arabic and French, 1024 / 1366: sale by piece, carton, weight and scale label; scale settings with a label tried; Baridi Pay; centimes.

The uncle test (5 articles including bread, paid in cash, under 30 s) and a full day in a real shop are for the owner to run on his computer.
