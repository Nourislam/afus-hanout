// IPC handlers: the open cart kept on disk for a power cut (services/cartFile.js),
// next to the shop's database (the demo shop has its own).
module.exports = function register(ctx) {
    const { ipcMain, getDbPath } = ctx;
    const { keepCart, keptCart } = require('../services/cartFile');
    const file = () => `${getDbPath()}.open-cart.json`;
    ipcMain.handle('cart:keep', (_, payload) => keepCart(file(), payload && typeof payload === 'object' ? payload : null));
    ipcMain.handle('cart:kept', () => keptCart(file()));
};
