// The guided tour of the web demo: a small panel that walks a grocer through
// what Afus Hanout does, one screen at a time, in Arabic or French. It only
// opens screens of the program; the visitor can try everything there.
const LANG = document.documentElement.lang === 'fr' ? 'fr' : 'ar';
const T = (ar, fr) => (LANG === 'fr' ? fr : ar);

const STEPS = [
    { title: T('مرحبًا في حانوت تجريبي', 'Bienvenue dans une épicerie de démo'), text: T('هذا هو البرنامج الحقيقي ببيانات «حانوت النور» التجريبي. اختر «إسلام نوري» (المالك) واكتب الرمز 1111.', "C'est le vrai programme, avec l'épicerie d'exemple « Hanout En-Nour ». Choisissez « Islam Nouri » (le patron) et tapez 1111.") },
    { route: '/', title: T('صباح الحانوت', 'Le matin à l’épicerie'), text: T('مبيعات اليوم والربح والصندوق، وبطاقات قليلة تهمّك اليوم: من يمرّ من الموزعين وما ينقصك عنده، وما تبيعه قبل أن يفسد.', "Ventes, bénéfice et caisse du jour, et quelques cartes utiles : quel distributeur passe et ce qui manque, ce qu'il faut vendre avant péremption.") },
    { route: '/pos', title: T('البيع في ثوانٍ', 'La caisse en quelques secondes'), text: T('امسح الباركود، أو اضغط صورة الخبز والخضر. البيع بالقطعة والكرطونة والكيلوغرام وملصق الميزان، الدفع نقدًا أو بريدي باي أو بالكريدي، و«تراجع» بدل الرسائل. جرّب بيعًا الآن!', 'Scannez, ou touchez la photo du pain et des légumes. À la pièce, au carton, au kilo ou par étiquette de balance ; espèces, Baridi Pay ou crédit, et « Annuler » au lieu des messages. Essayez une vente !') },
    { route: '/credit-sales', title: T('الكارني', 'Le karni (crédit)'), text: T('كل زبون باسمه وما عليه ومنذ متى. «خلّص بعض» في لمسة، وكشف مؤدب بواتساب، وسقف لكل زبون.', 'Chaque client avec ce qu’il doit et depuis quand. « Payer une partie » en un geste, relevé poli par WhatsApp, plafond par client.') },
    { route: '/distributors', title: T('الموزعون ويوم مرورهم', 'Les distributeurs et leur jour de passage'), text: T('يوم مرور كل موزع، والطلبية المقترحة بالكرطونة تُرسل بواتساب. والاستلام السريع: المخزون وسعر الشراء والدين في خطوة، مع سعر بيع مقترح حين يرتفع سعره.', 'Le jour de passage de chaque distributeur et la commande suggérée en cartons, envoyée par WhatsApp. Réception rapide : stock, prix d’achat et dette en une fois, avec un prix de vente suggéré quand il augmente.') },
    { route: '/seasons', title: T('رمضان والأعياد', 'Ramadan et les fêtes'), text: T('بالتقويم الهجري: قبل رمضان والعيدين والدخول المدرسي بثلاثة أسابيع، ما بِعته أكثر من العادة العام الماضي وما ينقصك.', 'Selon le calendrier hégirien : trois semaines avant le Ramadan, l’Aïd et la rentrée, ce qui s’est vendu plus que d’habitude l’an dernier et ce qui vous manque.') },
    { route: '/ask', title: T('اسأل حانوتك', 'Demandez à votre magasin'), text: T('أسئلة جاهزة كأزرار: ماذا بعت أكثر هذا الأسبوع، كم ربحت اليوم، من عليه أكثر، ماذا سينفد. الجواب من أرقام محلك، بلا إنترنت.', 'Des questions prêtes en boutons : meilleures ventes de la semaine, bénéfice du jour, qui doit le plus, ce qui va manquer. La réponse vient de vos chiffres, sans internet.') },
    { route: '/settings?tab=phone', title: T('الهاتف وقارئ الأسعار', 'Le téléphone et le vérificateur de prix'), text: T('هاتفك يقرأ الأسعار ويجرد الرفوف، ولوحة عند الرفوف تعرض السعر للزبون، من حاسوب المحل على WiFi المحل فقط. الاقتران برمز QR مرة واحدة.', 'Votre téléphone lit les prix et compte les rayons, une tablette affiche le prix au client, depuis l’ordinateur du magasin, sur son WiFi seulement. Association par QR code, une fois.') },
    { route: '/settings?tab=scale', title: T('ميزان الملصقات', 'La balance étiqueteuse'), text: T('الصندوق يقرأ ملصق الميزان، وقائمة الميزان (PLU) ملف أو ورقة، مع تنبيه حين يتغير سعر لم يدخل الميزان بعد.', 'La caisse lit l’étiquette de la balance, et la liste de la balance (PLU) en fichier ou en feuille, avec un rappel quand un prix a changé.') },
    { final: true, title: T('أعجبك البرنامج؟', 'Le programme vous plaît ?'), text: T('نأتي إلى محلك: التنصيب، إدخال سلعك وكارنيك القديم، وتدريب العائلة والعمال. يعمل بدون إنترنت، وبياناتك عندك.', 'Nous venons à votre magasin : installation, saisie de vos articles et de votre ancien carnet, formation de la famille et des employés. Sans internet, vos données restent chez vous.') },
];

