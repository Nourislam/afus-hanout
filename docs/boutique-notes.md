# Problems found in Afus Boutique

Found while building Afus Hanout. Nothing is fixed in Boutique from here: each line is for Islam to
decide. A fix marked `core:` in Hanout contains no Hanout name and can be cherry-picked into Boutique
as it is. To list them, in afus-hanout: `git log --oneline --grep '^core:' boutique/main..main`. To take one
into Boutique is Islam's step, in Boutique's own folder: add afus-hanout as a remote, fetch it, then
`git cherry-pick <commit>`.

| Date | Where | Problem | In Hanout |
| --- | --- | --- | --- |
| 2026-11-03 | `SECURITY.md` | Says employee PINs are stored without hashing; they are hashed since migration `2026_10_hash_pins`. The supported versions table says 1.1.x while the program is 1.5.0. | Not yet (phase 1 rewrites SECURITY.md) |
| 2026-11-03 | `.github/workflows/build-windows-installer.yml` | The artifact name is fixed at `Afus-Boutique-Setup-1.2.0-win`, and the workflow also runs on pushes to an old feature branch. | Fixed: artifact named from `package.json`, Actions tab only |
| 2026-11-03 | `electron/database/init.js` | The demo shop file is written by hand as `afus-boutique-demo.db` instead of from `brand.json`. | Fixed: `core: name the demo shop database after the product` (e22bbf2) and `core: demo file name test tells fileSlug from databaseFile` (fc10000) |
| 2026-11-03 | `tests/brand.test.js`, `backup.test.js`, `demo.test.js`, `documents.test.js` | File names and the receipt's product line written as Boutique's instead of read from `brand.json`. | Fixed: `core: tests read the product names from brand.json` (0ed326d). **After cherry-picking it into Boutique**, add a test that pins Boutique's own values (like `tests/hanoutIdentity.test.ts` here), because brand.test.js then compares brand.json with itself. |
| 2026-11-03 | `electron/main.js`, `backupService.js`, `logService.js`, `ipc/backup.js` | Comments give Boutique's folder and file names as if they were fixed. | Fixed: `core: comments name the data folder and file prefix of any Afus product` (31cb086) |
| 2026-11-03 | `package.json` | `xlsx` is installed from `https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz` ("latest", not npm): an install fails wherever that host is not reachable. | Not changed |
| 2026-11-03 | `src/index.css` | The reduced-motion rule covers only `.training-glow`, a leftover of the training mode that was removed. | Not changed |
| 2026-11-04 | `electron/services/receiptService.js:101` | The receipt PDF for e-mail is written as `<temp>/receipt_<n>.pdf`, without the product file prefix that docs/NAMING.md asks for: two Afus programs on one computer write the same names. | Not changed; decided with the e-mail question before phase 1 |
| 2026-11-04 | `electron/shops/shopsService.js:33-34` | The shops link names its Cloudflare Worker and D1 database `afus-shops` for every product: linking shops from a second Afus program on the same Cloudflare account would reuse Boutique's database and replace its Worker key, cutting Boutique's link. | Removed in phase 1; until then, do not link shops from Hanout |
| 2026-11-04 | `electron/services/updateService.js:19-24` | The update file has no product field. A reseller profile copied from Boutique (see `signing/profiles/example.json`) would make another Afus program offer Boutique as its update. | To check before the first Hanout installer is sold (phase 9) |
| 2026-11-04 | `electron/services/productImportService.js` (`categoryId`, `checkGroup`) | The Excel import compares names with SQLite `LOWER()`, which does not lower accented letters: a sheet saying «été» does not find the category «Été», and an article «Écharpe» already in the shop is imported a second time from «écharpe». | Not changed in Boutique; Hanout compares in JS |
| 2026-11-04 | `electron/services/excelService.js` `transformValue` | A number written with a French decimal comma (`12,5`) loses its comma and becomes `125`. | Not changed in Boutique; Hanout reads `12,5` as 12.5 for stock quantities |
