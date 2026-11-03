# Problems found in Afus Boutique

Found while building Afus Hanout. Nothing is fixed in Boutique from here: each line is for Islam to
decide. A fix marked `core:` in Hanout can be cherry-picked into Boutique as it is.

| Date | Where | Problem | In Hanout |
| --- | --- | --- | --- |
| 2026-11-03 | `SECURITY.md` | Says employee PINs are stored without hashing; they are hashed since migration `2026_10_hash_pins`. The supported versions table says 1.1.x while the program is 1.5.0. | Not yet (phase 1 rewrites SECURITY.md) |
| 2026-11-03 | `.github/workflows/build-windows-installer.yml` | The artifact name is fixed at `Afus-Boutique-Setup-1.2.0-win`, and the workflow also runs on pushes to an old feature branch. | Fixed: artifact named from `package.json`, Actions tab only |
| 2026-11-03 | `electron/database/init.js` | The demo shop file is written by hand as `afus-boutique-demo.db` instead of from `brand.json`. | Fixed in `core:` commit e22bbf2 |
| 2026-11-03 | `tests/brand.test.js`, `backup.test.js`, `demo.test.js`, `documents.test.js` | File names and the receipt's product line written as Boutique's instead of read from `brand.json`. | Fixed in `core:` commit 0ed326d |
| 2026-11-03 | `package.json` | `xlsx` is installed from `https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz` ("latest", not npm): an install fails wherever that host is not reachable. | Not changed |
| 2026-11-03 | `src/index.css` | The reduced-motion rule covers only `.training-glow`, a leftover of the training mode that was removed. | Not changed |
