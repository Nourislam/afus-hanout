// A shop add-on turned on must show: its page is in the menu even in the
// simple menu, and the add-ons come first in Settings › Modules.
import { describe, it, expect } from 'vitest';
import { addonPaths, ADDON_PAGES, ADDON_LINKS, MODULE_GROUPS, DEFAULT_FEATURES } from '../src/lib/features';
import { SIMPLE_PATHS } from '../src/lib/uiMode';

describe('shop add-ons in the menu', () => {
    it('no page added while the add-ons are off (the default)', () => {
        expect(addonPaths(DEFAULT_FEATURES)).toEqual([]);
    });
    it('commissions brings Employees, which the simple menu does not have', () => {
        expect(SIMPLE_PATHS).not.toContain('/employees');
        expect(addonPaths({ ...DEFAULT_FEATURES, commissions: true })).toEqual(['/employees']);
        expect(addonPaths({ charges: true, commissions: true })).toEqual(['/reports', '/employees']);
    });
    it('every add-on has a page and an "Open" link, and the group is first', () => {
        const addons = MODULE_GROUPS[0];
        expect(addons.id).toBe('addons');
        for (const key of addons.modules) {
            expect(ADDON_PAGES[key]).toMatch(/^\//);
            expect(ADDON_LINKS[key].startsWith(ADDON_PAGES[key])).toBe(true);
            expect(DEFAULT_FEATURES[key]).toBe(false);
        }
    });
});
