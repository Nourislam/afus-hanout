// The day at a glance: sales, profit and tickets since the shop opened today.
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { HanoutError, type HanoutClient, type Today } from '../client';
import { errorText, money, tr, type Lang } from '../texts';
import { Button, C, Message, T, s } from '../ui';

export function TodayScreen({ lang, client, onError }: { lang: Lang; client: HanoutClient; onError: (e: unknown) => void }) {
    const [today, setToday] = useState<Today | null>(null);
    const [problem, setProblem] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setBusy(true);
        setProblem('');
        try {
            setToday(await client.today());
        } catch (error) {
            setProblem(errorText(lang, error instanceof HanoutError ? error.code : 'SERVER'));
            onError(error);
        } finally {
            setBusy(false);
        }
    }, [client, lang, onError]);

    useEffect(() => { void load(); }, [load]);

    const tile = (label: string, value: string, color: string) => (
        <View style={s.card}>
            <T lang={lang} style={s.muted}>{label}</T>
            <T lang={lang} style={[s.big, { color, fontSize: 36 }]}>{value}</T>
        </View>
    );

    return (
        <ScrollView contentContainerStyle={s.page} refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={C.muted} />}>
            <Message lang={lang} text={problem} tone="bad" />
            {today && (
                <>
                    {tile(tr(lang, 'todaySales'), money(today.sales, lang), C.text)}
                    {tile(tr(lang, 'todayProfit'), money(today.profit, lang), today.profit >= 0 ? C.good : C.bad)}
                    {tile(tr(lang, 'todayTickets'), String(today.tickets), C.text)}
                </>
            )}
            <Button label={tr(lang, 'refresh')} onPress={load} busy={busy} kind="ghost" />
        </ScrollView>
    );
}
