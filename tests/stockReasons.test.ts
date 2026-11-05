// The family takes from the shop: «استهلاك العائلة» is its own reason for a
// stock going down, apart from losses (damaged, loss / theft).
import { describe, it, expect } from 'vitest';
import { MANUAL_REASONS, stockReasonLabel } from '../src/lib/stockReasons';
import { translate } from '../src/i18n';

describe('stock reasons', () => {
    it('«family consumption» is offered and named in the three languages', () => {
        expect(MANUAL_REASONS).toContain('family');
        expect(stockReasonLabel('family')).not.toBe('family');
        expect(translate('ar', 'stock.reason.family')).toBe('استهلاك العائلة');
        expect(translate('fr', 'stock.reason.family')).toBe('Consommation de la famille');
    });
});
