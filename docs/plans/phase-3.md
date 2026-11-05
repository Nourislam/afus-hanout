# المرحلة 3: الكريدي الجزائري (الكارني)

## الملخّص

الهدف: بيع بالكريدي لزبون معروف في أقل من 15 ثانية بعد المسح، ومعرفة ما عليه وإرسال كشفه بواتساب في أقل من 20 ثانية.

ما سنبنيه:

1. **الكارني بالاسم:** الزبون الجديد من الصندوق يُسجَّل بالاسم الذي يعرفه به صاحب المحل (الهاتف اختياري)، وكريديه مفعّل مباشرة بالسقف الافتراضي للمحل (يُغيَّر من الإعدادات أو لكل زبون).
2. **«خلّص بعض»:** الزبون يدفع مبلغاً من مجموع ما عليه، والبرنامج يوزعه على أقدم الديون أولاً.
3. **صفحة الكارني:** الأسماء وما على كل واحد، بحث، وزرّان: «خلّص بعض» و«كشف بواتساب».
4. **كشف بواتساب بعبارة مؤدبة:** «السلام عليكم… هذا كشف حسابكم عند…» مع أسطر الديون وتواريخها والباقي. التذكير يرسله صاحب المحل بنفسه.
5. **رصيد الصرف:** إن بقي أقل من 5 دج، «سجّله للزبون» فيُخصم في المرة القادمة، والصندوق يعرف أن الصرف بقي فيه.
6. **الفليكسي والخدمات:** سلعة «خدمة» بالمبلغ والربح (٪)، بلا مخزون، حتى يطابق الصندوق آخر اليوم.
7. **«استهلاك العائلة»:** سبب خروج من المخزون لا يُحسب ضياعاً.

# Phase 3 plan (English)

Branch `phase-3-karni`. TDD for every rule; screens checked in the real app in ar/fr.

### Task 1 (TDD): karni service
`electron/services/karniService.js`: `balances(api)` (customers who owe, with what and since when), `payPart(api, { customerId, amount, method })` spreads a payment over the oldest open credit sales first and refuses more than owed, `openLines(api, customerId)` for the statement.

### Task 2 (TDD): a new customer has the karni on
A customer created at the till (any role) has credit on with the shop's default ceiling (setting `karni_default_limit`, 5000 DA by default, changed in Settings › Sales screen).

### Task 3: karni page
Credit page opens on «الكارني»: names, balance, last purchase; «خلّص بعض» (amount pad, quick «all») and «كشف بواتساب». The ticket list stays as a second tab.

### Task 4 (TDD): polite statement text
`statementText({ name, shop, lines, owed, lang })`: greeting, lines (date, amount left, at most 10, then «and N more»), what is left, thanks.

### Task 5 (TDD): change balance
Migration `2026_11_hanout_change_balance` (table `change_balance_moves`). At payment, change under 5 DA with a customer: «سجّله للزبون». The drawer's expected cash counts the change kept; the customer's next ticket can use it (payment method `change_balance`), never more than the balance.

### Task 6 (TDD): services (flexy)
`products.unit = 'service'` with `service_margin` (%): no stock; at the till the amount is typed; cost = amount × (1 − margin). Article form: «خدمة (فليكسي…)».

### Task 7: family consumption
Stock reason `family` («استهلاك العائلة»), not counted as a loss.

### Task 8: verify, review, merge
