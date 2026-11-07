// Counting the shelves into the stock count open on the computer: each scan is
// one piece (or the quantity chosen, for a pack of 6 or a carton).
import { useState } from 'react';
import { Pressable, ScrollView, Text, Vibration, View } from 'react-native';
import { HanoutError, type CountLine, type HanoutClient } from '../client';
import { errorText, tr, type Lang } from '../texts';
import { ARTICLE_CODES, C, CodeField, Message, Scanner, T, s } from '../ui';

const QUANTITIES = [1, 6, 12, 24];

export function CountScreen({ lang, client, onError }: { lang: Lang; client: HanoutClient; onError: (e: unknown) => void }) {
    const [quantity, setQuantity] = useState(1);
    const [last, setLast] = useState<CountLine | null>(null);
    const [problem, setProblem] = useState('');
    const [busy, setBusy] = useState(false);

    const scan = async (code: string) => {
        setBusy(true);
        setProblem('');
        try {
            setLast(await client.count(code, quantity));
            Vibration.vibrate(40);
        } catch (error) {
            setProblem(errorText(lang, error instanceof HanoutError ? error.code : 'SERVER'));
            Vibration.vibrate([0, 80, 80, 80]);
            onError(error);
        } finally {
            setBusy(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
            <T lang={lang} style={s.muted}>{tr(lang, 'countHelp')}</T>
            <View style={{ gap: 6 }}>
                <T lang={lang} style={s.muted}>{tr(lang, 'countQty')}</T>
                <View style={[s.row, { flexDirection: lang === 'ar' ? 'row-reverse' : 'row' }]}>
                    {QUANTITIES.map(q => (
                        <Pressable key={q} onPress={() => setQuantity(q)} accessibilityRole="button" accessibilityState={{ selected: q === quantity }}
                            style={[s.button, { flex: 1, borderWidth: 1, backgroundColor: q === quantity ? C.accent : 'transparent' }]}>
                            <Text style={[s.buttonText, { color: q === quantity ? '#fff' : C.muted }]}>{`×${q}`}</Text>
                        </Pressable>
                    ))}
                </View>
            </View>
            <Scanner lang={lang} types={ARTICLE_CODES} onCode={scan} paused={busy} height={220} />
            <CodeField lang={lang} onCode={scan} label="+" />
            <Message lang={lang} text={problem} tone="bad" />
            {last && (
                <Message lang={lang} tone="good" text={last.unit === 'kg'
                    ? tr(lang, 'countedKg', { name: last.product_name })
                    : tr(lang, 'counted', { name: last.product_name, counted: last.counted, expected: last.expected })} />
            )}
        </ScrollView>
    );
}
