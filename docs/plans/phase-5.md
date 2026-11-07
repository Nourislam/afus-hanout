# المرحلة 5 (بلا إنترنت): إدخال الفاتورة بذاكرة المورد، الكارني القديم، «اسأل حانوتك»

## الملخّص

بقرار صاحب المشروع: البرنامج يعمل بلا إنترنت تماماً، فلا قراءة صور. بدل ذلك:

1. **إدخال فاتورة المورد بسرعة:** في الاستلام، يُكتب اسم السلعة كما في فاتورته؛ الاسم الذي رُبط من قبل يظهر أولاً، والجديد يُحفظ عند اختيار السلعة.
2. **الكارني القديم:** اسم بعد اسم كما في الدفتر: ما عليه ومنذ متى.
3. **«اسأل حانوتك»:** أسئلة جاهزة كأزرار، أجوبتها من أرقام المحل.

# Phase 5 plan (English)

Branch `phase-5-offline`. No photo reading and no Supabase (the owner's decision: fully offline).

### Task 1 (TDD): «اسأل حانوتك»
`electron/services/askService.js`: best sellers this week, today's profit, who owes most, what runs out this week, what is not selling. Page `/ask` with one button per question.

### Task 2 (TDD): the old paper karni
`karniService.openingDebt`: a known name gets the debt, a new one is created with the karni on; a window on the karni page made for typing the notebook.

### Task 3: supplier's names in the invoice entry
The quick receiving looks up the name typed (supplier_item_names) and remembers a new one when an article is picked.

## Result (2026-11-07)

All three done on branch `phase-5-offline`. Checks: lint, typecheck, `vite build`, 99 test files / 577 tests. Screens in the real app (demo shop): the five questions answered, an old karni name added (1250 DA).

Not done (needs the internet, set aside by the owner's decision): reading invoice and karni photos, the Supabase project. Learning names from the supplier's Excel file is left for later (the memory is filled by the invoice entry).
