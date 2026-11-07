// What the phone keeps: the paired computer (its token, in the phone's secure
// storage) and the language chosen.
import * as SecureStore from 'expo-secure-store';
import type { Connection } from './client';
import { LANGS, type Lang } from './texts';

const CONNECTION = 'afus-hanout.connection';
const LANGUAGE = 'afus-hanout.language';

export async function loadConnection(): Promise<Connection | null> {
    try {
        const text = await SecureStore.getItemAsync(CONNECTION);
        const conn = text ? JSON.parse(text) as Connection : null;
        return conn && conn.host && conn.token ? conn : null;
    } catch {
        return null;
    }
}

export async function saveConnection(conn: Connection | null): Promise<void> {
    if (conn) await SecureStore.setItemAsync(CONNECTION, JSON.stringify(conn));
    else await SecureStore.deleteItemAsync(CONNECTION);
}

export async function loadLanguage(): Promise<Lang> {
    try {
        const lang = await SecureStore.getItemAsync(LANGUAGE);
        return LANGS.includes(lang as Lang) ? lang as Lang : 'ar';
    } catch {
        return 'ar';
    }
}

export async function saveLanguage(lang: Lang): Promise<void> {
    await SecureStore.setItemAsync(LANGUAGE, lang);
}
