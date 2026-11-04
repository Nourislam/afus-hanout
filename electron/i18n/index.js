/**
 * Translations for documents produced by the main process (receipts,
 * purchase orders, labels, dialogs). Same format as the interface
 * dictionaries: { key: [English, French, Arabic] }.
 *
 * The language is the shop's language (store_config.defaultLanguage).
 */
const CLOTHING = require('../shared/clothing.json');
const BRAND = require('../shared/brand.json');

const LANG_INDEX = { en: 0, fr: 1, ar: 2 };
const LOCALES = { en: 'en-GB', fr: 'fr-DZ', ar: 'ar-DZ-u-nu-latn' };
const DEFAULT_LANGUAGE = 'ar';

const MESSAGES = {
    // Receipt
    'receipt.number': ['Receipt no.', 'Ticket n°', 'رقم التذكرة'],
    'receipt.date': ['Date', 'Date', 'التاريخ'],
    'receipt.cashier': ['Cashier', 'Vendeur', 'البائع'],
    'receipt.customer': ['Customer', 'Client', 'الزبون'],
    'receipt.due': ['Due date', 'Échéance', 'تاريخ الاستحقاق'],
    'receipt.subtotal': ['Subtotal', 'Sous-total', 'المجموع الفرعي'],
    'receipt.discount': ['Discount', 'Remise', 'التخفيض'],
    'receipt.serviceCharge': ['Service charge', 'Frais de service', 'رسوم الخدمة'],
    'receipt.taxIncluded': ['incl.', 'incluse', 'مشمول'],
    'receipt.total': ['TOTAL', 'TOTAL', 'المجموع'],
    'receipt.received': ['Amount received', 'Montant reçu', 'المبلغ المستلم'],
    'receipt.change': ['Change', 'Monnaie rendue', 'الباقي'],
    'receipt.scanForReturn': ['Keep this ticket: scan it for a return or an exchange', 'Gardez ce ticket : scannez-le pour un retour ou un échange', 'احتفظ بهذه التذكرة: امسحها للإرجاع أو التبديل'],
    'z.title': ['Closing report (Z)', 'Rapport de clôture (Z)', 'تقرير غلق الصندوق (Z)'],
    'z.number': ['No.', 'N°', 'رقم'],
    'z.opened': ['Opened', 'Ouverture', 'الفتح'],
    'z.closed': ['Closed', 'Clôture', 'الغلق'],
    'z.tickets': ['Tickets', 'Tickets', 'التذاكر'],
    'z.pieces': ['Pieces sold', 'Pièces vendues', 'القطع المباعة'],
    'z.sales': ['Sales', 'Ventes', 'المبيعات'],
    'z.refunds': ['Returns', 'Retours', 'المرتجعات'],
    'z.openingCash': ['Cash at opening', 'Fond de caisse', 'مبلغ الفتح'],
    'z.cashSales': ['Cash sales', 'Ventes en espèces', 'مبيعات نقداً'],
    'z.creditCollected': ['Kridi paid back in cash', 'Crédit remboursé en espèces', 'كريدي مسدَّد نقداً'],
    'z.cashRefunds': ['Cash given back', 'Espèces rendues', 'نقود مُرجعة'],
    'z.expenses': ['Expenses', 'Dépenses', 'المصاريف'],
    'z.deposits': ['Reservation deposits', 'Acomptes de réservation', 'عرابين الحجز'],
    'z.depositRefunds': ['Deposits given back', 'Acomptes rendus', 'عرابين مُرجعة'],
    'z.expected': ['Cash expected', 'Espèces attendues', 'النقد المتوقع'],
    'z.counted': ['Cash counted', 'Espèces comptées', 'النقد المعدود'],
    'z.difference': ['Difference', 'Écart', 'الفرق'],
    'z.signature': ['Signature', 'Signature', 'الإمضاء'],
    'receipt.footer': ['Thank you for your visit!', 'Merci de votre visite !', 'شكراً على زيارتكم!'],
    'receipt.exchangeNote': ['Exchange within 7 days with this receipt', 'Échange sous 7 jours avec ce ticket', 'الاستبدال خلال 7 أيام بهذه التذكرة'],
    'receipt.giftCardBalance': ['Balance', 'Solde', 'الرصيد'],
    'receipt.items': ['{n} pcs', '{n} pcs', '{n} قطعة'],
    // Payment methods
    'pay.cash': ['Cash', 'Espèces', 'نقداً'],
    'pay.card': ['Card (CIB / Edahabia)', 'Carte (CIB / Edahabia)', 'بطاقة CIB أو الذهبية'],
    'pay.transfer': ['BaridiMob / CCP', 'BaridiMob / CCP', 'بريدي موب أو CCP'],
    'pay.credit': ['Credit', 'Crédit', 'كريدي'],
    'pay.gift_card': ['Gift card', 'Carte cadeau', 'بطاقة هدية'],
    'pay.exchange': ['Exchanged piece', 'Pièce échangée', 'قطعة مُبدّلة'],
    'pay.deposit': ['Deposit paid', 'Acompte versé', 'العربون المدفوع'],
    'receipt.demo': ['DEMO SHOP — NOT A SALE', 'BOUTIQUE DE DÉMO — PAS UNE VENTE', 'محل تجريبي — ليست بيعًا حقيقيًا'],
    'pay.bank_transfer': ['Bank transfer', 'Virement bancaire', 'تحويل بنكي'],
    'pay.check': ['Cheque', 'Chèque', 'صك'],
    'pay.other': ['Other', 'Autre', 'أخرى'],
    // Credit payment receipt
    'creditReceipt.title': ['Payment receipt', 'Reçu de paiement', 'وصل تسديد'],
    'creditReceipt.invoice': ['Invoice no.', 'Facture n°', 'رقم الفاتورة'],
    'creditReceipt.paid': ['AMOUNT PAID', 'MONTANT PAYÉ', 'المبلغ المدفوع'],
    'creditReceipt.method': ['Method', 'Mode', 'الطريقة'],
    'creditReceipt.remaining': ['Remaining balance', 'Reste à payer', 'المبلغ المتبقي'],
    'creditReceipt.thanks': ['Thank you for your payment!', 'Merci pour votre paiement !', 'شكراً على التسديد!'],
    // A4 documents (purchase order, quotation)
    'doc.receipt': ['RECEIPT', 'TICKET', 'تذكرة'],
    'doc.purchaseOrder': ['PURCHASE ORDER', 'BON DE COMMANDE', 'طلبية شراء'],
    'doc.quotation': ['QUOTATION', 'DEVIS', 'عرض سعر'],
    'doc.invoice': ['INVOICE', 'FACTURE', 'فاتورة'],
    'doc.billTo': ['BILLED TO', 'FACTURÉ À', 'فاتورة باسم'],
    'doc.paidWith': ['Paid with', 'Réglé par', 'طريقة الدفع'],
    'doc.totalHt': ['Total excl. tax', 'Total HT', 'المجموع دون رسوم'],
    'doc.totalTtc': ['TOTAL incl. tax', 'TOTAL TTC', 'المجموع مع الرسوم'],
    'doc.number': ['Document no.', 'N° du document', 'رقم الوثيقة'],
    'doc.date': ['Date', 'Date', 'التاريخ'],
    'doc.expected': ['Expected delivery', 'Livraison prévue', 'تاريخ الاستلام المتوقع'],
    'doc.vendor': ['SUPPLIER', 'FOURNISSEUR', 'المورد'],
    'doc.shipTo': ['DELIVER TO', 'LIVRER À', 'التسليم إلى'],
    'doc.preparedFor': ['PREPARED FOR', 'ÉTABLI POUR', 'مُعدّ لـ'],
    'doc.validUntil': ['VALID UNTIL', "VALABLE JUSQU'AU", 'صالح إلى غاية'],
    'doc.validDefault': ['30 days', '30 jours', '30 يوماً'],
    'doc.phone': ['Phone', 'Tél.', 'الهاتف'],
    'doc.email': ['E-mail', 'E-mail', 'البريد'],
    'doc.contact': ['Contact', 'Contact', 'الشخص المكلف'],
    'doc.notes': ['Notes / special instructions', 'Notes / instructions', 'ملاحظات / تعليمات'],
    'doc.description': ['Description', 'Désignation', 'البيان'],
    'doc.qty': ['Qty', 'Qté', 'الكمية'],
    'doc.unitPrice': ['Unit price', 'Prix unitaire', 'سعر الوحدة'],
    'doc.amount': ['Amount', 'Montant', 'المبلغ'],
    'doc.exempt': ['EXEMPT', 'EXONÉRÉ', 'معفى'],
    'doc.signatory': ['Authorised signatory', 'Signataire autorisé', 'الموقّع المعتمد'],
    'doc.terms': ['Terms & conditions', 'Conditions', 'الشروط'],
    'doc.term1': ['Please deliver the goods as specified above', 'Merci de livrer la marchandise comme indiqué', 'يرجى تسليم السلع كما هو مبين أعلاه'],
    'doc.term2': ['The invoice must quote this order number', 'La facture doit mentionner ce numéro de commande', 'يجب ذكر رقم الطلبية في الفاتورة'],
    'doc.term3': ['Goods are received subject to inspection', 'Marchandise reçue sous réserve de contrôle', 'تُستلم السلع بعد المراقبة'],
    'doc.thanks': ['Thank you for your business!', 'Merci de votre confiance !', 'شكراً على ثقتكم!'],
    'doc.supplierDefault': ['Supplier', 'Fournisseur', 'المورد'],
    'doc.customerDefault': ['Customer', 'Client', 'الزبون'],
    // Gift card
    'gift.title': ['Gift card', 'Carte cadeau', 'بطاقة هدية'],
    'gift.number': ['Card number', 'Numéro de carte', 'رقم البطاقة'],
    'gift.expires': ['Expires', 'Expire le', 'تنتهي في'],
    'gift.noExpiry': ['No expiry date', "Sans date d'expiration", 'بدون تاريخ انتهاء'],
    'gift.terms': ['Terms and conditions apply', 'Conditions applicables', 'تُطبق الشروط'],
    // Shop legal identifiers
    // Excel files (services/excelReport.js, services/exportService.js)
    'xl.save': ['Save the Excel file', 'Enregistrer le fichier Excel', 'حفظ ملف الإكسال'],
    'xl.period': ['Period', 'Période', 'الفترة'],
    'xl.madeOn': ['Made on', 'Établi le', 'تاريخ الإنشاء'],
    'xl.by': ['By', 'Par', 'بواسطة'],
    'xl.total': ['Total', 'Total', 'المجموع'],
    'xl.page': ['Page', 'Page', 'صفحة'],
    'xl.empty': ['Nothing for this period', 'Rien pour cette période', 'لا يوجد شيء لهذه الفترة'],
    'xl.asOf': ['On {date}', 'Au {date}', 'بتاريخ {date}'],
    'xl.yes': ['Yes', 'Oui', 'نعم'],
    'xl.no': ['No', 'Non', 'لا'],
    'xl.col.n': ['No.', 'N°', 'الرقم'],
    'xl.col.category': ['Category', 'Catégorie', 'الصنف'],
    'xl.col.article': ['Article', 'Article', 'السلعة'],
    'xl.col.brand': ['Brand', 'Marque', 'الماركة'],
    'xl.col.season': ['Season', 'Saison', 'الموسم'],
    'xl.col.color': ['Colour', 'Couleur', 'اللون'],
    'xl.col.size': ['Size', 'Taille', 'المقاس'],
    'xl.col.qr': ['QR code', 'Code QR', 'رمز QR'],
    'xl.col.sku': ['Reference (SKU)', 'Référence (SKU)', 'المرجع (SKU)'],
    'xl.col.barcode': ['Barcode', 'Code-barres', 'الباركود'],
    'xl.col.quantity': ['Quantity', 'Quantité', 'الكمية'],
    'xl.col.pieces': ['Pieces', 'Pièces', 'القطع'],
    'xl.col.minLevel': ['Minimum', 'Minimum', 'الحد الأدنى'],
    'xl.col.unitCost': ['Purchase price (unit)', "Prix d'achat (unité)", 'سعر الشراء للوحدة'],
    'xl.col.unitPrice': ['Sale price (unit)', 'Prix de vente (unité)', 'سعر البيع للوحدة'],
    'xl.col.costValue': ['Total at purchase price', "Total au prix d'achat", 'المجموع بسعر الشراء'],
    'xl.col.retailValue': ['Total at sale price', 'Total au prix de vente', 'المجموع بسعر البيع'],
    'xl.col.margin': ['Expected margin', 'Marge attendue', 'الربح المتوقع'],
    'xl.col.marginRate': ['Margin %', 'Marge %', 'نسبة الربح'],
    'xl.col.articles': ['Articles', 'Articles', 'عدد السلع'],
    'xl.col.wholesale': ['Wholesale price', 'Prix de gros', 'سعر الجملة'],
    'xl.col.sizes': ['Colours / sizes', 'Couleurs / tailles', 'الألوان / المقاسات'],
    'xl.col.date': ['Date', 'Date', 'التاريخ'],
    'xl.col.ticket': ['Ticket', 'Ticket', 'التذكرة'],
    'xl.col.type': ['Type', 'Type', 'النوع'],
    'xl.col.employee': ['Seller', 'Vendeur', 'البائع'],
    'xl.col.customer': ['Customer', 'Client', 'الزبون'],
    'xl.col.phone': ['Phone', 'Téléphone', 'الهاتف'],
    'xl.col.address': ['Address', 'Adresse', 'العنوان'],
    'xl.col.discount': ['Discount', 'Remise', 'التخفيض'],
    'xl.col.lineTotal': ['Line total', 'Total ligne', 'مجموع السطر'],
    'xl.col.costTotal': ['Purchase cost', "Coût d'achat", 'تكلفة الشراء'],
    'xl.col.profit': ['Profit', 'Bénéfice', 'الربح'],
    'xl.col.amountHt': ['Amount excl. TVA', 'Montant HT', 'المبلغ دون رسم'],
    'xl.col.tva': ['TVA', 'TVA', 'الرسم'],
    'xl.col.amountTtc': ['Amount incl. TVA', 'Montant TTC', 'المبلغ مع الرسم'],
    'xl.col.cash': ['Cash', 'Espèces', 'نقدًا'],
    'xl.col.card': ['Card (CIB / Edahabia)', 'Carte (CIB / Edahabia)', 'بطاقة (CIB / الذهبية)'],
    'xl.col.transfer': ['Transfer / BaridiMob', 'Virement / BaridiMob', 'تحويل / بريدي موب'],
    'xl.col.credit': ['Kridi', 'Crédit', 'كريدي'],
    'xl.col.giftCard': ['Gift card / avoir', 'Carte cadeau / avoir', 'بطاقة هدية / رصيد'],
    'xl.col.other': ['Other', 'Autre', 'أخرى'],
    'xl.col.totalSpent': ['Bought in total', 'Total acheté', 'مجموع المشتريات'],
    'xl.col.points': ['Loyalty points', 'Points fidélité', 'نقاط الوفاء'],
    'xl.col.creditAllowed': ['Kridi allowed', 'Crédit autorisé', 'الكريدي مسموح'],
    'xl.col.creditLimit': ['Kridi limit', 'Plafond crédit', 'سقف الكريدي'],
    'xl.col.debt': ['Owes now', 'Doit maintenant', 'عليه الآن'],
    'xl.col.lastVisit': ['Last purchase', 'Dernier achat', 'آخر شراء'],
    'xl.col.tickets': ['Tickets', 'Tickets', 'التذاكر'],
    'xl.col.invoice': ['Kridi no.', 'N° crédit', 'رقم الكريدي'],
    'xl.col.amountDue': ['Amount', 'Montant', 'المبلغ'],
    'xl.col.paid': ['Paid', 'Payé', 'المدفوع'],
    'xl.col.left': ['Left to pay', 'Reste à payer', 'الباقي'],
    'xl.col.dueDate': ['To pay by', 'À payer avant', 'آخر أجل'],
    'xl.col.status': ['Status', 'État', 'الحالة'],
    'xl.col.lateDays': ['Days late', 'Jours de retard', 'أيام التأخير'],
    'xl.col.supplier': ['Supplier', 'Fournisseur', 'المورد'],
    'xl.col.contact': ['Contact', 'Contact', 'الشخص المسؤول'],
    'xl.col.received': ['Goods received', 'Marchandise reçue', 'السلع المستلمة'],
    'xl.col.returned': ['Sent back', 'Retourné', 'المرجع للمورد'],
    'xl.col.owed': ['Still owed', 'Reste dû', 'الباقي له'],
    'xl.col.orders': ['Orders', 'Commandes', 'الطلبيات'],
    'xl.col.lastReceived': ['Last delivery', 'Dernière livraison', 'آخر استلام'],
    'xl.status.pending': ['Not paid', 'Non payé', 'غير مدفوع'],
    'xl.status.partial': ['Paid in part', 'Payé en partie', 'مدفوع جزئيًا'],
    'xl.status.paid': ['Paid', 'Payé', 'مدفوع'],
    'xl.status.overdue': ['Late', 'En retard', 'متأخر'],
    'xl.sale': ['Sale', 'Vente', 'بيع'],
    'xl.return': ['Return', 'Retour', 'إرجاع'],
    // The files
    'xl.stock.title': ['Stock, size by size, with its value', 'Stock, taille par taille, avec sa valeur', 'المخزون مقاسًا بمقاس مع قيمته'],
    'xl.stock.sheet': ['Stock', 'Stock', 'المخزون'],
    'xl.stock.byCategory': ['By category', 'Par catégorie', 'حسب الصنف'],
    'xl.stock.byCategoryTitle': ['Stock value by category', 'Valeur du stock par catégorie', 'قيمة المخزون حسب الصنف'],
    'xl.stock.kArticles': ['Articles', 'Articles', 'عدد السلع'],
    'xl.stock.kPieces': ['Pieces in stock', 'Pièces en stock', 'القطع في المخزون'],
    'xl.stock.kCost': ['Stock at purchase price', "Stock au prix d'achat", 'المخزون بسعر الشراء'],
    'xl.stock.kRetail': ['Stock at sale price', 'Stock au prix de vente', 'المخزون بسعر البيع'],
    'xl.stock.kMargin': ['Expected margin if all is sold', 'Marge attendue si tout est vendu', 'الربح المتوقع إذا بيع كله'],
    'xl.stock.noCost': ['{n} piece(s) have no purchase price: their margin counts as the full sale price.', "{n} pièce(s) sans prix d'achat : leur marge compte tout le prix de vente.", '{n} قطعة بدون سعر شراء: ربحها يُحسب بكامل سعر البيع.'],
    'xl.stock.note': ['Each size counts at its own purchase and sale price (the article\'s when the size has none). A stock below 0 counts as 0.', "Chaque taille compte à son propre prix d'achat et de vente (celui de l'article si la taille n'en a pas). Un stock sous 0 compte pour 0.", 'كل مقاس يُحسب بسعر شرائه وبيعه الخاص (سعر السلعة إذا لم يكن له سعر). المخزون الأقل من 0 يُحسب 0.'],
    'xl.products.title': ['Articles and their prices', 'Articles et leurs prix', 'السلع وأسعارها'],
    'xl.products.sheet': ['Articles', 'Articles', 'السلع'],
    'xl.journal.title': ['Sales journal (for the accountant)', 'Journal des ventes (pour le comptable)', 'سجل المبيعات (للمحاسب)'],
    'xl.journal.sheet': ['Journal', 'Journal', 'السجل'],
    'xl.lines.title': ['Sales, line by line', 'Ventes, ligne par ligne', 'المبيعات سطرًا بسطر'],
    'xl.lines.sheet': ['Sales', 'Ventes', 'المبيعات'],
    'xl.lines.note': ['Returns are not taken off here: they are in the sales journal. Profit = line total − purchase cost of the pieces.', "Retours non déduits : ils sont dans le journal des ventes. Bénéfice = total de la ligne − coût d'achat des pièces.", 'المرتجعات غير مخصومة هنا (موجودة في سجل المبيعات). الربح = مجموع السطر − تكلفة شراء القطع.'],
    'xl.customers.title': ['Customers', 'Clients', 'الزبائن'],
    'xl.customers.sheet': ['Customers', 'Clients', 'الزبائن'],
    'xl.kridi.title': ['Kridi (customer debts)', 'Crédits clients', 'الكريدي (ديون الزبائن)'],
    'xl.kridi.sheet': ['Kridi', 'Crédit', 'الكريدي'],
    'xl.kridi.kLeft': ['Customers owe in total', 'Les clients doivent au total', 'مجموع ما على الزبائن'],
    'xl.kridi.kLate': ['Of which late', 'Dont en retard', 'منها متأخر'],
    // The accountant's file of a month
    'xl.acc.file': ['Accountant file - {month}', 'Fichier comptable - {month}', 'ملف المحاسب - {month}'],
    'xl.acc.sheet': ['Month summary', 'Résumé du mois', 'ملخص الشهر'],
    'xl.acc.title': ['The month for the accountant — {month}', 'Le mois pour le comptable — {month}', 'الشهر للمحاسب — {month}'],
    'xl.acc.item': ['Item', 'Poste', 'البند'],
    'xl.acc.amount': ['Amount', 'Montant', 'المبلغ'],
    'xl.acc.kTickets': ['Tickets', 'Tickets', 'عدد التذاكر'],
    'xl.acc.kReturns': ['Returns', 'Retours', 'عدد المرتجعات'],
    'xl.acc.sales': ['Sales (TTC)', 'Ventes (TTC)', 'المبيعات (بالرسم)'],
    'xl.acc.returns': ['Returns (TTC)', 'Retours (TTC)', 'المرتجعات (بالرسم)'],
    'xl.acc.net': ['Net sales (TTC)', 'Ventes nettes (TTC)', 'صافي المبيعات (بالرسم)'],
    'xl.acc.ht': ['Net sales without TVA (HT)', 'Ventes nettes hors taxe (HT)', 'صافي المبيعات دون رسم (HT)'],
    'xl.acc.tva': ['TVA', 'TVA', 'الرسم (TVA)'],
    'xl.acc.by.cash': ['Paid in cash', 'Payé en espèces', 'مدفوع نقدًا'],
    'xl.acc.by.card': ['Paid by card', 'Payé par carte', 'مدفوع بالبطاقة'],
    'xl.acc.by.transfer': ['Paid by transfer', 'Payé par virement', 'مدفوع بالتحويل'],
    'xl.acc.by.credit': ['Sold on kridi (owed by customers)', 'Vendu à crédit (dû par les clients)', 'مبيع بالكريدي (دَين على الزبائن)'],
    'xl.acc.by.gift_card': ['Paid by gift card / credit note', 'Payé par carte cadeau / avoir', 'مدفوع ببطاقة هدية / رصيد'],
    'xl.acc.by.other': ['Other', 'Autre', 'أخرى'],
    'xl.acc.kridiPaidIn': ['Kridi paid in this month', 'Crédits encaissés ce mois', 'دفعات الكريدي المقبوضة هذا الشهر'],
    'xl.acc.stockCost': ['Stock at purchase price (today)', "Stock au prix d'achat (aujourd'hui)", 'المخزون بسعر الشراء (اليوم)'],
    'xl.acc.stockRetail': ['Stock at sale price (today)', 'Stock au prix de vente (aujourd\'hui)', 'المخزون بسعر البيع (اليوم)'],
    'xl.acc.note1': ['Each line of this summary is the total of the sheet it comes from (journal, kridi paid in, stock). Returns are negative.', "Chaque ligne de ce résumé est le total de sa feuille (journal, crédits encaissés, stock). Les retours sont négatifs.", 'كل سطر في هذا الملخص هو مجموع ورقته (السجل، دفعات الكريدي، المخزون). المرتجعات بالسالب.'],
    'xl.acc.note2': ['The stock is the one of the day the file was made ({date}).', 'Le stock est celui du jour où le fichier a été fait ({date}).', 'المخزون هو مخزون يوم إنشاء الملف ({date}).'],
    'xl.acc.kridiSheet': ['Kridi paid in', 'Crédits encaissés', 'دفعات الكريدي'],
    'xl.acc.kridiTitle': ['Kridi paid in — {month}', 'Crédits encaissés — {month}', 'دفعات الكريدي المقبوضة — {month}'],
    // One customer's account
    'xl.st.file': ['Account of {name}', 'Relevé de {name}', 'كشف حساب {name}'],
    'xl.st.sheet': ['Account', 'Relevé', 'كشف الحساب'],
    'xl.st.title': ['Account statement — {name}', 'Relevé de compte — {name}', 'كشف حساب — {name}'],
    'xl.st.what': ['Operation', 'Opération', 'العملية'],
    'xl.st.kridi': ['Kridi', 'Crédit', 'كريدي'],
    'xl.st.return': ['Return', 'Retour', 'إرجاع'],
    'xl.st.payment': ['Payment', 'Paiement', 'دفعة'],
    'xl.st.debit': ['Taken', 'Pris', 'عليه'],
    'xl.st.credit': ['Paid / returned', 'Payé / rendu', 'دفع / أرجع'],
    'xl.st.balance': ['Still owed', 'Reste dû', 'الباقي عليه'],
    'xl.st.kTaken': ['Kridi taken', 'Crédit pris', 'مجموع الكريدي'],
    'xl.st.kGiven': ['Paid and returned', 'Payé et rendu', 'مجموع ما دفعه وأرجعه'],
    'xl.st.kLeft': ['Still owed today', "Reste dû aujourd'hui", 'الباقي عليه اليوم'],
    'xl.st.note': ['Each line: what was taken on kridi, a return that lowered it, or a payment; the last column is what is left after that line.', "Chaque ligne : un crédit pris, un retour qui l'a diminué, ou un paiement ; la dernière colonne est ce qui reste après cette ligne.", 'كل سطر: كريدي أخذه، أو إرجاع أنقصه، أو دفعة؛ العمود الأخير هو ما بقي عليه بعد هذا السطر.'],
    'xl.suppliers.title': ['Suppliers and what the shop owes them', 'Fournisseurs et ce que le magasin leur doit', 'الموردون وما على المحل لهم'],
    'xl.suppliers.sheet': ['Suppliers', 'Fournisseurs', 'الموردون'],
    'xl.suppliers.kOwed': ['The shop owes in total', 'Le magasin doit au total', 'مجموع ما على المحل'],
    'legal.rc': ['RC', 'RC', 'س.ت'],
    'legal.nif': ['NIF', 'NIF', 'ر.ت.ج'],
    'legal.nis': ['NIS', 'NIS', 'ر.ت.إ'],
    'legal.ai': ['AI', 'AI', 'م.ج'],
    // Dialogs
    'dialog.startFailed': ['{app} could not start', "{app} n'a pas pu démarrer", 'تعذّر تشغيل {app}'],
    'dialog.dbFailed': ['The local database could not be opened.', "La base de données locale n'a pas pu être ouverte.", 'تعذّر فتح قاعدة البيانات المحلية.'],
    'dialog.externalBackup': ['Folder for a second copy of the backups', 'Dossier pour une deuxième copie des sauvegardes', 'مجلد لنسخة ثانية من النسخ الاحتياطية'],
    'dialog.supportFile': ['Save the support file', 'Enregistrer le fichier d\'assistance', 'حفظ ملف المساعدة'],
    'dialog.exportBackup': ['Create a backup', 'Créer une sauvegarde', 'إنشاء نسخة احتياطية'],
    'dialog.importBackup': ['Restore a backup', 'Restaurer une sauvegarde', 'استرجاع نسخة احتياطية'],
    'dialog.selectSignature': ['Choose the signature image', "Choisir l'image de signature", 'اختر صورة التوقيع'],
    'dialog.saveReceipt': ['Save the receipt as PDF', 'Enregistrer le ticket en PDF', 'حفظ التذكرة PDF'],
    'dialog.saveLabels': ['Save the labels as PDF', 'Enregistrer les étiquettes en PDF', 'حفظ الملصقات PDF'],
    'dialog.savePurchaseOrder': ['Save the purchase order as PDF', 'Enregistrer le bon de commande en PDF', 'حفظ طلبية الشراء PDF'],
    'dialog.saveQuotation': ['Save the quotation as PDF', 'Enregistrer le devis en PDF', 'حفظ عرض السعر PDF'],
    'dialog.saveGiftCard': ['Save the gift card as PDF', 'Enregistrer la carte cadeau en PDF', 'حفظ بطاقة الهدية PDF'],
    'dialog.pdfFiles': ['PDF documents', 'Documents PDF', 'ملفات PDF'],
    'dialog.backupFiles': ['Backup (SQLite)', 'Sauvegarde (SQLite)', 'نسخة احتياطية (SQLite)'],
    'backup.invalidFile': ['This file is not an {app} backup.', "Ce fichier n'est pas une sauvegarde {app}.", 'هذا الملف ليس نسخة احتياطية من {app}.'],
    'dialog.imageFiles': ['Images', 'Images', 'الصور'],
    'dialog.dataFolder': ['Data folder', 'Dossier des données', 'مجلد البيانات'],
    // E-mails (tickets, purchase orders, quotations, gift cards)
    'email.subject': ['{doc} no. {number} — {shop}', '{doc} n° {number} — {shop}', '{doc} رقم {number} — {shop}'],
    'email.hello': ['Hello {name},', 'Bonjour {name},', 'مرحبًا {name}،'],
    'email.helloAll': ['Hello,', 'Bonjour,', 'مرحبًا،'],
    'email.receiptIntro': ['Thank you for your purchase. Here is your ticket; the PDF is attached.', 'Merci pour votre achat. Voici votre ticket ; le PDF est joint.', 'شكرًا على شرائك. هذه تذكرتك، وملف PDF مرفق.'],
    'email.creditIntro': ['We received your payment. Thank you.', 'Nous avons bien reçu votre paiement. Merci.', 'استلمنا دفعتك. شكرًا لك.'],
    'email.creditLine': ['Payment of kridi {number}', 'Paiement du crédit {number}', 'دفعة الكريدي {number}'],
    'email.poIntro': ['Please find our purchase order below (PDF attached). Thank you for confirming it.', 'Voici notre bon de commande (PDF joint). Merci de nous le confirmer.', 'هذه طلبية الشراء (ملف PDF مرفق). نرجو تأكيدها.'],
    'email.quoteIntro': ['Here is the quotation you asked for (PDF attached).', 'Voici le devis demandé (PDF joint).', 'هذا عرض السعر الذي طلبته (ملف PDF مرفق).'],
    'email.giftIntro': ['Here is your gift card of {amount}. The printable card is attached.', 'Voici votre carte cadeau de {amount}. La carte à imprimer est jointe.', 'هذه بطاقة الهدية بقيمة {amount}. البطاقة القابلة للطباعة مرفقة.'],
    'email.item': ['Article', 'Article', 'السلعة'],
    'email.qty': ['Qty', 'Qté', 'الكمية'],
    'email.price': ['Price', 'Prix', 'السعر'],
    'email.amount': ['Amount', 'Montant', 'المبلغ'],
    'email.tax': ['Tax', 'Taxe', 'الرسوم'],
    'email.note': ['Note', 'Remarque', 'ملاحظة'],
    'email.thanks': ['Thank you!', 'Merci !', 'شكرًا!'],
    // Product name: the same in every language (electron/shared/brand.json)
    'app.name': [BRAND.productName, BRAND.productName, BRAND.productName],
    'labels.sampleName': ['Classic T-shirt', 'T-shirt classique', 'تيشيرت كلاسيك'],
};

