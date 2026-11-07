// The phone app's words: [Arabic, French, English], the shop's words first.
export type Lang = 'ar' | 'fr' | 'en';
export const LANGS: Lang[] = ['ar', 'fr', 'en'];

export const TEXTS = {
    appName: ['أفوس حانوت', 'Afus Hanout', 'Afus Hanout'],
    pairTitle: ['اربط الهاتف بحاسوب المحل', 'Associer le téléphone à l\'ordinateur du magasin', 'Pair the phone with the shop\'s computer'],
    pairHelp: ['على الحاسوب: الإعدادات › الهاتف وقارئ الأسعار › أضف جهازاً، ثم امسح الرمز', 'Sur l\'ordinateur : Paramètres › Téléphone et vérificateur de prix › Ajouter un appareil, puis scannez le code', 'On the computer: Settings › Phone and price checker › Add a device, then scan the code'],
    pairWifi: ['الهاتف والحاسوب على نفس WiFi المحل', 'Le téléphone et l\'ordinateur sur le même WiFi du magasin', 'The phone and the computer on the shop\'s same WiFi'],
    pairName: ['اسم هذا الهاتف', 'Nom de ce téléphone', 'This phone\'s name'],
    pairNameDefault: ['هاتف المالك', 'Téléphone du gérant', 'Owner\'s phone'],
    pairing: ['جارٍ الربط…', 'Association…', 'Pairing…'],
    paired: ['تم الربط مع {shop}', 'Associé à {shop}', 'Paired with {shop}'],
    notShopCode: ['هذا ليس رمز أفوس حانوت', 'Ce n\'est pas un code Afus Hanout', 'This is not an Afus Hanout code'],
    cameraAsk: ['نحتاج الكاميرا لمسح الرموز', 'La caméra sert à scanner les codes', 'The camera is used to scan codes'],
    cameraAllow: ['اسمح بالكاميرا', 'Autoriser la caméra', 'Allow the camera'],
    tabPrice: ['السعر', 'Prix', 'Price'],
    tabCount: ['الجرد', 'Comptage', 'Count'],
    tabToday: ['اليوم', 'Aujourd\'hui', 'Today'],
    tabPhoto: ['صورة', 'Photo', 'Photo'],
    scanHint: ['وجّه الكاميرا إلى الباركود', 'Visez le code-barres', 'Point the camera at the barcode'],
    typeCode: ['أو اكتب الرمز', 'ou tapez le code', 'or type the code'],
    look: ['ابحث', 'Chercher', 'Look up'],
    unknown: ['هذه السلعة غير موجودة في المحل', 'Cet article n\'est pas dans le magasin', 'This article is not in the shop'],
    perKg: ['للكيلو', 'le kg', 'per kg'],
    perPiece: ['للقطعة', 'la pièce', 'each'],
    capped: ['السعر الرسمي: {price}', 'Prix officiel : {price}', 'Official price: {price}'],
    carton: ['الكرطونة ({qty}): {price}', 'Carton ({qty}) : {price}', 'Carton ({qty}): {price}'],
    scaleLabel: ['ملصق الميزان: {weight}', 'Étiquette de la balance : {weight}', 'Scale label: {weight}'],
    countHelp: ['كل مسحة = قطعة واحدة في الجرد المفتوح على الحاسوب', 'Chaque scan = une pièce dans le comptage ouvert sur l\'ordinateur', 'Each scan = one piece in the count open on the computer'],
    countQty: ['الكمية لكل مسحة', 'Quantité par scan', 'Quantity per scan'],
    counted: ['{name}: عددتَ {counted} (في النظام {expected})', '{name} : compté {counted} (système {expected})', '{name}: counted {counted} (system {expected})'],
    countedKg: ['{name}: تُوزن، اكتب الكيلوغرامات على الحاسوب', '{name} : au poids, tapez les kg sur l\'ordinateur', '{name}: sold by weight, type the kg on the computer'],
    todaySales: ['مبيعات اليوم', 'Ventes du jour', 'Today\'s sales'],
    todayProfit: ['ربح اليوم', 'Bénéfice du jour', 'Today\'s profit'],
    todayTickets: ['عدد التذاكر', 'Tickets', 'Tickets'],
    refresh: ['تحديث', 'Actualiser', 'Refresh'],
    photoHelp: ['امسح باركود السلعة، ثم صوّرها', 'Scannez le code-barres de l\'article, puis photographiez-le', 'Scan the article\'s barcode, then take its picture'],
    takePhoto: ['التقط الصورة', 'Prendre la photo', 'Take the picture'],
    photoSaved: ['حُفظت صورة {name}', 'Photo de {name} enregistrée', '{name}\'s picture saved'],
    again: ['من جديد', 'Recommencer', 'Again'],
    forget: ['افصل هذا الهاتف', 'Dissocier ce téléphone', 'Unpair this phone'],
    language: ['اللغة', 'Langue', 'Language'],
    // The computer's refusals
    'error.OFFLINE': ['لا يصل الهاتف إلى الحاسوب: تأكد من WiFi المحل وأن الحاسوب يعمل', 'Le téléphone n\'atteint pas l\'ordinateur : vérifiez le WiFi du magasin et que l\'ordinateur est allumé', 'The phone cannot reach the computer: check the shop\'s WiFi and that the computer is on'],
    'error.PAIR_CODE': ['الرمز انتهى أو استُعمل: اصنع رمزاً جديداً على الحاسوب', 'Code expiré ou déjà utilisé : créez-en un nouveau sur l\'ordinateur', 'The code expired or was used: make a new one on the computer'],
    'error.NOT_PAIRED': ['أُزيل هذا الهاتف من الحاسوب: اربطه من جديد', 'Ce téléphone a été retiré sur l\'ordinateur : associez-le à nouveau', 'This phone was removed on the computer: pair it again'],
    'error.ROLE': ['هذا الجهاز لقراءة الأسعار فقط', 'Cet appareil ne lit que les prix', 'This device reads prices only'],
    'error.COUNT_NONE': ['لا يوجد جرد مفتوح: افتح جرداً على الحاسوب (المخزون › الجرد)', 'Aucun comptage ouvert : ouvrez-en un sur l\'ordinateur (Stock › Inventaire)', 'No count open: open one on the computer (Stock › Count)'],
    'error.COUNT_CODE_UNKNOWN': ['رمز غير معروف في المحل', 'Code inconnu du magasin', 'Code unknown to the shop'],
    'error.COUNT_OUT_OF_SCOPE': ['هذه السلعة ليست من القسم الذي تجرده', 'Cet article n\'est pas dans la section comptée', 'This article is not in the section counted'],
    'error.NOT_FOUND': ['هذه السلعة غير موجودة في المحل', 'Cet article n\'est pas dans le magasin', 'This article is not in the shop'],
    'error.PHOTO': ['لم تُحفظ الصورة، أعد المحاولة', 'Photo non enregistrée, réessayez', 'The picture was not saved, try again'],
    'error.SERVER': ['خطأ في الحاسوب، أعد المحاولة', 'Erreur sur l\'ordinateur, réessayez', 'Error on the computer, try again'],
} satisfies Record<string, [string, string, string]>;

