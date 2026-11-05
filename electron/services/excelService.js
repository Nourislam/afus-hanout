/**
 * Excel Import/Export Service
 * 
 * Handles importing data from Excel files for Products, Customers, Employees.
 */

const XLSX = require('xlsx');
const { BRAND } = require('../brand');

// Row problems are sent as "CODE|{json}" and shown in the shop's language
const coded = (code, params = {}) => `${code}|${JSON.stringify(params)}`;

// Field mappings for each data type
const FIELD_MAPPINGS = {
    products: {
        required: ['name', 'price'],
        // One row per article; «kg» in the sold-by column for an article sold by weight
        optional: ['unit', 'stock_quantity', 'cost', 'sku', 'barcode', 'category', 'brand', 'description', 'min_stock_level', 'tax_rate'],
        aliases: {
            'يُباع بـ': 'unit', 'يباع ب': 'unit', 'يباع بـ': 'unit', 'الوحدة': 'unit', 'vendu à': 'unit', 'vendu a': 'unit', 'vendu au': 'unit', 'unité': 'unit', 'unite': 'unit', 'sold by': 'unit',
            // French and Arabic column names used in Algerian shops
            'nom': 'name', 'désignation': 'name', 'designation': 'name', 'article': 'name', 'produit': 'name',
            'الاسم': 'name', 'السلعة': 'name', 'المنتج': 'name',
            'prix': 'price', 'prix de vente': 'price', 'pv': 'price', 'السعر': 'price', 'سعر البيع': 'price',
            "prix d'achat": 'cost', 'pa': 'cost', 'coût': 'cost', 'سعر الشراء': 'cost',
            'quantité': 'stock_quantity', 'quantite': 'stock_quantity', 'qté': 'stock_quantity', 'الكمية': 'stock_quantity', 'المخزون': 'stock_quantity',
            'catégorie': 'category', 'categorie': 'category', 'famille': 'category', 'الصنف': 'category',
            'marque': 'brand', 'الماركة': 'brand', 'العلامة': 'brand',
            'code-barres': 'barcode', 'code barre': 'barcode', 'code barres': 'barcode', 'الباركود': 'barcode',
            'référence': 'sku', 'reference': 'sku', 'réf': 'sku', 'ref': 'sku', 'المرجع': 'sku',
            'stock minimum': 'min_stock_level', 'الحد الأدنى': 'min_stock_level',
            'tva': 'tax_rate',

            'product name': 'name',
            'product_name': 'name',
            'title': 'name',
            'product code': 'sku',
            'item code': 'sku',
            'upc': 'barcode',
            'ean': 'barcode',
            'desc': 'description',
            'cost price': 'cost',
            'purchase price': 'cost',
            'selling price': 'price',
            'sale price': 'price',
            'unit price': 'price',
            'quantity': 'stock_quantity',
            'stock': 'stock_quantity',
            'qty': 'stock_quantity',
            'inventory': 'stock_quantity',
            'reorder level': 'min_stock_level',
            'min stock': 'min_stock_level',
            'min_stock': 'min_stock_level',
            'tax': 'tax_rate',
            'vat': 'tax_rate',
            'tax rate': 'tax_rate',
            'category name': 'category',
            'stock quantity': 'stock_quantity',
            'stock level': 'stock_quantity',
        },
    },
    customers: {
        required: ['name'],
        optional: ['email', 'phone', 'address', 'notes', 'loyalty_points'],
        aliases: {
            'nom': 'name', 'client': 'name', 'الاسم': 'name', 'الزبون': 'name',
            'téléphone': 'phone', 'tél': 'phone', 'tel': 'phone', 'الهاتف': 'phone',
            'adresse': 'address', 'العنوان': 'address',
            'customer name': 'name',
            'full name': 'name',
            'customer': 'name',
            'email address': 'email',
            'e-mail': 'email',
            'phone number': 'phone',
            'telephone': 'phone',
            'mobile': 'phone',
            'contact': 'phone',
            'street address': 'address',
            'location': 'address',
            'points': 'loyalty_points',
            'rewards': 'loyalty_points',
            'comments': 'notes',
            'remarks': 'notes',
        },
    },
    suppliers: {
        required: ['name'],
        optional: ['contact_person', 'phone', 'email', 'address', 'notes'],
        aliases: {
            'nom': 'name', 'fournisseur': 'name', 'المورد': 'name', 'supplier': 'name', 'supplier name': 'name',
            'contact': 'contact_person', 'responsable': 'contact_person', 'الشخص المسؤول': 'contact_person',
            'téléphone': 'phone', 'tél': 'phone', 'tel': 'phone', 'mobile': 'phone',
            'e-mail': 'email', 'adresse': 'address', 'remarques': 'notes',
        },
    },
    employees: {
        required: ['name', 'pin'],
        optional: ['email', 'role'],
        aliases: {
            'employee name': 'name',
            'full name': 'name',
            'staff name': 'name',
            'email address': 'email',
            'e-mail': 'email',
            'pin code': 'pin',
            'access code': 'pin',
            'password': 'pin',
            'position': 'role',
            'job title': 'role',
            'job role': 'role',
        },
    },
};