function normalizeLanguage(lang) {
    return LANG_INDEX[lang] !== undefined ? lang : DEFAULT_LANGUAGE;
}

function translate(lang, key, params) {
    const entry = MESSAGES[key];
    let text = entry ? (entry[LANG_INDEX[normalizeLanguage(lang)]] || entry[0]) : key;
    if (params) {
        text = text.replace(/\{(\w+)\}/g, (m, name) => (params[name] !== undefined && params[name] !== null ? String(params[name]) : m));
    }
    return text;
}

/** A translator bound to one language: const T = translator('fr'); T('receipt.total') */
function translator(lang) {
    const value = normalizeLanguage(lang);
    const T = (key, params) => translate(value, key, params);
    T.lang = value;
    T.dir = value === 'ar' ? 'rtl' : 'ltr';
    T.locale = LOCALES[value];
    return T;
}

const SPACE = /[\u202f\u00a0 ]/g;
const NBSP = '\u202f'; // narrow: U+00A0 splits "9 000" in Arabic ("000 9")

/** "2 500 DA" / "2 500 د.ج"; decimals only when needed. Same output as the interface. */
function formatMoney(amount, lang = DEFAULT_LANGUAGE, currency = 'DZD') {
    const value = Number(amount) || 0;
    const digits = Number.isInteger(value) ? 0 : 2;
    // No-break spaces keep "2 500" in one piece, also inside Arabic text
    const number = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
        .format(value).replace(SPACE, NBSP);
    if (!currency || currency === 'DZD') return `${number}${NBSP}${normalizeLanguage(lang) === 'ar' ? 'د.ج' : 'DA'}`;
    return `${number}${NBSP}${currency}`;
}

