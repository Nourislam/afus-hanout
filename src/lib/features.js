// Optional modules (Settings › Modules). A hidden module disappears from the
// menu, the tabs and the buttons that lead to it; its data stays in place and
// comes back when the module is shown again.
export const DEFAULT_FEATURES = {
    credit: true,          // customer credit (debts)
    customers: true,       // customer list in the Catalogue
    promotions: true,      // discounts (Offers)
    bundles: true,         // packs (Offers)
    giftCards: false,      // gift cards (Offers)
    suppliers: true,       // supplier list in the Catalogue
    purchaseOrders: true,  // purchase orders (needs suppliers)
    // Shop add-ons: off until the owner turns them on
    charges: false,        // shop charges (rent, salaries, bills) and the month's net profit
    commissions: false,    // employees' commissions, monthly goals, employee of the month
};

// The page where each shop add-on lives. While the add-on is on, its page is in
// the menu even in the simple menu (otherwise turning it on would show nothing).
export const ADDON_PAGES = { charges: '/reports', commissions: '/employees' };

/** Where "Open" goes once an add-on is turned on (its own tab). */
export const ADDON_LINKS = { charges: '/reports?tab=net', commissions: '/employees?view=goals' };

/** Pages the add-ons that are on need in the menu. */
export const addonPaths = (features = {}) => Object.entries(ADDON_PAGES).filter(([key]) => features?.[key] === true).map(([, path]) => path);

// How the modules are shown in Settings (the shop add-ons first: they are what an owner looks for)
export const MODULE_GROUPS = [
    { id: 'addons', modules: ['charges', 'commissions'] },
    { id: 'sales', modules: ['credit', 'customers'] },
    { id: 'offers', modules: ['promotions', 'bundles', 'giftCards'] },
    { id: 'stock', modules: ['suppliers', 'purchaseOrders'] },
];

// A module that cannot work without another one
export const MODULE_REQUIRES = { purchaseOrders: 'suppliers' };

/** The shop's choices, with the defaults for modules never set (unknown keys are dropped). */
export function resolveFeatures(saved) {
    const source = saved && typeof saved === 'object' ? saved : {};
    const out = {};
    for (const key of Object.keys(DEFAULT_FEATURES)) out[key] = typeof source[key] === 'boolean' ? source[key] : DEFAULT_FEATURES[key];
    return out;
}

/** What is really shown: a module whose required module is hidden is hidden too. */
export function effectiveFeatures(features) {
    const out = { ...resolveFeatures(features) };
    for (const [key, needs] of Object.entries(MODULE_REQUIRES)) if (!out[needs]) out[key] = false;
    return out;
}

/** The Offers screen exists only while one of its parts is shown. */
export const offersEnabled = (features = {}) => !!(features.promotions || features.bundles || features.giftCards);