// Column titles of the templates, in the shop's language [English, French, Arabic].
// The same titles are read back on import, whatever the language of the file.
const HEADERS = {
    name: ['Name', 'Nom', 'الاسم'],
    price: ['Selling price', 'Prix de vente', 'سعر البيع'],
    unit: ['Sold by', 'Vendu à', 'يُباع بـ'],
    stock_quantity: ['Stock quantity', 'Quantité en stock', 'الكمية'],
    cost: ['Purchase price', "Prix d'achat", 'سعر الشراء'],
    sku: ['SKU / reference', 'Référence (SKU)', 'المرجع (SKU)'],
    barcode: ['Barcode', 'Code-barres', 'الباركود'],
    category: ['Category', 'Catégorie', 'الصنف'],
    brand: ['Brand', 'Marque', 'الماركة'],
    description: ['Description', 'Description', 'الوصف'],
    min_stock_level: ['Minimum stock', 'Stock minimum', 'الحد الأدنى'],
    tax_rate: ['TVA %', 'TVA %', 'الرسم %'],
    email: ['E-mail', 'E-mail', 'البريد الإلكتروني'],
    phone: ['Phone', 'Téléphone', 'الهاتف'],
    address: ['Address', 'Adresse', 'العنوان'],
    notes: ['Notes', 'Notes', 'ملاحظات'],
    loyalty_points: ['Loyalty points', 'Points fidélité', 'نقاط الوفاء'],
    pin: ['PIN (4 to 6 digits)', 'Code PIN (4 à 6 chiffres)', 'رمز PIN (4 إلى 6 أرقام)'],
    role: ['Role (cashier, manager)', 'Rôle (cashier, manager)', 'الدور (cashier أو manager)'],
    contact_person: ['Contact person', 'Personne à contacter', 'الشخص المسؤول'],
};
const LANG_AT = { en: 0, fr: 1, ar: 2 };
for (const mapping of Object.values(FIELD_MAPPINGS)) {
    for (const field of [...mapping.required, ...mapping.optional]) {
        for (const title of HEADERS[field] || []) mapping.aliases[title.toLowerCase()] = mapping.aliases[title.toLowerCase()] || field;
    }
}

