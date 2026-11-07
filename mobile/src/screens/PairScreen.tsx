// Pairing: scan the QR code shown on the computer (Settings › Phone and price checker).
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { pair, parsePairLink, HanoutError, type Connection } from '../client';
import { errorText, tr, type Lang } from '../texts';
import { C, Message, Scanner, T, s } from '../ui';

export function PairScreen({ lang, onPaired }: { lang: Lang; onPaired: (conn: Connection) => void }) {
    const [name, setName] = useState(tr(lang, 'pairNameDefault'));
    const [busy, setBusy] = useState(false);
    const [problem, setProblem] = useState('');

    const onCode = async (text: string) => {
        if (busy) return;
        const invite = parsePairLink(text);
        if (!invite) { setProblem(tr(lang, 'notShopCode')); return; }
        setBusy(true);
        setProblem('');
        try {
            onPaired(await pair(invite, name));
        } catch (error) {
            setProblem(errorText(lang, error instanceof HanoutError ? error.code : 'SERVER'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
            <T lang={lang} style={s.title}>{tr(lang, 'pairTitle')}</T>
            <T lang={lang} style={s.muted}>{tr(lang, 'pairHelp')}</T>
            <View style={{ gap: 6 }}>
                <T lang={lang} style={s.muted}>{tr(lang, 'pairName')}</T>
                <TextInput value={name} onChangeText={setName} style={[s.input, { flex: 0, textAlign: lang === 'ar' ? 'right' : 'left' }]} placeholderTextColor={C.muted} maxLength={60} />
            </View>
            <Scanner lang={lang} types={['qr']} onCode={onCode} paused={busy} height={320} />
            {busy && <Message lang={lang} text={tr(lang, 'pairing')} />}
            <Message lang={lang} text={problem} tone="bad" />
            <T lang={lang} style={s.muted}>{tr(lang, 'pairWifi')}</T>
        </ScrollView>
    );
}
