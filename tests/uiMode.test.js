import { describe, it, expect } from 'vitest';
import { resolveUiMode, SIMPLE_PATHS } from '../src/lib/uiMode';

describe('simple / full menu', () => {
    it('keeps the full menu for shops set up before the option, and accepts only known modes', () => {
        expect(resolveUiMode(undefined)).toBe('full');
        expect(resolveUiMode('simple')).toBe('simple');
        expect(resolveUiMode('full')).toBe('full');
        expect(resolveUiMode('other')).toBe('full');
    });
    it('shows sales, articles, stock, labels, credit and reports in simple mode', () => {
        expect(SIMPLE_PATHS).toEqual(['/pos', '/products', '/inventory', '/labels', '/credit-sales', '/reports']);
    });
});

describe('simple menu pages', () => {
    it('keeps the default pages until the owner chooses, and always the sales screen', async () => {
        const { resolveSimplePages, SIMPLE_PATHS } = await import('../src/lib/uiMode.js');
        expect(resolveSimplePages(undefined)).toEqual(SIMPLE_PATHS);
        expect(resolveSimplePages(['/customers', '/customers', 'x', 3])).toEqual(['/pos', '/customers']);
        expect(resolveSimplePages([])).toEqual(['/pos']);
    });
});