export type TextKey = keyof typeof TEXTS;

/** The text in the language, with its {placeholders} filled. */
export function tr(lang: Lang, key: TextKey, params: Record<string, string | number> = {}): string {
    const text = TEXTS[key][LANGS.indexOf(lang)] ?? TEXTS[key][0];
    return text.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
}

/** The message of a refusal of the computer (its code), or the general one. */
export function errorText(lang: Lang, code: string): string {
    const key = `error.${code}` as TextKey;
    return key in TEXTS ? tr(lang, key) : tr(lang, 'error.SERVER');
}

/** 2 500 DA / 2 500 د.ج, the way the till writes it (decimals only when there are some). */
export function money(amount: number, lang: Lang): string {
    const n = Math.round((Number(amount) || 0) * 100) / 100;
    const [int, dec] = Math.abs(n).toFixed(Number.isInteger(n) ? 0 : 2).split('.');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
    return `${n < 0 ? '-' : ''}${grouped}${dec ? `,${dec}` : ''}\u202f${lang === 'ar' ? 'د.ج' : 'DA'}`;
}

/** 1,250 kg for 1250 g. */
export function kg(grams: number, lang: Lang): string {
    const value = ((Number(grams) || 0) / 1000).toFixed(3).replace('.', ',');
    return `${value} ${lang === 'ar' ? 'كغ' : 'kg'}`;
}
