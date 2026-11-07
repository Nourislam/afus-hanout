# المرحلة 9: الإطلاق (ما يُنجز من هنا)

## الملخّص

ملاحظات الإصدار للتجار (`CHANGELOG.md`، بالعربية ثم الفرنسية والإنجليزية)، رقم الإصدار 1.0.0، README يصف البرنامج الغذائي، فحص المثبّت، والتقرير النهائي ([final-report.md](final-report.md)). بقية المرحلة 9 في الدراسة (الحوانيت التجريبية، التسعير، الفيديو) عند صاحب المشروع.

# Phase 9 plan (English)

Branch `phase-9-release`.

1. Release notes from the merged phases (changelog-generator), user-facing, three languages.
2. Version 1.0.0 (`package.json`, `package-lock.json`).
3. README: features, installer names, data folder, structure (the grocery product, `mobile/`, `electron/server/`).
4. Installer check: `electron-builder --linux dir` with the local Electron (nothing downloaded), then the packaged app launched on a fresh data folder.
5. Final report in Arabic.

## Result (2026-11-07)

Packaged (Linux, unpacked, 362 MB): the app opens on the setup wizard, version 1.0.0, data folder `AfusHanout`, no error from the main process; the TypeScript modules of the main process load from the archive; the local server starts and serves the price checker page from inside the archive. The Windows installer is built on Windows (`npm run electron:build:win -- --publish never`): not done here.
