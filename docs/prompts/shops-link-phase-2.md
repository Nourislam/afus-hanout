# Prompt — Shops link, phase 2: see the stock of my other shops

Copy everything below into a new Claude Code session on this repository.

---

Afus Boutique (Electron + React + sql.js, Arabic first, the program must think like the shop worker).
Phase 1 of the shops link is done: `electron/shops/` (worker/link.mjs on the owner's Cloudflare
Worker + D1, shopsService.js, catalogPackage.js), Settings › محلاتي (`src/components/settings/ShopsSettings.jsx`),
tests `tests/shopsLink.test.js` (fake Cloudflare that really runs the Worker on sql.js), `tests/shopsCatalog.test.js`,
in-app e2e pattern in the scratchpad `p8/shops.cjs`. Articles and variants keep the SAME ids in every shop.

Build phase 2: **while selling, the worker sees the stock of the same article in the owner's other shops.**
Example on the sales screen / article page: «المقاس M غير موجود هنا — يوجد 2 في بوتيك باب الزوار».

Requirements
1. Each linked shop (main and branches) sends a small stock snapshot to the link:
   `PUT /stock` (shop key or owner key) = `{ at, items: [[variant_id|product_id, qty], ...] }` only for
   articles that exist in the shared catalogue. No prices, costs, sales, customers.
   Sent: after each sale/return/receiving (debounced, e.g. 2 minutes) and every 15 minutes, only when
   the stock changed (hash). Offline: nothing breaks, it waits; selling never waits for the network.
2. Worker: table `stock(shop_id, item_id, qty, at)` (+ schema upgrade for links made in phase 1:
   CREATE TABLE IF NOT EXISTS run again on connect), `GET /stock?items=a,b,c` returns, per item, each
   OTHER shop's name, qty and `at`. Same auth rules as phase 1 (constant-time, hashes only).
3. Main process: `shops.otherStock(itemIds)` with a 60-second memory cache and a 4-second timeout;
   IPC `shops:otherStock` guarded like sales viewing (cashiers may see it). Returns [] when not linked.
4. UI (Arabic first, ar/fr/en texts in `src/i18n/messages/shops.js`):
   - POS variant picker and article page: a small line under each size/colour that is 0 here but >0
     elsewhere: «يوجد {n} في {shop}» with the time of the snapshot when older than 1 hour («قبل 3 ساعات»).
   - Products page: a filter «موجود في محل آخر».
   - Settings › محلاتي: switch «أظهر مخزون محلاتي الأخرى للعمال» (default on) and the last send time.
5. Never block: if the link is down, show nothing (no error toast while selling).
6. Tests: unit (snapshot builder, only shared items, hash skip), worker e2e on the fake cloud with
   3 shops (A sees B and C, a removed shop disappears, wrong key 401), in-app e2e (two profiles,
   sell in B, A's POS shows the new qty). Lint, full vitest, then PR + merge.
7. Keep `tests/independence.test.js` green (network only in the allowed files).

Later phases (do NOT build now): transfers between shops with a printed transfer slip scanned on
arrival; owner reports comparing shops; one price or a price per shop.
