import { BACKUP_OLD_DAYS } from './dashboard';

const DAY = 24 * 60 * 60 * 1000;
export const USB_EVERY_DAYS = 7;

/**
 * What to remind the owner about the backups, or null when all is well.
 * status: { demo, lastBackupAt, external: { ok, at } | null }
 * Once a week: a copy on a USB key (the computer can break or be stolen).
 */
export function backupReminder(status, now = new Date()) {
    if (!status || status.demo) return null;
    if (!status.lastBackupAt) return { key: 'dash.alert.noBackup' };
    const days = Math.floor((now.getTime() - new Date(status.lastBackupAt).getTime()) / DAY);
    if (days >= BACKUP_OLD_DAYS) return { key: 'dash.alert.oldBackup', params: { n: days } };
    if (status.external && status.external.ok === false) return { key: 'dash.alert.externalBackup' };
    const usbAt = status.external && status.external.ok ? new Date(status.external.at).getTime() : 0;
    if (now.getTime() - usbAt >= USB_EVERY_DAYS * DAY) return { key: 'dash.alert.usbWeekly', usb: true };
    return null;
}
