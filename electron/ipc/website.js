// IPC handlers: website. Moved out of main.js unchanged; main.js passes what they use.
module.exports = function register(ctx) {
    const {
        BrowserWindow,
        dialog,
        fs,
        getSettingValue,
        getShopSettingsForPrint,
        githubTestBase,
        ipcMain,
        labelService,
        printDocument,
        printerError,
        shell,
        shopT,
        website,
    } = ctx;

    // What a WhatsApp message or a courier's tracking page opens (https and the known addresses only)
    const openOutside = (url, hosts) => {
      let u;
      try { u = new URL(String(url)); } catch { return false; }
      if (u.protocol !== 'https:' || (hosts && !hosts.includes(u.hostname))) return false;
      shell.openExternal(u.toString());
      return true;
    };
    ipcMain.handle('website:getState', () => website.view());
    ipcMain.handle('website:preview', () => website.preview());
    // The built-in photos (Website › Pictures): name and picture, to choose from
    // heroDefault: the photo the theme picks by itself for the home page
    ipcMain.handle('website:photos', (_, theme) => {
      const { PHOTO_FILES, photoDataUrl, heroPhoto } = require('../website/storefront/photos');
      const hero = heroPhoto(String(theme || ''));
      return PHOTO_FILES.map(file => ({ file, src: photoDataUrl(file), heroDefault: file === hero })).filter(p => p.src);
    });
    // A page's built-in text (Website › Pages), to start from
    ipcMain.handle('website:pageDefault', (_, id) => {
      const { legalText } = require('../website/storefront/legal');
      const store = getSettingValue('store_config') || {};
      return legalText(String(id || ''), store.defaultLanguage || 'ar', { name: store.businessName || '', email: store.businessEmail || '', phone: store.businessPhone || '' });
    });
    ipcMain.handle('website:previewTheme', (_, args = {}) => website.previewTheme(args));
    ipcMain.handle('website:create', (_, args = {}) => website.create(args));
    ipcMain.handle('website:setTheme', (_, theme, options = {}) => website.setTheme(theme, { publish: !!options?.publish }));
    ipcMain.handle('website:setName', (_, name) => website.setName(name));
    ipcMain.handle('website:setDomain', (_, domain) => website.setDomain(domain));
    ipcMain.handle('website:removeDomain', () => website.removeDomain());
    ipcMain.handle('website:domainCheck', () => website.domainCheck());
    ipcMain.handle('website:domainRetry', () => website.domainRetry());
    ipcMain.handle('website:domainSearch', (_, args = {}) => website.domainSearch(args || {}));
    ipcMain.handle('website:domainOpenBuy', (_, args = {}) => website.domainOpenBuy(args || {}));
    // The shop's own Hostinger account: its key goes from the window to the main process once, then stays encrypted here
    ipcMain.handle('website:domainHostingerLink', (_, args = {}) => website.domainHostingerLink({ token: typeof args?.token === 'string' ? args.token : '' }));
    ipcMain.handle('website:domainHostingerForget', () => website.domainHostingerForget());
    ipcMain.handle('website:domainHostingerSetup', () => website.domainHostingerSetup());
    ipcMain.handle('website:update', () => website.update());
    ipcMain.handle('website:connect', (_, provider) => website.connect(provider));
    ipcMain.handle('website:githubStart', () => website.githubStart());
    ipcMain.handle('website:githubCancel', () => website.githubCancel());
    ipcMain.handle('website:githubDisconnect', () => website.githubDisconnect());
    ipcMain.handle('website:githubCheck', () => website.githubCheck());
    ipcMain.handle('website:githubOpen', async () => {
      const url = website.githubFlowPage();
      if (url && url.startsWith(`${website.githubClientBase()}/`)) await shell.openExternal(url);
      return { opened: !!url };
    });
    // GitHub's own page where the shop sees (and can withdraw) the access given
    ipcMain.handle('website:githubManage', async () => {
      await shell.openExternal(website.githubManageUrl());
      return { opened: true };
    });
    // Link with a key the shop made itself on the provider's page (the key goes to the main process only)
    ipcMain.handle('website:githubConnectToken', (_, { token } = {}) => website.githubConnectToken({ token }));
    ipcMain.handle('website:cloudflareConnectToken', (_, { token } = {}) => website.cloudflareConnectToken({ token }));
    // The provider's own page to make that key, already filled in, or to open a free account
    // (only GitHub's or Cloudflare's address)
    ipcMain.handle('website:openTokenPage', async (_, { provider, page } = {}) => {
      const url = page === 'signup' ? website.signupPage(provider) : website.tokenPage(provider);
      // Only the provider's own site (the same as its page for managing the access)
      const home = provider === 'github' ? website.githubManageUrl() : provider === 'cloudflare' ? website.cloudflareManageUrl() : null;
      const origin = (u) => { try { return new URL(u).origin; } catch { return null; } };
      if (!url || !home || origin(url) !== origin(home)) return { opened: false };
      await shell.openExternal(url);
      return { opened: true };
    });
    ipcMain.handle('website:publish', () => website.publishSite());
    ipcMain.handle('website:setPublicInfo', (_, info = {}) => website.setPublicInfo(info));
    ipcMain.handle('website:setFeatures', (_, features = {}) => website.setFeatures(features));
    ipcMain.handle('website:recheck', () => website.recheckSite());
    ipcMain.handle('website:changes', () => website.changes());
    ipcMain.handle('website:orders', (_, args = {}) => website.orders(args || {}));
    ipcMain.handle('website:setSettings', (_, part = {}) => website.setSettings(part || {}));
    ipcMain.handle('website:blockPhone', (_, args = {}) => website.blockPhone(args || {}));
    ipcMain.handle('website:unblockPhone', (_, args = {}) => website.unblockPhone(args || {}));
    ipcMain.handle('website:blockSuggestions', () => website.blockSuggestions());
    ipcMain.handle('website:confirmMessage', (_, args = {}) => {
      const m = website.confirmMessage(args || {});
      return { ...m, opened: args?.open ? openOutside(m.url, ['wa.me']) : false };
    });
    ipcMain.handle('website:setTracking', (_, args = {}) => website.setTracking({ id: args?.id, number: args?.number }));
    ipcMain.handle('website:openTracking', (_, url) => openOutside(url));
    ipcMain.handle('website:yalidineLink', (_, args = {}) => website.yalidineLink(args || {}));
    ipcMain.handle('website:yalidineForget', () => website.yalidineForget());
    ipcMain.handle('website:yalidineSend', (_, args = {}) => website.yalidineSend(args || {}));
    ipcMain.handle('website:yalidineRefresh', (_, args = {}) => website.yalidineRefresh(args || {}));
    ipcMain.handle('website:stats', (_, args = {}) => website.stats(args || {}));
    ipcMain.handle('website:customers', (_, args = {}) => website.customers(args || {}));
    ipcMain.handle('website:confirmOrder', (_, args = {}) => website.confirmOrder(args || {}));
    ipcMain.handle('website:updateOrder', (_, args = {}) => website.updateOrder(args || {}));
    ipcMain.handle('website:orderChoices', (_, args = {}) => website.orderChoices(args || {}));
    // The shipping label of a website order (100 x 150 mm): HTML for the preview,
    // the system print dialog (any printer), or a PDF
    function websiteLabelHtml(id) {
      const { labelHtml } = require('../website/orders/shippingLabel');
      const order = website.labelData({ id });
      const shop = getShopSettingsForPrint();
      return labelHtml({
        order,
        lang: ['ar', 'fr', 'en'].includes(shop.defaultLanguage) ? shop.defaultLanguage : 'ar',
        shop: { name: shop.businessName || '', phone: shop.businessPhone || '', logo: shop.shopLogoDataUri || '', currency: shop.currency || 'DZD' },
        codes: { barcode: (t) => labelService.codeSvg('code128', t, { includeText: false, height: 14 }), qr: (t) => labelService.qrSvg(t) },
      });
    }
    ipcMain.handle('website:labelHtml', (_, args = {}) => websiteLabelHtml(args?.id));
    ipcMain.handle('website:printLabel', async (_, args = {}) => {
      const html = websiteLabelHtml(args?.id);
      const win = printDocument.hiddenWindow(BrowserWindow, { javascript: false });
      try {
        await printDocument.loadHtml(win, html);
        // The dialog: the shop chooses the printer (label printer 100 x 150 mm, or an office printer)
        const result = await printDocument.printContents(win.webContents, {
          silent: false, printBackground: true, margins: { marginType: 'none' }, pageSize: { width: 100000, height: 150000 },
        });
        if (result.success) website.labelPrinted({ id: args.id });
        return result.success;
      } catch (error) {
        throw printerError(error, '');
      } finally {
        if (!win.isDestroyed()) win.destroy();
      }
    });
    ipcMain.handle('website:saveLabelPdf', async (_, args = {}) => {
      const html = websiteLabelHtml(args?.id);
      const order = website.labelData({ id: args?.id });
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: shopT('dialog.saveLabels'), defaultPath: `${order.number || 'order'}.pdf`,
        filters: [{ name: shopT('dialog.pdfFiles'), extensions: ['pdf'] }],
      });
      if (canceled || !filePath) return null;
      const win = printDocument.hiddenWindow(BrowserWindow, { javascript: false });
      try {
        await printDocument.loadHtml(win, html);
        const pdf = await win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, pageSize: { width: 100 / 25.4, height: 150 / 25.4 }, margins: { top: 0, bottom: 0, left: 0, right: 0 } });
        await fs.promises.writeFile(filePath, pdf);
        website.labelPrinted({ id: args.id });
        return filePath;
      } finally {
        if (!win.isDestroyed()) win.destroy();
      }
    });
    ipcMain.handle('website:customerHistory', (_, args = {}) => website.customerHistory(args || {}));
    ipcMain.handle('website:setOrderStatus', (_, args = {}) => website.setOrderStatus(args));
    ipcMain.handle('website:checkReturn', (_, args = {}) => website.checkReturn(args || {}));
    // The shop's own published website, in the browser (its address comes from GitHub Pages)
    ipcMain.handle('website:openSite', async () => {
      const url = website.view().site.url;
      // Always https (GitHub Pages); the local test server of development tests only
      const testBase = githubTestBase();
      const allowed = url && (/^https:\/\//.test(url) || (testBase && url.startsWith(`${testBase}/`)));
      if (allowed) await shell.openExternal(url);
      return { opened: !!allowed };
    });
    ipcMain.handle('website:cloudflareStart', () => website.cloudflareStart());
    ipcMain.handle('website:cloudflareCancel', () => website.cloudflareCancel());
    ipcMain.handle('website:cloudflareChoose', (_, accountId) => website.cloudflareChoose(accountId));
    ipcMain.handle('website:cloudflareDisconnect', () => website.cloudflareDisconnect());
    ipcMain.handle('website:cloudflareCheck', () => website.cloudflareCheck());
    ipcMain.handle('website:cloudflareOpen', async () => {
      const url = website.cloudflareFlowPage();
      if (url && url.startsWith(`${website.cloudflareDashBase()}/oauth2/auth?`)) await shell.openExternal(url);
      return { opened: !!url };
    });
    ipcMain.handle('website:cloudflareManage', async () => {
      await shell.openExternal(website.cloudflareManageUrl());
      return { opened: true };
    });
};
