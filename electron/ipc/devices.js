// IPC handlers: the shop's devices on its WiFi (phone, price checker),
// served by electron/server/localServer.js. Off until the owner turns it on.
module.exports = function register(ctx) {
    const {
        dbApi,
        getSettingValue,
        ipcMain,
        saveSettingValue,
    } = ctx;
    const server = require('../server/localServer');
    const { scaleFormat } = require('../shared/scaleBarcode.ts');
    let running = null;

    const settings = () => ({ enabled: false, port: server.DEFAULT_PORT, ...(getSettingValue('local_server') || {}) });

    // A photo taken by the phone becomes the article's picture (resized like the others)
    const savePhoto = async (productId, buffer) => {
        const saved = await require('../services/imageService').saveImage(buffer.toString('base64'), `phone-${String(productId).replace(/[^\w-]/g, '')}.jpg`);
        if (!saved?.success) throw new Error('PHOTO');
        return saved.fileName;
    };

    async function startServer() {
        if (running) return running;
        running = await server.start({
            api: dbApi, port: Number(settings().port) || server.DEFAULT_PORT,
            ctx: { scaleFormat: scaleFormat(getSettingValue('scale_barcode')), savePhoto },
        });
        return running;
    }
    async function stopServer() {
        if (running) await running.stop();
        running = null;
    }

    const status = () => ({
        enabled: !!settings().enabled,
        running: !!running,
        port: running ? running.port : Number(settings().port) || server.DEFAULT_PORT,
        addresses: server.lanAddresses(),
        devices: server.devices(dbApi),
    });

    ipcMain.handle('devices:status', () => status());
    ipcMain.handle('devices:enable', async (_, on) => {
        saveSettingValue('local_server', { ...settings(), enabled: !!on });
        if (on) await startServer(); else await stopServer();
        return status();
    });
    // A pairing code and its QR code (one per address of this computer on the shop's network)
    ipcMain.handle('devices:pairingCode', async (_, chosen) => {
        if (!running) await startServer();
        const { code, expiresAt } = server.newPairingCode();
        // The address the owner chose (one of this computer's), else the first one
        const addresses = server.lanAddresses();
        const host = addresses.includes(chosen) ? chosen : addresses[0] || '127.0.0.1';
        const link = server.pairingLink({ host, port: running.port, code });
        let qr = '';
        try { qr = require('bwip-js').toSVG({ bcid: 'qrcode', text: link, scale: 4, paddingwidth: 2, paddingheight: 2 }); } catch { /* the code is shown in figures */ }
        return { code, expiresAt, link, qr, kiosk: server.kioskLink({ host, port: running.port }) };
    });
    ipcMain.handle('devices:remove', (_, id) => { server.removeDevice(dbApi, id); return status(); });

    return {
        // After the database is open: the server comes back on if the owner left it on
        autoStart: () => { if (settings().enabled) startServer().catch(error => console.error('Local server:', error)); },
        stop: stopServer,
    };
};