// How to fill each column (second sheet of the templates) [English, French, Arabic]
const HOW = {
    title: ['How to fill this file', 'Comment remplir ce fichier', 'طريقة ملء هذا الملف'],
    column: ['Column', 'Colonne', 'العمود'],
    needed: ['Needed', 'Obligatoire', 'إجباري'],
    what: ['What to write', 'Quoi écrire', 'ماذا تكتب'],
    yes: ['Yes', 'Oui', 'نعم'],
    no: ['No', 'Non', 'لا'],
    rule1: ['Write from the 2nd line on, one line per article (one line per colour/size: the lines with the same name make one article).', "Écrivez à partir de la 2e ligne, une ligne par article (une ligne par couleur/taille : les lignes au même nom font un seul article).", 'اكتب ابتداءً من السطر الثاني، سطرًا لكل سلعة (سطر لكل لون/مقاس: الأسطر التي لها نفس الاسم تصبح سلعة واحدة).'],
    rule2: ['Keep the titles of the first line. Prices in dinars, without "DA".', 'Gardez les titres de la première ligne. Prix en dinars, sans « DA ».', 'لا تغيّر عناوين السطر الأول. الأسعار بالدينار دون كتابة «د.ج».'],
    rule3: ['The first sheet stays empty for your lines: an example is at the bottom of this sheet.', "La première feuille reste vide pour vos lignes : un exemple est en bas de cette feuille.", 'الورقة الأولى فارغة لبياناتك: تجد مثالًا في أسفل هذه الورقة.'],
    example: ['Example (not imported)', 'Exemple (non importé)', 'مثال (لا يُستورد)'],
};
const HOW_FIELD = {
    name: ['Name of the article / person', "Nom de l'article / de la personne", 'اسم السلعة / الشخص'],
    price: ['Selling price in dinars, e.g. 120 (per kg for an article sold by weight)', 'Prix de vente en dinars, ex. 120 (au kg pour un article vendu au poids)', 'سعر البيع بالدينار، مثال 120 (للكيلوغرام في السلعة التي تُباع بالوزن)'],
    unit: ['Empty = by the piece; kg = by weight', 'Vide = à la pièce ; kg = au poids', 'فارغ = بالقطعة؛ كغ = بالوزن'],
    stock_quantity: ['Pieces in stock now (kg for an article sold by weight, e.g. 12.5)', 'Pièces en stock maintenant (kg pour un article au poids, ex. 12,5)', 'عدد القطع الموجودة الآن (بالكيلوغرام للسلعة الموزونة، مثال 12.5)'],
    cost: ['Purchase price of one piece (or one kg)', "Prix d'achat d'une pièce (ou d'un kg)", 'سعر شراء القطعة الواحدة (أو الكيلوغرام)'],
    sku: ['Empty: the program makes one', 'Vide : le programme en crée une', 'اتركه فارغًا: البرنامج يصنعه'],
    barcode: ['Barcode printed on the article (optional)', "Code-barres imprimé sur l'article (facultatif)", 'الباركود المطبوع على السلعة (اختياري)'],
    category: ['e.g. Grocery, Dairy', 'ex. Épicerie, Laitages', 'مثال مواد غذائية، ألبان'],
    brand: ['Brand (optional)', 'Marque (facultatif)', 'الماركة (اختياري)'],
    description: ['A short text (optional)', 'Un court texte (facultatif)', 'نص قصير (اختياري)'],
    min_stock_level: ['Below this number the program warns', 'Sous ce nombre le programme prévient', 'تحت هذا العدد ينبّهك البرنامج'],
    tax_rate: ['0 if your prices have no TVA', '0 si vos prix sont sans TVA', '0 إذا كانت أسعارك بدون رسم'],
    email: ['E-mail (optional)', 'E-mail (facultatif)', 'البريد الإلكتروني (اختياري)'],
    phone: ['e.g. 0555 12 34 56', 'ex. 0555 12 34 56', 'مثال 0555 12 34 56'],
    address: ['Town / address (optional)', 'Ville / adresse (facultatif)', 'المدينة / العنوان (اختياري)'],
    notes: ['Anything useful (optional)', 'Toute info utile (facultatif)', 'أي معلومة مفيدة (اختياري)'],
    loyalty_points: ['Points already earned (optional)', 'Points déjà gagnés (facultatif)', 'النقاط المكتسبة (اختياري)'],
    pin: ['The code to open the program', 'Le code pour ouvrir le programme', 'الرمز لفتح البرنامج'],
    role: ['cashier or manager', 'cashier ou manager', 'cashier أو manager'],
    contact_person: ['Who to call there (optional)', "Qui appeler (facultatif)", 'من تتصل به (اختياري)'],
};

