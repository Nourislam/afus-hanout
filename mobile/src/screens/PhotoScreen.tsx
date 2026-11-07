// An article's picture: scan its barcode, then take the photo. The computer
// resizes it and shows it on the sales screen's picture buttons.
import { useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import type { CameraView } from 'expo-camera';
import { HanoutError, type HanoutClient, type Price } from '../client';
import { errorText, tr, type Lang } from '../texts';
import { ARTICLE_CODES, Button, CodeField, Message, Scanner, T, s } from '../ui';

export function PhotoScreen({ lang, client, onError }: { lang: Lang; client: HanoutClient; onError: (e: unknown) => void }) {
    const camera = useRef<CameraView | null>(null);
    const [article, setArticle] = useState<{ code: string; price: Price } | null>(null);
    const [done, setDone] = useState('');
    const [problem, setProblem] = useState('');
    const [busy, setBusy] = useState(false);

    const fail = (error: unknown) => {
        setProblem(errorText(lang, error instanceof HanoutError ? error.code : 'PHOTO'));
        onError(error);
    };

    const pick = async (code: string) => {
        setBusy(true);
        setProblem('');
        setDone('');
        try {
            const price = await client.price(code);
            if (price) setArticle({ code, price }); else setProblem(tr(lang, 'unknown'));
        } catch (error) {
            fail(error);
        } finally {
            setBusy(false);
        }
    };

    const shoot = async () => {
        if (!article || !camera.current) return;
        setBusy(true);
        setProblem('');
        try {
            const picture = await camera.current.takePictureAsync({ base64: true, quality: 0.5, shutterSound: false });
            if (!picture?.base64) throw new HanoutError('PHOTO');
            await client.photo(article.code, picture.base64);
            setDone(tr(lang, 'photoSaved', { name: article.price.name }));
            setArticle(null);
        } catch (error) {
            fail(error);
        } finally {
            setBusy(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
            <T lang={lang} style={s.muted}>{tr(lang, 'photoHelp')}</T>
            {article ? (
                <>
                    <T lang={lang} style={s.title}>{article.price.name}</T>
                    {/* No barcode reading here: the camera frames the article */}
                    <Scanner lang={lang} types={[]} onCode={() => {}} paused cameraRef={camera} height={360} />
                    <Button label={tr(lang, 'takePhoto')} onPress={shoot} busy={busy} />
                    <Button label={tr(lang, 'again')} onPress={() => setArticle(null)} kind="ghost" />
                </>
            ) : (
                <>
                    <Scanner lang={lang} types={ARTICLE_CODES} onCode={pick} paused={busy} />
                    <CodeField lang={lang} onCode={pick} label={tr(lang, 'look')} />
                </>
            )}
            <Message lang={lang} text={problem} tone="bad" />
            <Message lang={lang} text={done} tone="good" />
        </ScrollView>
    );
}
