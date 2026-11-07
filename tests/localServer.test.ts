// The shop's own server, on its WiFi: a phone or a price-checker tablet pairs
// once with a code shown on the till computer (as a QR code), then asks
// prices, counts the shelves and sees the day. Nothing outside the shop's
// network is answered, and nothing without a paired device's token.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import { createShop } from './helpers/shop';

const require = createRequire(import.meta.url);
const server = require('../electron/server/localServer');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let api: any;
const LAN = '192.168.1.20';

beforeEach(async () => {
    ({ api } = await createShop());
    api.run("INSERT INTO products (id, name, barcode, price, cost, stock_quantity, capped_price) VALUES ('milk', 'Lait', '6130000000011', 25, 22, 40, 25)");
    server.resetPairing();
});

const req = (method: string, path: string, { body = null, token = '', remote = LAN }: { body?: unknown; token?: string; remote?: string } = {}) =>
    server.handle(api, { method, path, body, remote, headers: token ? { authorization: `Bearer ${token}` } : {} });

async function paired(role = 'phone') {
    const { code } = server.newPairingCode();
    const res = await req('POST', '/api/pair', { body: { code, name: 'Samsung', role } });
    return res.json.token as string;
}

describe('pairing', () => {
    it('the code shown on the computer pairs one device once; a wrong or used code is refused', async () => {
        const { code } = server.newPairingCode();
        expect((await req('POST', '/api/pair', { body: { code: '000000', name: 'x' } })).status).toBe(403);
        const ok = await req('POST', '/api/pair', { body: { code, name: 'Samsung de Karim', role: 'phone' } });
        expect(ok.status).toBe(200);
        expect(ok.json.token).toMatch(/^[a-f0-9]{48}$/);
        expect((await req('POST', '/api/pair', { body: { code, name: 'again' } })).status).toBe(403);
        // Only the token's hash is kept
        const device = api.get('SELECT name, role, token_hash FROM paired_devices');
        expect(device).toMatchObject({ name: 'Samsung de Karim', role: 'phone' });
        expect(device.token_hash).not.toContain(ok.json.token);
    });

    it('a code is good for 10 minutes', async () => {
        const { code } = server.newPairingCode(Date.now() - 11 * 60000);
        expect((await req('POST', '/api/pair', { body: { code, name: 'late' } })).status).toBe(403);
    });

    it('5 wrong codes cancel the code: nobody on the WiFi can try them all', async () => {
        const { code } = server.newPairingCode();
        const wrong = code === '000000' ? '111111' : '000000';
        for (let i = 0; i < 5; i++) expect((await req('POST', '/api/pair', { body: { code: wrong, name: 'x' } })).status).toBe(403);
        expect((await req('POST', '/api/pair', { body: { code, name: 'owner' } })).status).toBe(403);
        // A new code works again
        const fresh = server.newPairingCode().code;
        expect((await req('POST', '/api/pair', { body: { code: fresh, name: 'owner' } })).status).toBe(200);
    });

    it('the pairing link of the QR code carries the address, the port and the code', () => {
        expect(server.pairingLink({ host: '192.168.1.10', port: 4560, code: '123456' })).toBe('afushanout://pair?host=192.168.1.10&port=4560&code=123456');
        expect(server.kioskLink({ host: '192.168.1.10', port: 4560 })).toBe('http://192.168.1.10:4560/kiosk');
    });
});

describe('what a paired device can ask', () => {
    it('a price, by barcode, with the official price; nothing without a token', async () => {
        expect((await req('GET', '/api/price?code=6130000000011')).status).toBe(401);
        const token = await paired('kiosk');
        const res = await req('GET', '/api/price?code=6130000000011', { token });
        expect(res.status).toBe(200);
        expect(res.json).toMatchObject({ name: 'Lait', price: 25, unit: 'piece', capped: 25 });
        expect((await req('GET', '/api/price?code=999', { token })).status).toBe(404);
    });

    it('the phone counts the shelves into the open stock count; a price checker cannot', async () => {
        const phone = await paired('phone');
        expect((await req('POST', '/api/count', { token: phone, body: { code: '6130000000011' } })).status).toBe(409);
        require('../electron/services/stockCountService').startCount(api, {});
        const res = await req('POST', '/api/count', { token: phone, body: { code: '6130000000011' } });
        expect(res.status).toBe(200);
        expect(res.json).toMatchObject({ product_name: 'Lait', counted: 1 });
        const kiosk = await paired('kiosk');
        expect((await req('POST', '/api/count', { token: kiosk, body: { code: '6130000000011' } })).status).toBe(403);
    });

    it('the day on the phone: what was sold and earned', async () => {
        const phone = await paired('phone');
        const res = await req('GET', '/api/today', { token: phone });
        expect(res.status).toBe(200);
        expect(res.json).toHaveProperty('sales');
        expect(res.json).toHaveProperty('profit');
        expect(res.json).toHaveProperty('tickets');
    });

    it('nothing is answered outside the network of the shop', async () => {
        const token = await paired('kiosk');
        expect((await req('GET', '/api/price?code=6130000000011', { token, remote: '8.8.8.8' })).status).toBe(403);
        expect((await req('GET', '/kiosk', { remote: '41.200.10.3' })).status).toBe(403);
        expect((await req('GET', '/kiosk', { remote: '::ffff:192.168.1.30' })).status).toBe(200);
    });

    it('a removed device is no longer answered', async () => {
        const token = await paired('kiosk');
        const id = api.get('SELECT id FROM paired_devices').id;
        server.removeDevice(api, id);
        expect((await req('GET', '/api/price?code=6130000000011', { token })).status).toBe(401);
    });
});

describe('the real server', () => {
    let running: { port: number; stop: () => Promise<void> } | null = null;
    afterEach(async () => { await running?.stop(); running = null; });

    it('listens on the given port and serves the price checker page', async () => {
        const started = await server.start({ api, port: 0 });
        running = started;
        const res = await fetch(`http://127.0.0.1:${started.port}/kiosk`);
        expect(res.status).toBe(200);
        expect(await res.text()).toContain('<html');
    });
});
