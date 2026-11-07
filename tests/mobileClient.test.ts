// The phone app's side (mobile/src): it reads the QR code shown on the till
// computer, pairs, then asks prices, counts and the day. Checked here against
// the real server of the program, so the two cannot drift apart.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import { createShop } from './helpers/shop';
import { parsePairLink, isPrivateHost, pair, createClient, HanoutError, type Connection } from '../mobile/src/client';
import { TEXTS, LANGS, tr, errorText, money, kg } from '../mobile/src/texts';

const require = createRequire(import.meta.url);
const server = require('../electron/server/localServer');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let api: any;
let running: { port: number; stop: () => Promise<void> } | null = null;

beforeEach(async () => {
    ({ api } = await createShop());
    api.run("INSERT INTO products (id, name, barcode, price, cost, stock_quantity, capped_price) VALUES ('milk', 'Lait', '6130000000011', 25, 22, 40, 25)");
    server.resetPairing();
});
afterEach(async () => { await running?.stop(); running = null; });

describe('the QR code', () => {
    it('reads the invite of the computer on the shop\'s network', () => {
        const link = server.pairingLink({ host: '192.168.1.10', port: 4560, code: '042137' });
        expect(parsePairLink(link)).toEqual({ host: '192.168.1.10', port: 4560, code: '042137' });
        expect(parsePairLink(` ${link}\n`)).toEqual({ host: '192.168.1.10', port: 4560, code: '042137' });
    });

    it('refuses another code, an address outside the shop, a bad port or code', () => {
        expect(parsePairLink('6130000000011')).toBeNull();
        expect(parsePairLink('https://example.com/pair?host=192.168.1.10&port=4560&code=123456')).toBeNull();
        expect(parsePairLink('afushanout://pair?host=8.8.8.8&port=4560&code=123456')).toBeNull();
        expect(parsePairLink('afushanout://pair?host=shop.example.com&port=4560&code=123456')).toBeNull();
        expect(parsePairLink('afushanout://pair?host=192.168.1.10&port=99999&code=123456')).toBeNull();
        expect(parsePairLink('afushanout://pair?host=192.168.1.10&port=4560&code=12345')).toBeNull();
    });

    it('private addresses only', () => {
        for (const h of ['10.0.0.5', '172.16.0.1', '172.31.255.1', '192.168.0.2', '127.0.0.1', 'localhost']) expect(isPrivateHost(h), h).toBe(true);
        for (const h of ['172.32.0.1', '11.0.0.1', '192.169.1.1', '256.1.1.1', '', 'example.com']) expect(isPrivateHost(h), h).toBe(false);
    });
});

describe('the phone and the real server', () => {
    async function start(): Promise<Connection> {
        const started = await server.start({ api, port: 0 });
        running = started;
        const { code } = server.newPairingCode();
        const invite = parsePairLink(server.pairingLink({ host: '127.0.0.1', port: started.port, code }));
        if (!invite) throw new Error('invite');
        return pair(invite, 'Redmi de Karim');
    }

    it('pairs once and reads a price', async () => {
        const conn = await start();
        expect(conn).toMatchObject({ host: '127.0.0.1', role: 'phone' });
        expect(conn.token).toMatch(/^[a-f0-9]{48}$/);
        const client = createClient(conn);
        expect(await client.price('6130000000011')).toMatchObject({ name: 'Lait', price: 25, unit: 'piece', capped: 25 });
        expect(await client.price('0000000000000')).toBeNull();
        // The same code again: used
        const invite = { host: conn.host, port: conn.port, code: '000000' };
        await expect(pair(invite, 'x')).rejects.toMatchObject({ code: 'PAIR_CODE', status: 403 });
    });

    it('counts into the open stock count, and says when none is open', async () => {
        const client = createClient(await start());
        await expect(client.count('6130000000011')).rejects.toMatchObject({ code: 'COUNT_NONE' });
        require('../electron/services/stockCountService').startCount(api, {});
        const line = await client.count('6130000000011', 3);
        expect(line).toMatchObject({ product_name: 'Lait', counted: 3, expected: 40 });
        await expect(client.count('999')).rejects.toMatchObject({ code: 'COUNT_CODE_UNKNOWN' });
    });

    it('reads the day', async () => {
        const client = createClient(await start());
        expect(await client.today()).toEqual({ sales: 0, profit: 0, tickets: 0 });
    });

    it('a phone removed on the computer is told it is no longer paired', async () => {
        const conn = await start();
        server.removeDevice(api, api.get('SELECT id FROM paired_devices').id);
        await expect(createClient(conn).price('6130000000011')).rejects.toMatchObject({ code: 'NOT_PAIRED', status: 401 });
    });

    it('a computer that does not answer is OFFLINE', async () => {
        const failing = () => Promise.reject(new Error('ECONNREFUSED'));
        const client = createClient({ host: '192.168.1.10', port: 4560, token: 'x', role: 'phone', shop: '' }, failing);
        const error = await client.today().catch(e => e);
        expect(error).toBeInstanceOf(HanoutError);
        expect(error.code).toBe('OFFLINE');
    });
});

describe('the phone app\'s words', () => {
    it('every text in Arabic, French and English, none empty', () => {
        for (const [key, texts] of Object.entries(TEXTS)) {
            expect(texts, key).toHaveLength(LANGS.length);
            for (const text of texts) expect(text.trim(), key).not.toBe('');
        }
    });

    it('every refusal of the server has its message', () => {
        for (const code of ['OFFLINE', 'PAIR_CODE', 'NOT_PAIRED', 'ROLE', 'COUNT_NONE', 'NOT_FOUND', 'PHOTO', 'SERVER']) {
            expect(Object.keys(TEXTS)).toContain(`error.${code}`);
            expect(errorText('ar', code)).toBe(tr('ar', `error.${code}` as keyof typeof TEXTS));
        }
        // An unknown refusal: the general message
        expect(errorText('fr', 'SOMETHING')).toBe(tr('fr', 'error.SERVER'));
    });

    it('fills placeholders, writes dinars and kg like the till', () => {
        expect(tr('fr', 'paired', { shop: 'Hanout Karim' })).toBe('Associé à Hanout Karim');
        expect(money(2500, 'fr')).toBe('2 500 DA');
        expect(money(2500, 'ar')).toBe('2 500 د.ج');
        expect(money(12.5, 'fr')).toBe('12,50 DA');
        expect(kg(1250, 'fr')).toBe('1,250 kg');
    });
});
