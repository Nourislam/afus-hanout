# أفوس حانوت على الهاتف — Afus Hanout on the phone

تطبيق صغير لهاتف صاحب المحل: يقرأ الأسعار، يجرد الرفوف، يرى مبيعات اليوم ويصوّر السلع.
لا قاعدة بيانات في الهاتف: كل شيء يأتي من حاسوب المحل، على WiFi المحل فقط، ولا يخرج شيء إلى الإنترنت.

A small app for the shop owner's phone: prices, counting the shelves, the
day's figures and article photos. The phone holds no database: it asks the
till computer, on the shop's WiFi only (`electron/server/localServer.js`).

## Pairing — الربط

1. On the computer: **Settings › Phone and price checker** (الإعدادات › الهاتف وقارئ الأسعار), turn it on, then **Add a device**.
2. In the app, scan the QR code. It works once, for 10 minutes.
3. The phone keeps its token in its secure storage. Removing the device on the computer unpairs it.

The price-checker tablet needs no app: it opens the address shown under the QR code (`http://<computer>:4560/kiosk`) and types the 6 digits.

## Try it — التجربة

```bash
cd mobile
npm ci
npx expo start        # then scan the Expo QR code with Expo Go on the phone
```

The phone and the computer must be on the same WiFi. Expo Go is enough to try it.

## Build an APK — بناء ملف APK

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

or with EAS (`eas build -p android --profile preview`). The app talks to the
computer over plain HTTP on the shop's network: `app.json` allows it
(`expo-build-properties` › `usesCleartextTraffic`, iOS `NSAllowsLocalNetworking`).

## Code

- `src/client.ts` — the pairing link and the calls to the computer, with no React Native import. `tests/mobileClient.test.ts` (in the desktop project) checks it against the real server.
- `src/texts.ts` — the words, Arabic first, then French and English.
- `src/screens/` — pairing, price, count, today, photo.
- `npm run typecheck` — TypeScript (strict).
