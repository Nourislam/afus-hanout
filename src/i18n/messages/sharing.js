// Files given to others (accountant, customer), the weekly figures check, codes
// for the count, purchase orders from a supplier's file. [English, French, Arabic]
export default {
    // The accountant's file of a month
    'acc.button': ["Send to the accountant", "Envoyer au comptable", "أرسل للمحاسب"],
    'acc.hint': ["One Excel file for the month: summary, sales journal, kridi paid in, stock", "Un seul fichier Excel pour le mois : résumé, journal des ventes, crédits encaissés, stock", "ملف إكسال واحد للشهر: الملخص، سجل المبيعات، دفعات الكريدي، المخزون"],
    'acc.title': ["The month's file for the accountant", "Le fichier du mois pour le comptable", "ملف الشهر للمحاسب"],
    'acc.month': ["Month", "Mois", "الشهر"],
    'acc.soFar': ["so far", "jusqu'à aujourd'hui", "حتى اليوم"],
    'acc.inside': ["In the file, one sheet each:", "Dans le fichier, une feuille chacun :", "في الملف، ورقة لكل واحد:"],
    'acc.part.summary': ["The month in short: sales, returns, HT / TVA / TTC, each way of paying, kridi paid in, stock value", "Le mois en bref : ventes, retours, HT / TVA / TTC, chaque mode de paiement, crédits encaissés, valeur du stock", "ملخص الشهر: المبيعات، المرتجعات، دون رسم / الرسم / بالرسم، كل طريقة دفع، دفعات الكريدي، قيمة المخزون"],
    'acc.part.journal': ["The sales journal: every ticket and return", "Le journal des ventes : chaque ticket et retour", "سجل المبيعات: كل تذكرة وكل إرجاع"],
    'acc.part.kridi': ["The kridi paid in during the month", "Les crédits encaissés pendant le mois", "دفعات الكريدي المقبوضة خلال الشهر"],
    'acc.part.stock': ["The stock today, article by article, and per category", "Le stock d'aujourd'hui, article par article, et par catégorie", "مخزون اليوم سلعة بسلعة، وحسب الصنف"],
    'acc.save': ["Save the file", "Enregistrer le fichier", "احفظ الملف"],
    'acc.saved': ["The file is saved", "Le fichier est enregistré", "تم حفظ الملف"],
    'acc.sendHint': ["Open its folder and drag it into an e-mail or a WhatsApp message to your accountant.", "Ouvrez son dossier et glissez-le dans un e-mail ou un message WhatsApp à votre comptable.", "افتح مجلده واسحبه إلى رسالة بريد أو واتساب لمحاسبك."],
    'acc.folder': ["Open its folder", "Ouvrir son dossier", "افتح مجلده"],
    // A purchase order from the supplier's file
    'poFile.button': ["From the supplier's file (Excel)", "Depuis le fichier du fournisseur (Excel)", "من ملف المورد (إكسال)"],
    'poFile.hint': ["His invoice or order form in Excel: article (or code), quantity, unit price. Each line is matched to your articles; you check before saving.", "Sa facture ou son bon de commande en Excel : article (ou code), quantité, prix unitaire. Chaque ligne est rapprochée de vos articles ; vous vérifiez avant d'enregistrer.", "فاتورته أو طلبيته في إكسال: السلعة (أو الرمز)، الكمية، سعر الوحدة. كل سطر يُطابق مع سلعك وتراجع قبل الحفظ."],
    'poFile.added': ["{n} lines added from the supplier's file — check them, then save", "{n} lignes ajoutées depuis le fichier du fournisseur — vérifiez, puis enregistrez", "أُضيف {n} سطر من ملف المورد — راجعها ثم احفظ"],
    'poFile.notFound': ["No table with an article (or code) column and a quantity column was found in this file", "Aucun tableau avec une colonne article (ou code) et une colonne quantité dans ce fichier", "لم يُعثر في هذا الملف على جدول فيه عمود السلعة (أو الرمز) وعمود الكمية"],
    // Lines without a code (before a count)
    'codes.title': ["{n} stock lines have no code", "{n} lignes du stock n'ont aucun code", "{n} سطر في المخزون بدون رمز"],
    'codes.why': ["No QR, reference or barcode: the scanner and the count cannot find them", "Ni QR, ni référence, ni code-barres : le scanner et l'inventaire ne les trouvent pas", "لا QR ولا مرجع ولا باركود: الماسح والجرد لا يجدانها"],
    'codes.create': ["Create codes", "Créer les codes", "أنشئ رموزًا"],
    'codes.made': ["{n} codes created — print their labels", "{n} codes créés — imprimez leurs étiquettes", "تم إنشاء {n} رمز — اطبع ملصقاتها"],
    'codes.printLabels': ["Labels", "Étiquettes", "الملصقات"],
    // One customer's account
    'statement.title': ["Customer account statement", "Relevé de compte du client", "كشف حساب الزبون"],
    'statement.hint': ["Every kridi, return and payment, with what is left after each one", "Chaque crédit, retour et paiement, avec ce qui reste après chacun", "كل كريدي وإرجاع ودفعة، مع ما بقي بعد كل واحد"],
    'statement.file': ["Statement (Excel)", "Relevé (Excel)", "كشف الحساب (إكسال)"],
    'statement.whatsapp': ["Send on WhatsApp", "Envoyer par WhatsApp", "أرسله عبر واتساب"],
    'statement.saved': ["Statement saved", "Relevé enregistré", "تم حفظ كشف الحساب"],
    'statement.message': ["Hello {name}, here is your account statement from {shop}. Still to pay: {amount}. The file is attached. Thank you.", "Bonjour {name}, voici votre relevé de compte de {shop}. Reste à payer : {amount}. Le fichier est joint. Merci.", "السلام عليكم {name}، هذا كشف حسابك من {shop}. الباقي عليك: {amount}. الملف مرفق. شكرًا."],
    'statement.dragIt': ["WhatsApp is open with the message, and the file's folder too: drag the file into the chat, then press Send", "WhatsApp est ouvert avec le message, et le dossier du fichier aussi : glissez le fichier dans la discussion, puis Envoyer", "فُتح واتساب مع الرسالة، وفُتح مجلد الملف: اسحب الملف إلى المحادثة ثم اضغط إرسال"],
};
