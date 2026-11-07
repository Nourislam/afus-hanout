# المرحلة 4: الموردون والموزعون والطلبية

## الملخّص

الهدف: الموزع يمر، التاجر يستلم في دقيقة، والبرنامج يقترح طلبية يوم المرور التالي يقبلها التاجر كما هي أو بتعديل سطرين.

ما سنبنيه:

1. **الاستلام السريع:** الموزع يصل، تُمسح السلع وتُكتب الكمية وسعر الشراء (بالقطعة أو الكرطونة أو الكيلوغرام)، والمبلغ المدفوع. المخزون وسعر الشراء ودين المورد في معاملة واحدة.
2. **عدة موردين لكل سلعة:** آخر سعر عند كل مورد وتاريخه، أرخص مورد، وتنبيه إن ارتفع السعر.
3. **ذاكرة أسماء المورد** (`supplier_item_names`): اسم السلعة في فاتورة المورد يُربط بسلعة المحل مرة واحدة، ثم يُعرف وحده (من الاستلام ومن ملفات Excel).
4. **أيام المرور والطلبية المقترحة:** لكل موزع أيام مروره. صباح يوم المرور: ما ينقص حتى المرور التالي، مقرّباً إلى الكراطن، وإرسال الطلبية بواتساب.
5. **الصلاحية:** تاريخ الصلاحية عند الاستلام، وقائمة «بِعها قبل ما تفسد».
6. **الأسعار المسقّفة وحد الندرة:** قائمة جاهزة للسلع المدعّمة يراجعها التاجر، و«حدّ لكل زبون» يشغّله وقت الندرة.

# Phase 4 plan (English)

Branch `phase-4-suppliers`. TDD for every rule.

### Task 1 (TDD): quick receiving
`electron/services/receiveService.js` `receive(api, { supplierId, lines: [{ productId, quantity, unitCost, invoiceName?, expiresOn? }], paid })`: a purchase order received at once (supplier debt as in Boutique), stock (grams for kg articles, pieces × carton for a carton line), cost as the average of the stock and what arrived, `product_suppliers` (last cost and date), the invoice name remembered, a batch when an expiry date is given.

### Task 2 (TDD): suppliers of an article
`supplierPrices(api, productId)`: each supplier's last cost and date, the cheapest; `priceRise(...)`: a cost above the last one by more than 5 % is flagged at receiving.

### Task 3 (TDD): the supplier's names
`supplier_item_names`: learnt at receiving and from the supplier's Excel file; `matchInvoiceName(api, supplierId, name)` finds the article next time.

### Task 4 (TDD): visit days and the suggested order
`supplier_visits.weekdays`; `suggestedOrder(api, supplierId, today)`: for each article of this supplier, sales per day over 28 days × days until the visit after next, minus stock, rounded up to cartons; weighed articles in kg. A morning card on visit days; the order sent on WhatsApp.

### Task 5 (TDD): expiry
`product_batches` from receivings; `sellSoon(api, days)`: batches that expire within N days with what is probably left (stock spread over the newest batches first).

### Task 6 (TDD): official prices list and scarcity limit
A ready list of capped articles (milk bag, bread, oil, sugar, semolina, flour) to review; `products.max_per_customer` checked by the cart and the main process.

### Task 7: reorder and run-out in grams
The reorder suggestions and «runs out soon» use grams for weighed articles.

### Task 8: verify, review, merge

## Result (2026-11-07)

Done on branch `phase-4-suppliers`:

- Quick receiving (`receiveService.js`): stock (pieces, cartons or grams), average cost, a purchase order received at once (the supplier's debt), last price per supplier, invoice names remembered, expiry batches, price rises over 5 % pointed out.
- Visit days and the suggested order (`visitOrderService.js`): until the next visit and one day more, in cartons or kg; sent on WhatsApp. Reorder suggestions count weighed articles in grams.
- «بِعها قبل ما تفسد» (`expiryService.js`), official prices to review and the scarcity limit per customer (`cappedService.js`, migration `2026_11_hanout_scarcity_limit`, checked by the cart and the main process).
- Screens: the distributors page (days, order, receiving), the home cards (who comes today, what to sell soon), Settings › Sales screen › Official prices.

Left for phase 5: learning the supplier's names from his Excel file and from the invoice entry (the memory table and its lookup are in place; the receiving screen has no field for the invoice name yet).

Checks: lint, typecheck, `vite build`, 98 test files / 568 tests. Screens in the real app (demo shop): distributors list, the order (5 lines), a receiving that moved the stock, the home cards, the official prices list.

The real-shop condition (the owner accepts the suggested order with at most two changes, two weeks in a row) is for the owner to check.
