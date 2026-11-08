# Afus Hanout

**Afus Hanout** is the [Afus](docs/NAMING.md) application for Algerian grocery shops (hanout,
superette, mini-market): an offline point of sale and stock manager for Windows and macOS
(Electron + React + SQLite). Every sale, stock movement and kridi is kept in a local database on
the shop's computer; it works without an account and without internet. There is **no website, no
online store and no online orders**.

> **بالعربية:** أفوس حانوت برنامج من شركة Afus لمحلات المواد الغذائية: الحانوت، والسوبيرات،
> والميني ماركت. يعمل بدون إنترنت وبدون حساب، وكل البيانات تبقى على حاسوب المحل. لا موقع إلكتروني، ولا متجر إلكتروني، ولا طلبات عبر الإنترنت.

Afus Hanout starts from the code of Afus Boutique, with its history (`git remote` `boutique`, push
disabled). The plans and each phase's result are in [docs/plans](docs/plans); what changed for the
shops is in [CHANGELOG.md](CHANGELOG.md).

## Features

- **Shop setup on first launch** – name and logo, owner, address and wilaya, legal numbers, tax,
  ticket texts, printers. Editable later in *Settings*. Three languages: Arabic (right to left),
  French and English.
- **Grocery articles** – three fields (name, barcode, price), the rest under *More*: sold by the
  piece, by weight (stock in grams, price per kg) or as a service (flexy, bills); cartons with
  their own price and barcode; the scale's number (PLU); the official capped price.
- **Sales screen** – weighed lines and cartons, scale labels (weight or price), picture buttons for
  articles without a barcode, undo instead of confirmations, cash, card and Baridi Pay (SMS),
  centimes as an option, small change kept for the customer, a 04:00 → 04:00 shop day.
- **Karni (credit)** – who owes what, "pay part", a polite statement on WhatsApp, a limit per
  customer, the old notebook typed in name by name.
- **Suppliers and distributors** – quick receiving (stock, cost, debt, expiry), each supplier's
  names remembered, visit days and the order in cartons on WhatsApp, price rises flagged,
  "sell before it goes off".
- **Offline smarts** – "Ask your shop" questions, at most three home cards a day, seasons by the
  Hijri calendar (Ramadan, the Eids, the school start), Ramadan baskets for associations, the day
  in three lines at closing, oddities and a zakat estimate for the owner.
- **Devices** – USB scanners in keyboard mode, 58/80 mm tickets, labels; the label scale's PLU list
  (file and printed sheet); the owner's phone ([mobile/](mobile), Expo) and a price-checker tablet
  on the shop's WiFi, paired once by QR code (off until the owner turns it on).
- Stock counts (also in kg), Excel files, reports, employees with PIN login and roles
  (admin / manager / cashier), backups.

## Installing (shops)

One installer, `Afus Hanout Setup <version>.exe`, for Windows 10 and 11, which can be copied to a
USB key. The shop needs nothing else: no Node.js, no internet. The program is `AfusHanout.exe`;
uninstalling keeps the shop's data. macOS: `Afus Hanout.app` in `Afus-Hanout-<version>-<arch>-mac.dmg`.

Afus Hanout and Afus Boutique are made to be installed on the same computer: their programs, data folders
and databases are separate.

The printers (ticket and label) must be installed in Windows or macOS with their driver;
scanners work in their default keyboard (HID) mode.

## Development

Requirements: Node.js 22, npm.

```bash
npm ci                 # install dependencies
npm run electron:dev   # Vite dev server + Electron
npm test               # unit tests (vitest)
npm run lint
npm run electron:build:win -- --publish never   # Windows installer (run on Windows)
npm run build:demo     # the web demo (dist-demo/): the real program in a browser page, for the Afus website
node scripts/generate-icons.js                  # icons from public/icon.svg
```

Building the Windows installer on Linux requires Wine; build it on Windows or with GitHub
Actions. Nothing is ever published: the application has no auto-update.

| Workflow | When | Result |
|---|---|---|
| `Build Windows Installer` | started by hand (*Actions › Run workflow*), or when the workflow file changes | artifact `Afus-Hanout-Setup-<version>-win` |
| `Release` | a `v*` tag is pushed | Windows, macOS and Linux files as artifacts |
| `CI` | pushes and pull requests to `main` | lint, tests, Windows build |

## Data

- Database: `%APPDATA%\AfusHanout\afus-hanout.db`; images and logo in
  `%APPDATA%\AfusHanout\images` (macOS: `~/Library/Application Support/AfusHanout`).
  The folder also holds the window settings and browser storage. It is independent of any
  other application: nothing is imported automatically.
- Every sale, return, payment and purchase order is written in one transaction: either all of
  it is saved or nothing is.
- Schema changes are versioned in `electron/database/migrations.js`; a copy of the database
  file is written before an existing database is upgraded.
- *Settings › Backup* writes `afus-hanout-<date>_<time>.db` copies and restores the database.

## Identity

The product identity (company, product name, app id, data folder, database file) is defined once
in `electron/shared/brand.json`, read by the main process (`electron/brand.js`) and the interface
(`src/config/brand.js`). `package.json` repeats what electron-builder needs; `tests/brand.test.js`
checks they match. Naming rules for the other Afus products: [docs/NAMING.md](docs/NAMING.md).

## Project structure

```
electron/
  main.js                 IPC handlers, window, printing entry points
  preload.js              contextIsolation bridge (window.electronAPI)
  brand.js, shared/       product identity, grocery helpers (weights, scale labels, Hijri calendar)
  server/                 the shop's own server on its WiFi (phone, price checker)
  database/               init (load/save, transactions), migrations, strict adapter
  services/               catalogue, labels, receipts, printing, shifts, ...
src/
  pages/                  sales, products, stock, labels, catalogue, reports, settings, ...
  components/             screens' parts (products, labels, settings, POS, ...)
  i18n/                   Arabic / French / English texts
  hooks/useBarcodeScanner.js, lib/scanner.js   keyboard-mode scanner handling
tests/                    vitest tests (migrations, catalogue, scanner, printing, identity)
mobile/                   the owner's phone app (Expo, TypeScript)
docs/NAMING.md            naming rules for Afus products
```

## Security

See [SECURITY.md](SECURITY.md).

## License

MIT – see [LICENSE.txt](LICENSE.txt). Part of the code comes from earlier MIT-licensed
open-source software; its copyright notice is kept in LICENSE.txt, as that license requires.