/**
 * A number as a shop writes it: "1 250,00 DA", "7,50", "1,200", "1.250,5".
 * Spaces are thousands; a lone comma is the decimal point when 1 or 2 digits
 * follow it (7,50) and a thousands mark when 3 do (1,200), except for a
 * quantity in kg where it is always the decimal point (12,5 / 1,250); with
 * both marks, the last one is the decimal point. Returns plain "1250.5".
 */
function numberText(value, { kg = false } = {}) {
    const compact = String(value)
        .replace(/د\s*\.?\s*ج|\bDZD\b|\bDA\b|%/gi, '')
        .replace(/[\s\u00a0\u202f]/g, '')
        .replace(/[^0-9.,-]/g, '');
    const comma = compact.lastIndexOf(',');
    const dot = compact.lastIndexOf('.');
    if (comma >= 0 && dot >= 0) {
        return comma > dot ? compact.replace(/\./g, '').replace(',', '.') : compact.replace(/,/g, '');
    }
    if (comma >= 0) {
        const parts = compact.split(',');
        const decimal = parts.length === 2 && (kg || parts[1].length <= 2);
        return decimal ? parts.join('.') : parts.join('');
    }
    return compact;
}

class ExcelService {
    /**
     * Read Excel file and return sheet data
     */
    readFile(filePath) {
        try {
            const workbook = XLSX.readFile(filePath);
            const sheets = {};

            workbook.SheetNames.forEach(sheetName => {
                const sheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                sheets[sheetName] = {
                    headers: data[0] || [],
                    rows: data.slice(1),
                    rowCount: data.length - 1,
                };
            });

            return {
                success: true,
                sheets,
                sheetNames: workbook.SheetNames,
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Parse uploaded file buffer
     */
    parseBuffer(buffer) {
        try {
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheets = {};

            workbook.SheetNames.forEach(sheetName => {
                const sheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                sheets[sheetName] = {
                    headers: (data[0] || []).map(h => String(h).trim()),
                    rows: data.slice(1),
                    rowCount: data.length - 1,
                };
            });

            return {
                success: true,
                sheets,
                sheetNames: workbook.SheetNames,
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Auto-detect column mappings based on header names
     */
    detectColumnMappings(headers, dataType) {
        console.log(`[Excel] Detecting mappings for ${dataType} with headers:`, headers);
        const mapping = FIELD_MAPPINGS[dataType];
        if (!mapping) {
            throw new Error(`Unknown data type: ${dataType}`);
        }

        const columnMappings = {};
        const allFields = [...mapping.required, ...mapping.optional];

        headers.forEach((header, index) => {
            if (!header) return;
            const normalizedHeader = String(header).toLowerCase().trim();

            // Check exact match first
            if (allFields.includes(normalizedHeader)) {
                console.log(`[Excel] Direct match: '${header}' -> '${normalizedHeader}'`);
                columnMappings[normalizedHeader] = index;
            }
            // Check aliases
            else if (mapping.aliases[normalizedHeader]) {
                console.log(`[Excel] Alias match: '${header}' -> '${mapping.aliases[normalizedHeader]}'`);
                columnMappings[mapping.aliases[normalizedHeader]] = index;
            }
        });

        console.log('[Excel] Final Mappings:', columnMappings);
        return {
            mappings: columnMappings,
            unmappedHeaders: headers.filter((h, i) =>
                !Object.values(columnMappings).includes(i)
            ),
            missingRequired: mapping.required.filter(f =>
                !(f in columnMappings)
            ),
        };
    }

    /**
     * Validate and transform data based on type
     */
    validateAndTransform(rows, columnMappings, dataType) {
        const mapping = FIELD_MAPPINGS[dataType];
        const results = {
            valid: [],
            errors: [],
            warnings: [],
        };

        rows.forEach((row, rowIndex) => {
            const record = {};
            const rowErrors = [];
            const rowWarnings = [];

            // Extract values based on column mappings
            for (const [field, colIndex] of Object.entries(columnMappings)) {
                let value = row[colIndex];

                // Handle empty values
                if (value === undefined || value === null || value === '') {
                    if (mapping.required.includes(field)) {
                        rowErrors.push(coded('EXCEL_MISSING', { field }));
                    }
                    continue;
                }

                // Type-specific transformations
                value = this.transformValue(field, value, dataType);

                record[field] = value;
            }

            // Validate required fields
            for (const required of mapping.required) {
                if (!record[required] && !rowErrors.some(e => e.includes(`"${required}"`))) {
                    rowErrors.push(coded('EXCEL_MISSING', { field: required }));
                }
            }

            // Data type specific validations
            if (dataType === 'products') {
                if (record.price && isNaN(parseFloat(record.price))) {
                    rowErrors.push(coded('EXCEL_PRICE_NAN'));
                }
                if (record.stock_quantity && isNaN(parseInt(record.stock_quantity))) {
                    rowWarnings.push(coded('EXCEL_STOCK_NAN'));
                    record.stock_quantity = 0;
                }
            }

            if (dataType === 'customers') {
                if (record.email && !this.isValidEmail(record.email)) {
                    rowWarnings.push(coded('EXCEL_EMAIL'));
                }
            }

            if (dataType === 'employees') {
                if (record.pin && (record.pin.length < 4 || record.pin.length > 6)) {
                    rowErrors.push(coded('EXCEL_PIN'));
                }
                if (record.role && !['admin', 'manager', 'cashier'].includes(record.role.toLowerCase())) {
                    rowWarnings.push(coded('EXCEL_ROLE'));
                    record.role = 'cashier';
                }
            }

            if (rowErrors.length > 0) {
                results.errors.push({
                    row: rowIndex + 2, // Excel row (1-indexed + header)
                    errors: rowErrors,
                    data: record,
                });
            } else {
                if (rowWarnings.length > 0) {
                    results.warnings.push({
                        row: rowIndex + 2,
                        warnings: rowWarnings,
                    });
                }
                // The sheet row, for the import report
                results.valid.push({ ...record, __row: rowIndex + 2 });
            }
        });

        return results;
    }

    /**
     * Transform value based on field type
     */
    transformValue(field, value, _dataType) {
        // Convert to string first
        value = String(value).trim();

        // Number fields
        const numberFields = ['price', 'cost', 'stock_quantity', 'min_stock_level', 'tax_rate', 'loyalty_points'];
        if (numberFields.includes(field)) {
            const num = parseFloat(numberText(value, { kg: field === 'stock_quantity' || field === 'min_stock_level' }));
            return isNaN(num) ? 0 : num;
        }

        // PIN should be string
        if (field === 'pin') {
            return value.replace(/\D/g, '');
        }

        // Role should be lowercase
        if (field === 'role') {
            return value.toLowerCase();
        }

        return value;
    }

    /**
     * Simple email validation
     */
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    /**
     * Get field mappings info for UI
     */
    getFieldMappings(dataType) {
        return FIELD_MAPPINGS[dataType] || null;
    }

    /**
     * Generate sample Excel template
     */
    generateTemplate(dataType) {
        const mapping = FIELD_MAPPINGS[dataType];
        if (!mapping) {
            throw new Error(`Unknown data type: ${dataType}`);
        }

        const headers = [...mapping.required, ...mapping.optional];
        const sampleData = this.getSampleData(dataType);

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, dataType);

        return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    }

    /**
     * The template in the shop's language, ready to fill: titles the import
     * reads back, example lines, a second sheet saying what to write.
     */
    async generateTemplateFile(dataType, lang = 'ar') {
        const ExcelJS = require('exceljs');
        const mapping = FIELD_MAPPINGS[dataType];
        if (!mapping) throw new Error(`Unknown data type: ${dataType}`);
        const at = LANG_AT[lang] ?? 2;
        const rtl = at === 2;
        const fields = [...mapping.required, ...mapping.optional];
        const wb = new ExcelJS.Workbook();
        wb.creator = BRAND.productName;
        const ws = wb.addWorksheet(String((HEADERS.name && { products: ['Articles', 'Articles', 'السلع'], customers: ['Customers', 'Clients', 'الزبائن'], employees: ['Employees', 'Employés', 'العمال'], suppliers: ['Suppliers', 'Fournisseurs', 'الموردون'] }[dataType]?.[at]) || dataType), {
            views: [{ rightToLeft: rtl, state: 'frozen', ySplit: 1 }],
        });
        const align = { readingOrder: rtl ? 'rtl' : 'ltr', vertical: 'middle' };
        ws.addRow(fields.map(f => (HEADERS[f] || [f, f, f])[at]));
        ws.getRow(1).height = 30;
        ws.getRow(1).eachCell((cell, n) => {
            const needed = mapping.required.includes(fields[n - 1]);
            cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: needed ? 'FFB45309' : 'FF1F3A5F' } };
            cell.alignment = { ...align, horizontal: 'center', wrapText: true };
        });
        // What to write, on the title itself (the lines under it stay empty: nothing to delete before importing)
        ws.getRow(1).eachCell((cell, n) => { const what = (HOW_FIELD[fields[n - 1]] || [])[at]; if (what) cell.note = what; });
        fields.forEach((f, i) => { ws.getColumn(i + 1).width = Math.max(12, ((HEADERS[f] || [f, f, f])[at]).length + 4); });
        // What to write in each column
        const how = wb.addWorksheet(HOW.title[at], { views: [{ rightToLeft: rtl }] });
        how.addRow([HOW.title[at]]).font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1F3A5F' } };
        for (const rule of ['rule1', 'rule2', 'rule3']) how.addRow([HOW[rule][at]]).font = { name: 'Arial', size: 10 };
        how.addRow([]);
        const head = how.addRow([HOW.column[at], HOW.needed[at], HOW.what[at]]);
        head.eachCell(cell => { cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A5F' } }; });
        for (const f of fields) {
            const row = how.addRow([(HEADERS[f] || [f, f, f])[at], mapping.required.includes(f) ? HOW.yes[at] : HOW.no[at], (HOW_FIELD[f] || ['', '', ''])[at]]);
            row.eachCell(cell => { cell.font = { name: 'Arial', size: 10 }; cell.alignment = { readingOrder: rtl ? 'rtl' : 'ltr', wrapText: true }; });
        }
        // The example, in the shop's language, away from the sheet that is imported
        how.addRow([]);
        how.addRow([HOW.example[at]]).font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF1F3A5F' } };
        const exampleHead = how.addRow(fields.map(f => (HEADERS[f] || [f, f, f])[at]));
        exampleHead.eachCell(cell => { cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1F3A5F' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF6' } }; });
        for (const sample of this.getSampleData(dataType, at)) {
            const row = how.addRow(sample.map(v => (v === '' ? null : v)));
            row.eachCell(cell => { cell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF5B6575' } }; cell.alignment = { readingOrder: rtl ? 'rtl' : 'ltr' }; });
        }
        how.getColumn(1).width = 26; how.getColumn(2).width = 12; how.getColumn(3).width = 60;
        return Buffer.from(await wb.xlsx.writeBuffer());
    }

    /**
     * The example lines of a template, in its language (at: 0 English, 1 French, 2 Arabic).
     * Same order as the headers.
     */
    getSampleData(dataType, at = 1) {
        const say = (...texts) => texts[at] ?? texts[1];
        switch (dataType) {
            case 'products': {
                // name, price, sold by, quantity, cost, sku, barcode, category, brand, description, min stock, tax.
                // One row per article (SKU made by the program when empty); kg = sold by weight
                const grocery = say('Grocery', 'Épicerie', 'مواد غذائية');
                return [
                    [say('Semolina 1 kg', 'Semoule 1 kg', 'سميد 1 كغ'), 120, '', 24, 100, '', '', grocery, '', '', 5, 0],
                    [say('Oil 5 L', 'Huile 5 L', 'زيت 5 ل'), 650, '', 6, 610, '', '', grocery, '', '', 2, 0],
                    [say('Tomatoes', 'Tomates', 'طماطم'), 120, 'kg', 12.5, 80, '', '', say('Vegetables', 'Légumes', 'خضر'), '', '', 5, 0],
                ];
            }
            case 'customers':
                return [[say('Amina B.', 'Amina B.', 'أمينة ب.'), '', '0555 12 34 56', say('Algiers', 'Alger', 'الجزائر'), '', 0]];
            case 'employees':
                return [[say('Karim', 'Karim', 'كريم'), '1234', '', 'cashier']];
            case 'suppliers':
                return [[say('Oran wholesale', 'Grossiste Oran', 'جملة وهران'), say('Mohamed', 'Mohamed', 'محمد'), '0550 11 22 33', '', say('Oran', 'Oran', 'وهران'), '']];
            default:
                return [];
        }
    }
}

module.exports = new ExcelService();

/**
 * The code and quantity columns of a sheet, wherever its header row is (the
 * shop's own stock file has the shop's lines above its table): first QR, else
 * the reference, else the barcode. Headers in Arabic, French or English.
 * @returns {{ rows: { row, code, quantity }[], found: boolean }}
 */
const CODE_HEADERS = [
    ['رمز qr', 'code qr', 'qr code', 'qr', 'qr_code'],
    ['المرجع (sku)', 'référence (sku)', 'reference (sku)', 'sku', 'المرجع', 'référence', 'reference', 'réf', 'ref'],
    ['الباركود', 'code-barres', 'barcode', 'code barre', 'ean'],
    // An article sold by weight without a barcode: its scale number
    ['plu'],
];
const PLU_AT = CODE_HEADERS.length - 1;
const TOTAL_ROW = /^(المجموع|total|totaux)(\s|$)/i;
const QUANTITY_HEADERS = ['الكمية', 'quantité', 'quantite', 'quantity', 'qty', 'qté', 'counted', 'compté', 'المعدود', 'القطع', 'pièces', 'pieces'];
// Kilograms of an article sold by weight (the shop's stock file has both columns)
const WEIGHT_HEADERS = ['الوزن (كغ)', 'poids (kg)', 'weight (kg)', 'الوزن', 'poids', 'weight', 'kg', 'كغ'];
module.exports.readCountedSheet = function readCountedSheet(buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    for (const name of workbook.SheetNames) {
        // Raw values: a stock of 0 shows «-» in the shop's file, the cell holds 0
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: '' });
        for (let h = 0; h < Math.min(40, data.length); h++) {
            const headers = (data[h] || []).map(v => String(v).trim().toLowerCase());
            const quantityAt = [headers.findIndex(v => QUANTITY_HEADERS.includes(v)), headers.findIndex(v => WEIGHT_HEADERS.includes(v))].filter(i => i >= 0);
            const codeAt = CODE_HEADERS.map(names => headers.findIndex(v => names.includes(v)));
            if (!quantityAt.length || !codeAt.some(i => i >= 0)) continue;
            const rows = [];
            for (let r = h + 1; r < data.length; r++) {
                const line = data[r] || [];
                const which = codeAt.findIndex(i => i >= 0 && String(line[i] ?? '').trim());
                const code = which >= 0 ? String(line[codeAt[which]]).trim() : '';
                // Pieces, or else the kilograms (one of the two is empty)
                const quantity = quantityAt.map(i => String(line[i] ?? '').replace(/[\s\u00a0\u202f]/g, '').replace(',', '.')).find(Boolean) || '';
                // Nothing written in the quantity: not counted (its stock is kept)
                if (!quantity) continue;
                // The totals row of the shop's own file: not a line
                if (!code && line.some(v => TOTAL_ROW.test(String(v).trim()))) continue;
                // A line without a code is kept: the import says which row could not be matched
                rows.push(which === PLU_AT ? { row: r + 1, code, quantity, plu: true } : { row: r + 1, code, quantity });
            }
            return { rows, found: true, sheet: name };
        }
    }
    return { rows: [], found: false };
};