function parseDate(value) {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    // SQLite CURRENT_TIMESTAMP values are UTC without a zone marker
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return new Date(`${value.replace(' ', 'T')}Z`);
    return new Date(value);
}

function formatDate(value, _lang = DEFAULT_LANGUAGE, withTime = true) {
    const d = parseDate(value);
    if (Number.isNaN(d.getTime())) return String(value || '');
    const options = withTime
        ? { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }
        : { year: 'numeric', month: '2-digit', day: '2-digit' };
    // dd/mm/yyyy hh:mm in every language (the Arabic locale adds direction marks)
    return new Intl.DateTimeFormat('fr-DZ', options).format(d);
}

// Colour and size names from the shared clothing catalogue
const COLOR_BY_KEY = new Map();
for (const c of CLOTHING.colors) {
    for (const k of [c.code, c.en, c.fr, c.ar]) COLOR_BY_KEY.set(String(k).trim().toLowerCase(), c);
}

function colorName(item, lang = DEFAULT_LANGUAGE) {
    if (!item) return '';
    const entry = COLOR_BY_KEY.get(String(item.color_code || '').toLowerCase()) || COLOR_BY_KEY.get(String(item.color || '').trim().toLowerCase());
    return entry ? entry[normalizeLanguage(lang)] : (item.color || '');
}