const CSS = `
#afus-tour{position:fixed;inset-inline-end:20px;bottom:20px;z-index:2147483000;width:min(380px,calc(100vw - 32px));background:#fff;color:#18181b;border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.35);font-family:'Cairo Variable','Inter Variable',system-ui,sans-serif;overflow:hidden;direction:${LANG === 'ar' ? 'rtl' : 'ltr'}}
#afus-tour .tt-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px 0}
#afus-tour .tt-step{font-size:12px;font-weight:700;color:#6366f1;letter-spacing:.04em}
#afus-tour .tt-x{background:none;border:0;font-size:22px;line-height:1;cursor:pointer;color:#71717a;width:36px;height:36px;border-radius:10px}
#afus-tour .tt-x:hover{background:#f4f4f5}
#afus-tour h3{margin:6px 18px 6px;font-size:19px;line-height:1.35}
#afus-tour p{margin:0 18px 14px;font-size:14.5px;line-height:1.7;color:#3f3f46}
#afus-tour .tt-bar{display:flex;height:5px;margin:0 18px 12px;border-radius:9px;background:#e4e4e7;overflow:hidden}
#afus-tour .tt-bar i{flex:none;height:100%;background:#6366f1;border-radius:9px;transition:width .25s}
#afus-tour .tt-row{display:flex;gap:8px;padding:12px 18px 16px;border-top:1px solid #f4f4f5}
#afus-tour button.tt-btn,#afus-tour a.tt-btn{flex:1;min-height:44px;border-radius:12px;border:1px solid #e4e4e7;background:#fff;color:#18181b;font:inherit;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;text-decoration:none}
#afus-tour .tt-primary{background:#6366f1 !important;border-color:#6366f1 !important;color:#fff !important}
#afus-tour .tt-note{margin:-6px 18px 12px;font-size:12.5px;color:#b45309;background:#fffbeb;border-radius:10px;padding:8px 10px}
@media (prefers-reduced-motion:no-preference){#afus-tour{animation:afus-tour-in .25s ease-out}}
@keyframes afus-tour-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
`;

let index = 0;
let box = null;

function go(route) {
    if (!route) return;
    window.location.hash = `#${route}`;
}

function render() {
    const s = STEPS[index];
    const last = index === STEPS.length - 1;
    const narrow = window.innerWidth < 1024;
    box.innerHTML = `
        <div class="tt-head"><span class="tt-step">${T('الخطوة', 'Étape')} ${index + 1} / ${STEPS.length}</span><button class="tt-x" type="button" aria-label="${T('إغلاق', 'Fermer')}">×</button></div>
        <h3>${s.title}</h3><p>${s.text}</p>
        ${index === 0 && narrow ? `<div class="tt-note">${T('البرنامج مصمم للحاسوب: افتح التجربة على حاسوب لترى كل شيء.', 'Le programme est fait pour un ordinateur : ouvrez la démo sur un PC pour tout voir.')}</div>` : ''}
        <div class="tt-bar" role="progressbar" aria-valuemin="1" aria-valuemax="${STEPS.length}" aria-valuenow="${index + 1}"><i style="width:${Math.round(((index + 1) / STEPS.length) * 100)}%"></i></div>
        <div class="tt-row">
            ${index > 0 ? `<button class="tt-btn" type="button" data-prev>${T('السابق', 'Précédent')}</button>` : ''}
            ${last ? `<a class="tt-btn tt-primary" href="${window.__AFUS_WEB_DEMO__?.orderUrl || '../'}" target="_top">${T('اطلب أفوس حانوت', 'Obtenir Afus Hanout')}</a>` : `<button class="tt-btn tt-primary" type="button" data-next>${index === 0 ? T('ابدأ الجولة', 'Commencer') : T('التالي', 'Suivant')}</button>`}
        </div>`;
    box.querySelector('.tt-x').onclick = close;
    box.querySelector('[data-prev]')?.addEventListener('click', () => { index -= 1; go(STEPS[index].route); render(); });
    box.querySelector('[data-next]')?.addEventListener('click', () => { index += 1; go(STEPS[index].route); render(); });
}

function close() { box?.remove(); box = null; }

export function openTour(at = 0) {
    if (!document.getElementById('afus-tour-css')) {
        const st = document.createElement('style'); st.id = 'afus-tour-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    index = at;
    if (!box) { box = document.createElement('section'); box.id = 'afus-tour'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', T('جولة مشروحة', 'Visite guidée')); document.body.appendChild(box); }
    render();
}

window.__AFUS_WEB_DEMO__ = Object.assign(window.__AFUS_WEB_DEMO__ || {}, { tour: () => openTour(0) });
openTour(0);
