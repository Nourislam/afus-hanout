// The app's look (the program's dark theme) and its small shared pieces.
import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeType } from 'expo-camera';
import { tr, type Lang } from './texts';

export const C = {
    bg: '#09090b', surface: '#18181b', border: '#27272a', text: '#fafafa', muted: '#a1a1aa',
    accent: '#6366f1', good: '#34d399', warn: '#fbbf24', bad: '#f87171',
};

/** Text that follows the language's direction (Arabic from the right). */
export function T({ lang, style, children }: { lang: Lang; style?: StyleProp<TextStyle>; children: ReactNode }) {
    return <Text style={[{ color: C.text, textAlign: lang === 'ar' ? 'right' : 'left', writingDirection: lang === 'ar' ? 'rtl' : 'ltr' }, style]}>{children}</Text>;
}

export function Button({ label, onPress, busy, kind = 'primary', style }: { label: string; onPress: () => void; busy?: boolean; kind?: 'primary' | 'ghost' | 'danger'; style?: StyleProp<ViewStyle> }) {
    const bg = kind === 'primary' ? C.accent : 'transparent';
    const color = kind === 'danger' ? C.bad : kind === 'ghost' ? C.muted : '#fff';
    return (
        <Pressable onPress={onPress} disabled={busy} accessibilityRole="button"
            style={({ pressed }) => [s.button, { backgroundColor: bg, opacity: pressed || busy ? 0.6 : 1, borderWidth: kind === 'primary' ? 0 : 1 }, style]}>
            {busy ? <ActivityIndicator color={color} /> : <Text style={[s.buttonText, { color }]}>{label}</Text>}
        </Pressable>
    );
}

export function Message({ lang, text, tone = 'muted' }: { lang: Lang; text: string; tone?: 'muted' | 'good' | 'warn' | 'bad' }) {
    if (!text) return null;
    return <T lang={lang} style={[s.message, { color: C[tone], borderColor: tone === 'muted' ? C.border : C[tone] }]}>{text}</T>;
}

/** Barcodes of the shop's articles, its scale labels, and the QR code of the computer. */
export const ARTICLE_CODES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'itf14'];

/**
 * The camera, reading codes. The same code read again within 2 seconds is
 * ignored (the camera sees it many times a second).
 */
export function Scanner({ lang, types, onCode, paused, height = 260, cameraRef }: {
    lang: Lang; types: BarcodeType[]; onCode: (code: string) => void; paused?: boolean; height?: number;
    cameraRef?: React.RefObject<CameraView | null>;
}) {
    const [permission, requestPermission] = useCameraPermissions();
    const last = useRef({ code: '', at: 0 });
    if (!permission) return <View style={[s.camera, { height }]} />;
    if (!permission.granted) {
        return (
            <View style={[s.camera, s.center, { height, padding: 16, gap: 12 }]}>
                <T lang={lang} style={{ textAlign: 'center', color: C.muted }}>{tr(lang, 'cameraAsk')}</T>
                <Button label={tr(lang, 'cameraAllow')} onPress={() => { void requestPermission(); }} />
            </View>
        );
    }
    return (
        <View style={[s.camera, { height }]}>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back"
                barcodeScannerSettings={{ barcodeTypes: types }}
                onBarcodeScanned={paused ? undefined : ({ data }) => {
                    const now = Date.now();
                    if (data === last.current.code && now - last.current.at < 2000) return;
                    last.current = { code: data, at: now };
                    onCode(data);
                }} />
        </View>
    );
}

/** A code typed by hand (a label that does not scan, a PLU). */
export function CodeField({ lang, onCode, label }: { lang: Lang; onCode: (code: string) => void; label: string }) {
    const [code, setCode] = useState('');
    const submit = () => { if (code.trim()) { onCode(code.trim()); setCode(''); } };
    return (
        <View style={s.row}>
            <TextInput value={code} onChangeText={setCode} onSubmitEditing={submit} placeholder={tr(lang, 'typeCode')} placeholderTextColor={C.muted}
                keyboardType="number-pad" returnKeyType="search" style={s.input} />
            <Button label={label} onPress={submit} style={{ minWidth: 96 }} />
        </View>
    );
}

export const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    page: { padding: 16, gap: 14 },
    center: { alignItems: 'center', justifyContent: 'center' },
    row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    camera: { borderRadius: 16, overflow: 'hidden', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
    card: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16, gap: 6 },
    button: { height: 48, borderRadius: 12, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderColor: C.border },
    buttonText: { fontSize: 16, fontWeight: '600' },
    input: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, color: C.text, paddingHorizontal: 14, fontSize: 18 },
    message: { fontSize: 15, borderWidth: 1, borderRadius: 12, padding: 12 },
    title: { fontSize: 22, fontWeight: '700' },
    big: { fontSize: 44, fontWeight: '800' },
    muted: { color: C.muted, fontSize: 14 },
});
