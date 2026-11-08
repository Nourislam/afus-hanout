/**
 * The phone's side of the shop's own server (electron/server/localServer.js).
 *
 * The phone holds no database: it asks the till computer, on the shop's WiFi
 * only. It pairs once by scanning the QR code shown on the computer
 * (Settings › Phone and price checker), which carries
 *   afushanout://pair?host=192.168.1.10&port=4560&code=123456
 * and keeps the token it is given. Nothing here imports React Native, so the
 * desktop project's tests check it against the real server.
 */

export type Role = 'phone' | 'kiosk';

/** What the QR code carries. */
export interface Invite { host: string; port: number; code: string }

/** The paired computer, kept on the phone (expo-secure-store). */
export interface Connection { host: string; port: number; token: string; role: Role; shop: string }

export interface Price {
    id: string; name: string; price: number; unit: 'piece' | 'kg' | 'service';
    capped: number | null;
    carton: { qty: number; price: number } | null;
    image: string | null;
    scale?: { grams: number; price?: number };
    /** «2.5 ألف» when the shop shows prices in centimes too */
    centimes?: string | null;
}

export interface CountLine {
    id: string; product_name: string; unit: 'piece' | 'kg';
    expected: number; counted: number; difference: number;
}

export interface Today { sales: number; profit: number; tickets: number }

/** A refusal of the computer (its code), or OFFLINE when it cannot be reached. */
export class HanoutError extends Error {
    readonly code: string;
    readonly status: number;
    constructor(code: string, status = 0) {
        super(code);
        this.name = 'HanoutError';
        this.code = code;
        this.status = status;
    }
}

type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{ status: number; json(): Promise<unknown> }>;

const TIMEOUT_MS = 8000;

/** An address of the shop's own network (or this device): the only ones the app talks to. */
export function isPrivateHost(host: string): boolean {
    const h = String(host || '').trim();
    if (h === 'localhost' || /^127\.\d+\.\d+\.\d+$/.test(h)) return true;
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
    if (!m || m.slice(1).some(n => Number(n) > 255)) return false;
    const [a, b] = [Number(m[1]), Number(m[2])];
    return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/** The invite read from the QR code, or null when it is not the shop's code. */
export function parsePairLink(text: string): Invite | null {
    const m = /^afushanout:\/\/pair\?(.+)$/.exec(String(text || '').trim());
    if (!m) return null;
    const params = new Map(m[1].split('&').map(part => {
        const [k, v = ''] = part.split('=');
        return [decodeURIComponent(k), decodeURIComponent(v)] as [string, string];
    }));
    const host = params.get('host') || '';
    const port = Number(params.get('port'));
    const code = params.get('code') || '';
    if (!isPrivateHost(host) || !Number.isInteger(port) || port < 1 || port > 65535 || !/^\d{6}$/.test(code)) return null;
    return { host, port, code };
}

const base = ({ host, port }: { host: string; port: number }) => `http://${host}:${port}`;

async function call<T>(fetchImpl: FetchLike, url: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: { status: number; json(): Promise<unknown> };
    try {
        res = await fetchImpl(url, {
            method: init.method || 'GET',
            headers: { Accept: 'application/json', ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
            body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
            signal: controller.signal,
        });
    } catch {
        throw new HanoutError('OFFLINE');
    } finally {
        clearTimeout(timer);
    }
    let body: unknown = null;
    try { body = await res.json(); } catch { /* an empty answer */ }
    if (res.status >= 200 && res.status < 300) return body as T;
    const code = body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string' ? (body as { error: string }).error : 'SERVER';
    throw new HanoutError(code, res.status);
}

/** Pair this phone with the computer of the QR code (the code works once, 10 minutes). */
export async function pair(invite: Invite, name: string, fetchImpl: FetchLike = fetch as unknown as FetchLike): Promise<Connection> {
    const out = await call<{ token: string; role: Role; shop: string }>(fetchImpl, `${base(invite)}/api/pair`, {
        method: 'POST', body: { code: invite.code, role: 'phone', name: String(name || '').trim().slice(0, 60) },
    });
    return { host: invite.host, port: invite.port, token: out.token, role: out.role, shop: out.shop || '' };
}

/** What the paired phone can ask the computer. A 401 (NOT_PAIRED) means it was removed there. */
export function createClient(conn: Connection, fetchImpl: FetchLike = fetch as unknown as FetchLike) {
    const auth = { Authorization: `Bearer ${conn.token}` };
    const url = (path: string) => `${base(conn)}${path}`;
    return {
        /** The article of a barcode, PLU or scale label; null when the shop does not have it. */
        async price(code: string): Promise<Price | null> {
            try {
                return await call<Price>(fetchImpl, url(`/api/price?code=${encodeURIComponent(code.trim())}`), { headers: auth });
            } catch (error) {
                if (error instanceof HanoutError && error.code === 'NOT_FOUND') return null;
                throw error;
            }
        },
        /** One more (or `quantity` more) of this article in the stock count open on the computer. */
        count(code: string, quantity = 1): Promise<CountLine> {
            return call<CountLine>(fetchImpl, url('/api/count'), { method: 'POST', headers: auth, body: { code: code.trim(), quantity } });
        },
        /** Today's sales, profit and tickets. */
        today(): Promise<Today> {
            return call<Today>(fetchImpl, url('/api/today'), { headers: auth });
        },
        /** A photo (JPEG, base64) becomes the picture of the article of this code. */
        photo(code: string, imageBase64: string): Promise<{ id: string; image: string }> {
            return call(fetchImpl, url('/api/photo'), { method: 'POST', headers: auth, body: { code: code.trim(), image: imageBase64 } });
        },
    };
}

export type HanoutClient = ReturnType<typeof createClient>;
