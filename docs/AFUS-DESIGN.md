# The Afus look

Every Afus program looks the same: the same fonts, colours, components and rules. Afus Hanout keeps
the look of Afus Boutique exactly. The values live in `afus-design.json`, and `tests/design.test.ts`
fails when `src/index.css` or `tailwind.config.js` drift from it. To change the look on purpose,
change both files and say why in the commit.

## Fonts

- Inter Variable for Latin text, Cairo Variable for Arabic (`html.lang-ar body`).
- Bundled with the program (`@fontsource-variable/inter`, `@fontsource-variable/cairo`): no internet
  needed, the same look on Windows and macOS.

## Theme

- Dark by default; light under `html.theme-light`; or the system's choice.
- Colours are space-separated RGB CSS variables (`--surface-0` … `--zinc-950`), so Tailwind can add
  opacity. The light theme reverses the grey scale, so a screen never names a theme.
- Surfaces in Tailwind: `dark-primary` (app background), `dark-secondary` (sidebar, cards, panels),
  `dark-tertiary` (inputs, hover, raised items), `dark-border`.

| Surface | Dark | Light |
| --- | --- | --- |
| `--surface-0` | 11 11 13 | 243 244 247 |
| `--surface-1` | 19 19 22 | 255 255 255 |
| `--surface-2` | 28 28 33 | 236 237 241 |
| `--surface-border` | 38 38 44 | 222 223 229 |

## Accent colours

| Name | Value |
| --- | --- |
| primary | `#6366f1` |
| secondary | `#8b5cf6` |
| success | `#22c55e` |
| warning | `#f59e0b` |
| danger | `#ef4444` |

## Components and icons

- `src/components/ui`: Button, Input, Select, Combobox, Modal, ConfirmDialog, Table, Tabs, Card,
  Badge, StatTile, NumPad, Toast, Menu, DatePicker, PageHeader, ExcelImport, ExportButton.
- `src/components/layout`: MainLayout, Sidebar, TitleBar, HubPage, HelpButton, navItems.
- Shared classes in `src/index.css` (`@layer components`): `.btn*`, `.input*`, `.card`, `.badge*`,
  `.table*`, `.modal-*`, `.form-*`, `.stat-*`, `.page`, `.page-body`, `.segmented`, `.fit-grid*`.
- Icons: lucide-react only.
- Animations: `fade-in`, `slide-up`, `scale-in`, `pulse-soft`.

## Arabic text

- `.tabular`: numbers line up in tables and totals.
- `.ltr`: codes, phone numbers and amounts stay left-to-right inside Arabic text.
- `.flip-rtl`: arrows and chevrons point in the reading direction.

## Menu groups

Sell, Stock, Grow, Manage (`src/components/layout/navItems.js`). Each program chooses its pages; the
groups and their order stay.

## Rules

- Arabic first, then French and English, in the shop's own words.
- One button height, one-line tabs, no small scrollbars, amounts never leave their card.
- An error message says what to do next.
