// IPC handlers: shops link (the owner's other shops). The owner only (ipcGuard).
module.exports = function register(ctx) {
    const { ipcMain, shops } = ctx;

    ipcMain.handle('shops:view', () => shops.view());
    ipcMain.handle('shops:connectMain', (_, { token, groupName } = {}) => shops.connectMain({ token, groupName }));
    ipcMain.handle('shops:newCode', (_, { shopName } = {}) => shops.newCode({ shopName }));
    ipcMain.handle('shops:pushCatalog', () => shops.pushCatalog());
    ipcMain.handle('shops:list', () => shops.listShops());
    ipcMain.handle('shops:remove', (_, id) => shops.removeShop(id));
    ipcMain.handle('shops:join', (_, { code, shopName } = {}) => shops.join({ code, shopName }));
    ipcMain.handle('shops:pullCatalog', () => shops.pullCatalog());
    ipcMain.handle('shops:leave', () => shops.leave());
};
