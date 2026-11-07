# المرحلة 6: الهاتف وقارئ الأسعار

## الملخّص

خادم صغير داخل البرنامج، على WiFi المحل فقط، **مطفأ حتى يشغّله المالك**. لا يتصل بأي شيء خارج المحل، ولا يجيب إلا عناوين الشبكة المحلية.

1. **الاقتران مرة واحدة:** الإعدادات › الهاتف وقارئ الأسعار › «أضف جهازاً»: رمز من 6 أرقام ورمز QR، صالح 10 دقائق ومرة واحدة، و5 محاولات خاطئة تلغيه. الجهاز يأخذ مفتاحاً؛ البرنامج يحفظ بصمته فقط، ويمكن إزالة أي جهاز.
2. **تطبيق الهاتف (Expo بـ TypeScript، في `mobile/`):** يمسح رمز QR، ثم: السعر بالباركود أو PLU أو ملصق الميزان، الجرد في الجرد المفتوح على الحاسوب (×1، ×6، ×12، ×24)، ملخص اليوم (المبيعات، الربح، التذاكر)، وصورة السلعة.
3. **قارئ الأسعار:** لوحة عند الرفوف تفتح عنوان الحاسوب في متصفحها (`/kiosk`) وتكتب الأرقام الستة: أسعار فقط، بخط كبير.

# Phase 6 plan (English)

Branch `phase-6-local-server`.

### Task 1 (TDD): the server
`electron/server/localServer.js`: `handle(api, request)` (testable without a socket) and `start({ api, port })`. Pairing code (6 digits, 10 minutes, once, 5 wrong tries cancel it); token of 24 random bytes, only its SHA-256 kept (`paired_devices`, new migration); roles `phone` and `kiosk`. Routes: `/kiosk`, `POST /api/pair`, `GET /api/price`, `POST /api/count`, `GET /api/today`, `POST /api/photo`. Only private addresses are answered. The independence test allows this one server, and the price checker page.

### Task 2: Settings › Phone and price checker
`electron/ipc/devices.js` (owner only in the IPC guard; the setting `local_server` is the owner's too), `DevicesSettings.tsx`: the switch, the code and its QR code (bwip-js, drawn on the computer), the kiosk address, the paired devices with a remove button. The server comes back on at start when the owner left it on.

### Task 3: the phone app
`mobile/`: its own Expo SDK 58 project (TypeScript strict). `src/client.ts` has no React Native import: `tests/mobileClient.test.ts` checks it against the real server (pair, price, count, today, removed device, offline). It talks to private addresses only. `app.json` allows plain HTTP on the shop's network (Android `usesCleartextTraffic`, iOS `NSAllowsLocalNetworking`).

## Result (2026-11-07)

Done. Checks: lint, typecheck, `vite build`, 102 test files / 602 tests. The phone app: `tsc` strict and an Android bundle (`expo export`, 643 modules) with the SDK's own packages, in a scratch copy. Screens in the real app (demo shop), Arabic and French at 1024, 1366 and 1920: the section, the QR code, the list. A browser on `/kiosk` paired with the 6 digits and showed «بسكويت — 50 د.ج»; once the owner turned the server off, the page was refused.

Not checked here: a real phone on a real WiFi (the container has no network card on a LAN, so the address shown was 127.0.0.1). That is the transition test: the phone and the tablet working in the shop with the internet cut.
