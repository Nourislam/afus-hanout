// The price of an article: scan it (or type its code or PLU).
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { HanoutError, type HanoutClient, type Price } from '../client';
import { errorText, kg, money, tr, type Lang } from '../texts';
import { ARTICLE_CODES, C, CodeField, Message, Scanner, T, s } from '../ui';

export function PriceScreen({ lang, client, onError }: { lang: Lang; client: HanoutClient; onError: (e: unknown) => void }) {
    const [found, setFound] = useState<Price | null>(null);
    const [problem, setProblem] = useState('');
    const [busy, setBusy] = useState(false);

    const look = async (code: string) => {
        setBusy(true);
        setProblem('');
        try {
            const price = await client.price(code);
            setFound(price);
            if (!price) setProblem(tr(lang, 'unknown'));
        } catch (error) {
            setFound(null);
            setProblem(errorText(lang, error instanceof HanoutError ? error.code : 'SERVER'));
            onError(error);
        } finally {
            setBusy(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
            <Scanner lang={lang} types={ARTICLE_CODES} onCode={look} paused={busy} />
            <T lang={lang} style={s.muted}>{tr(lang, 'scanHint')}</T>
            <CodeField lang={lang} onCode={look} label={tr(lang, 'look')} />
            <Message lang={lang} text={problem} tone="warn" />
            {found && <PriceCard lang={lang} price={found} />}
        </ScrollView>
    );
}

export function PriceCard({ lang, price }: { lang: Lang; price: Price }) {
    return (
        <View style={s.card} testID="price-card">
            <T lang={lang} style={s.title}>{price.name}</T>
            {price.scale ? (
                <>
                    <T lang={lang} style={[s.big, { color: C.good }]}>{money(price.scale.price ?? price.price * price.scale.grams / 1000, lang)}</T>
                    <T lang={lang} style={s.muted}>{tr(lang, 'scaleLabel', { weight: kg(price.scale.grams, lang) })}</T>
                    <T lang={lang} style={s.muted}>{`${money(price.price, lang)} ${tr(lang, 'perKg')}`}</T>
                </>
            ) : (
                <T lang={lang} style={[s.big, { color: C.good }]}>{`${money(price.price, lang)} `}<T lang={lang} style={s.muted}>{tr(lang, price.unit === 'kg' ? 'perKg' : 'perPiece')}</T></T>
            )}
            {price.capped !== null && <T lang={lang} style={{ color: C.warn }}>{tr(lang, 'capped', { price: money(price.capped, lang) })}</T>}
            {price.carton && price.carton.price > 0 && (
                <T lang={lang} style={s.muted}>{tr(lang, 'carton', { qty: price.carton.qty, price: money(price.carton.price, lang) })}</T>
            )}
        </View>
    );
}