const SIZE_UNITS = { Y: { en: 'yrs', fr: 'ans', ar: 'سنوات' }, M: { en: 'mo', fr: 'mois', ar: 'أشهر' } };

function sizeLabel(size, lang = DEFAULT_LANGUAGE) {
    if (!size) return '';
    const value = String(size).trim();
    const label = CLOTHING.sizeLabels && CLOTHING.sizeLabels[value];
    if (label) return label[normalizeLanguage(lang)] || value;
    const m = /^(\d+(?:-\d+)?)([YM])$/.exec(value);
    if (m) return `${m[1]} ${SIZE_UNITS[m[2]][normalizeLanguage(lang)]}`;
    return value;
}

/** "Noir / M" in the shop's language; falls back to the stored snapshot. */
function variantLabel(item, lang = DEFAULT_LANGUAGE) {
    if (!item) return '';
    if (item.color || item.size || item.color_code) {
        return [colorName(item, lang), sizeLabel(item.size, lang)].filter(Boolean).join(' / ');
    }
    return item.variant_label || '';
}

function paymentLabel(method, lang = DEFAULT_LANGUAGE) {
    const key = `pay.${method}`;
    return MESSAGES[key] ? translate(lang, key) : String(method || '').replace(/_/g, ' ');
}

module.exports = {
    MESSAGES,
    DEFAULT_LANGUAGE,
    normalizeLanguage,
    translate,
    translator,
    formatMoney,
    formatDate,
    colorName,
    sizeLabel,
    variantLabel,
    paymentLabel,
};
