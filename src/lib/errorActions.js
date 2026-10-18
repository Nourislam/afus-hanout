// What the shop worker can do about an error, in one press: the button shown
// in the error message and where it leads. Matched on the error's code (sent
// by the main process) or given by the screen itself (printing failed...).
export const ERROR_ACTIONS = {
    printer: { label: 'fix.printer', to: '/settings?tab=receipt' },
    labelPrinter: { label: 'fix.labelPrinter', to: '/settings?tab=labelPrinter' },
    backup: { label: 'fix.backup', to: '/settings?tab=backup' },
    drawer: { label: 'fix.drawer', to: '/pos' },
    websiteAccounts: { label: 'fix.websiteAccounts', to: '/website?tab=accounts' },
    website: { label: 'fix.website', to: '/website' },
};

const BY_CODE = [
    [/^PRINT_/, 'printer'],
    [/^LABEL_/, 'labelPrinter'],
    [/^BACKUP_/, 'backup'],
    [/^(SHIFT_REQUIRED|EXPENSE_MORE_THAN_DRAWER)$/, 'drawer'],
    [/^WEBSITE_(GITHUB|CLOUDFLARE)_/, 'websiteAccounts'],
    [/^WEBSITE_NOT_(CREATED|PUBLISHED)$/, 'website'],
];

/** The action for an error code, or null. */
export function actionForCode(code) {
    if (!code) return null;
    const hit = BY_CODE.find(([re]) => re.test(code));
    return hit ? ERROR_ACTIONS[hit[1]] : null;
}
