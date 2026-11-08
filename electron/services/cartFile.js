/**
 * The open cart kept on disk (انقطاع الكهرباء): the sales screen sends it on
 * every change and reads it back after a restart. The browser's own storage
 * writes seconds late and loses them when the power goes, so this is a small
 * file next to the shop's database, written whole (a temporary file flushed
 * to the disk, then renamed): after a cut it holds the last cart or the one
 * before, never half of one. null erases it (ticket paid or put on hold).
 */
const fs = require('fs');

function keepCart(file, payload) {
    if (payload === null || payload === undefined) {
        try { fs.unlinkSync(file); } catch { /* nothing kept */ }
        return true;
    }
    const tmp = `${file}.tmp`;
    const fd = fs.openSync(tmp, 'w');
    try {
        fs.writeSync(fd, JSON.stringify(payload));
        fs.fsyncSync(fd);
    } finally {
        fs.closeSync(fd);
    }
    fs.renameSync(tmp, file);
    return true;
}

/** The cart kept, or null (none, or a damaged file). */
function keptCart(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

module.exports = { keepCart, keptCart };
