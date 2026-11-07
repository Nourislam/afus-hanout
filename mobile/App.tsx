// Afus Hanout on the owner's phone. It holds no database: it asks the shop's
// computer, on the shop's WiFi, after pairing once with the QR code shown in
// Settings › Phone and price checker.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { createClient, HanoutError, type Connection } from './src/client';
import { LANGS, tr, errorText, type Lang, type TextKey } from './src/texts';
import { loadConnection, loadLanguage, saveConnection, saveLanguage } from './src/storage';
import { C, T, s } from './src/ui';
import { PairScreen } from './src/screens/PairScreen';
import { PriceScreen } from './src/screens/PriceScreen';
import { CountScreen } from './src/screens/CountScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { PhotoScreen } from './src/screens/PhotoScreen';

type Tab = 'price' | 'count' | 'today' | 'photo';
const TABS: { id: Tab; label: TextKey }[] = [
    { id: 'price', label: 'tabPrice' },
    { id: 'count', label: 'tabCount' },
    { id: 'today', label: 'tabToday' },
    { id: 'photo', label: 'tabPhoto' },
];

export default function App() {
    const [ready, setReady] = useState(false);
    const [conn, setConn] = useState<Connection | null>(null);
    const [lang, setLang] = useState<Lang>('ar');
    const [tab, setTab] = useState<Tab>('price');

    useEffect(() => {
        Promise.all([loadConnection(), loadLanguage()]).then(([saved, language]) => {
            setConn(saved);
            setLang(language);
        }).finally(() => setReady(true));
    }, []);

    const client = useMemo(() => (conn ? createClient(conn) : null), [conn]);

    const paired = async (next: Connection) => {
        await saveConnection(next);
        setConn(next);
        setTab('price');
        Alert.alert(tr(lang, 'appName'), tr(lang, 'paired', { shop: next.shop || next.host }));
    };
    const forget = useCallback(async () => {
        await saveConnection(null);
        setConn(null);
    }, []);
    // Removed on the computer: back to pairing
    const onError = useCallback((error: unknown) => {
        if (error instanceof HanoutError && error.code === 'NOT_PAIRED') {
            Alert.alert(tr(lang, 'appName'), errorText(lang, 'NOT_PAIRED'));
            void forget();
        }
    }, [forget, lang]);
    const nextLanguage = () => {
        const next = LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length];
        setLang(next);
        void saveLanguage(next);
    };

    return (
        <SafeAreaProvider>
            <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
                <StatusBar style="light" />
                <View style={[s.row, { paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'space-between', flexDirection: lang === 'ar' ? 'row-reverse' : 'row' }]}>
                    <T lang={lang} style={{ fontSize: 18, fontWeight: '700' }}>{conn?.shop || tr(lang, 'appName')}</T>
                    <View style={[s.row, { flexDirection: lang === 'ar' ? 'row-reverse' : 'row' }]}>
                        <Pressable onPress={nextLanguage} accessibilityLabel={tr(lang, 'language')} style={{ padding: 8 }}>
                            <Text style={{ color: C.muted, fontWeight: '700' }}>{lang.toUpperCase()}</Text>
                        </Pressable>
                        {conn && (
                            <Pressable onPress={() => Alert.alert(tr(lang, 'forget'), conn.shop || conn.host, [
                                { text: '✕', style: 'cancel' },
                                { text: tr(lang, 'forget'), style: 'destructive', onPress: () => { void forget(); } },
                            ])} style={{ padding: 8 }}>
                                <Text style={{ color: C.muted }}>⋯</Text>
                            </Pressable>
                        )}
                    </View>
                </View>

                {!ready ? (
                    <View style={[s.screen, s.center]}><ActivityIndicator color={C.accent} /></View>
                ) : !conn || !client ? (
                    <PairScreen lang={lang} onPaired={paired} />
                ) : (
                    <>
                        <View style={{ flex: 1 }}>
                            {tab === 'price' && <PriceScreen lang={lang} client={client} onError={onError} />}
                            {tab === 'count' && <CountScreen lang={lang} client={client} onError={onError} />}
                            {tab === 'today' && <TodayScreen lang={lang} client={client} onError={onError} />}
                            {tab === 'photo' && <PhotoScreen lang={lang} client={client} onError={onError} />}
                        </View>
                        <View style={{ flexDirection: lang === 'ar' ? 'row-reverse' : 'row', borderTopWidth: 1, borderColor: C.border }}>
                            {TABS.map(item => (
                                <Pressable key={item.id} onPress={() => setTab(item.id)} accessibilityRole="tab" accessibilityState={{ selected: tab === item.id }}
                                    style={{ flex: 1, paddingVertical: 14, alignItems: 'center' }}>
                                    <Text style={{ color: tab === item.id ? C.accent : C.muted, fontWeight: tab === item.id ? '700' : '500', fontSize: 15 }}>{tr(lang, item.label)}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </>
                )}
            </SafeAreaView>
        </SafeAreaProvider>
    );
}
