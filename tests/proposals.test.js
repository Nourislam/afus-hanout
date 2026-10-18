// The review's proposals: the weekly USB copy reminder, the "fix it" button of
// an error, the sales screen's quick buttons (the week's best sellers).
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { backupReminder, USB_EVERY_DAYS } from '../src/lib/backupReminder';
import { translateError, codeOfMessage } from '../src/i18n/errors';
import { actionForCode } from '../src/lib/errorActions';
import { createShop, sell } from './helpers/shop';

const require = createRequire(import.meta.url);
const { bestSellers } = require('../electron/services/storeRankings');
const DAY = 86400000;

describe('backup reminder', () => {
    const now = new Date('2026-10-18T10:00:00Z');
    const recent = new Date(now.getTime() - DAY).toISOString();
    it('a recent backup but never on a USB key: once a week, copy it (one press)', () => {
        expect(backupReminder({ lastBackupAt: recent, external: null }, now)).toEqual({ key: 'dash.alert.usbWeekly', usb: true });
        const usb = new Date(now.getTime() - 2 * DAY).toISOString();
        expect(backupReminder({ lastBackupAt: recent, external: { ok: true, at: usb } }, now)).toBeNull();
        const old = new Date(now.getTime() - USB_EVERY_DAYS * DAY).toISOString();
        expect(backupReminder({ lastBackupAt: recent, external: { ok: true, at: old } }, now)?.usb).toBe(true);
    });
    it('the older reminders come first; the demo shop is never reminded', () => {
        expect(backupReminder({ lastBackupAt: null }, now).key).toBe('dash.alert.noBackup');
        expect(backupReminder({ lastBackupAt: recent, external: { ok: false, at: recent } }, now).key).toBe('dash.alert.externalBackup');
        expect(backupReminder({ demo: true }, now)).toBeNull();
    });
});

describe('an error says what to do', () => {
    it('the message keeps its code, and the code gives the button', () => {
        const text = translateError(new Error('BACKUP_EXTERNAL_MISSING|{}'));
        expect(codeOfMessage(text)).toBe('BACKUP_EXTERNAL_MISSING');
        expect(actionForCode('BACKUP_EXTERNAL_MISSING')).toMatchObject({ to: '/settings?tab=backup' });
        expect(actionForCode('PRINT_FAILED')).toMatchObject({ to: '/settings?tab=receipt' });
        expect(actionForCode('WEBSITE_GITHUB_NOT_CONNECTED')).toMatchObject({ to: '/website?tab=accounts' });
        expect(actionForCode('SHIFT_REQUIRED')).toMatchObject({ to: '/pos' });
        expect(actionForCode('STOCK_INSUFFICIENT')).toBeNull();
        expect(codeOfMessage('any other text')).toBeNull();
    });
});

describe('quick buttons on the sales screen', () => {
    it('the 8 articles sold most these 7 days, most sold first', async () => {
        const { api, v } = await createShop();
        sell(api, 's1', [{ product: 'belt', qty: 3, price: 800, name: 'Ceinture', cost: 300 }]);
        sell(api, 's2', [{ product: 'jean', variant: v['J-N-38'], qty: 1, price: 3000 }]);
        expect(bestSellers(api, { limit: 8 }).map(r => r.id)).toEqual(['belt', 'jean']);
    });
});
