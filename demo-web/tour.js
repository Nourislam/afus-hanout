// The guided tour of the web demo: a small panel that walks a shop owner
// through what Afus Boutique does, one screen at a time, in Arabic or French.
// It only opens screens of the program; the visitor can try everything there.
const LANG = document.documentElement.lang === 'fr' ? 'fr' : 'ar';
const T = (ar, fr) => (LANG === 'fr' ? fr : ar);

const STEPS = [
    { title: T('مرحبًا في محل تجريبي', 'Bienvenue dans une boutique de démo'), text: T('هذا هو البرنامج الحقيقي ببيانات محل ملابس تجريبي. اختر حساب «ياسين» (المدير) واكتب الرمز 1111.', "C'est le vrai programme, avec une boutique de vêtements d'exemple. Choisissez « Yacine » (gérant) et tapez 1111.") },
    { route: '/', title: T('لوحة القيادة', 'Tableau de bord'), text: T('مبيعات اليوم والأسبوع، السلع التي ستنفد، والكريدي المتأخر: كل شيء في نظرة واحدة كل صباح.', "Ventes du jour et de la semaine, articles qui vont manquer, crédits en retard : tout d'un coup d'œil chaque matin.") },
    { route: '/pos', title: T('البيع', 'La caisse'), text: T('امسح الباركود أو اضغط على سلعة، اختر المقاس واللون ثم «تحصيل». الدفع نقدًا أو بالكريدي، والتذكرة بالعربية أو الفرنسية. جرّب بيعًا الآن!', 'Scannez ou touchez un article, choisissez taille et couleur, puis « Encaisser ». Espèces ou crédit, ticket en arabe ou en français. Essayez une vente !') },
    { route: '/products', title: T('السلع والمقاسات', 'Articles et tailles'), text: T('كل سلعة بمقاساتها وألوانها ومخزون كل مقاس ولون. إضافة سلعة جديدة تأخذ أقل من دقيقة.', 'Chaque article avec ses tailles, ses couleurs et le stock de chacune. Un nouvel article en moins d’une minute.') },
    { route: '/labels', title: T('الملصقات والباركود', 'Étiquettes et codes-barres'), text: T('اطبع ملصقًا لكل مقاس ولون. يُمسح عند البيع فيخرج من المخزون وحده.', "Une étiquette par taille et couleur. Scannée à la vente, le stock baisse tout seul.") },
    { route: '/credit-sales', title: T('دفتر الكريدي', 'Le cahier de crédit'), text: T('من عليه دين، كم، ومتى يجب أن يدفع. تذكير بالواتساب في ضغطة، وحد لكل زبون.', 'Qui doit combien et quand. Rappel WhatsApp en un clic, plafond par client.') },
    { route: '/reports', title: T('التقارير وذكاء المحل', 'Rapports et intelligence'), text: T('الربح الحقيقي، الأكثر مبيعًا، السلع الراكدة، ومتى يزدحم محلك وماذا تشتري قبل رمضان والعيد والدخول المدرسي.', "Bénéfice réel, meilleures ventes, invendus, heures d'affluence, et quoi acheter avant le Ramadan, l'Aïd et la rentrée.") },
    { route: '/website', title: T('متجري على الإنترنت', 'Ma boutique en ligne'), text: T('موقعك بسلعك وأسعارك بضغطة، 8 ثيمات جميلة، والطلبات تصل إلى البرنامج: الدفع عند الاستلام والتوصيل لـ 58 ولاية.', 'Votre site avec vos articles et prix en un clic, 8 thèmes, les commandes arrivent dans le programme : paiement à la livraison, 58 wilayas.') },
    { route: '/settings?tab=shops', title: T('محلاتي', 'Mes boutiques'), text: T('عندك أكثر من محل؟ اربطها برمز واحد وانسخ السلع والملصقات بين المحلات.', 'Plusieurs boutiques ? Reliez-les avec un code et copiez les articles et étiquettes.') },
    { final: true, title: T('أعجبك البرنامج؟', 'Le programme vous plaît ?'), text: T('نأتي إلى محلك: التنصيب، إدخال سلعك، وتدريب العمال. يعمل بدون إنترنت، وبياناتك عندك.', 'Nous venons à votre boutique : installation, saisie de vos articles, formation. Il marche sans internet, vos données restent chez vous.') },
];

const CSS = `
#afus-tour{position:fixed;inset-inline-end:20px;bottom:20px;z-index:2147483000;width:min(380px,calc(100vw - 32px));background:#fff;color:#18181b;border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.35);font-family:'Cairo Variable','Inter Variable',system-ui,sans-serif;overflow:hidden;direction:${LANG === 'ar' ? 'rtl' : 'ltr'}}
#afus-tour .tt-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px 0}
#afus-tour .tt-step{font-size:12px;font-weight:700;color:#6366f1;letter-spacing:.04em}
#afus-tour .tt-x{background:none;border:0;font-size:22px;line-height:1;cursor:pointer;color:#71717a;width:36px;height:36px;border-radius:10px}
#afus-tour .tt-x:hover{background:#f4f4f5}
#afus-tour h3{margin:6px 18px 6px;font-size:19px;line-height:1.35}
#afus-tour p{margin:0 18px 14px;font-size:14.5px;line-height:1.7;color:#3f3f46}
#afus-tour .tt-bar{height:5px;margin:0 18px 12px;border-radius:9px;background:#e4e4e7;overflow:hidden}
#afus-tour .tt-bar i{display:block;height:100%;background:#6366f1;border-radius:9px;transition:width .25s}
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
            ${last ? `<a class="tt-btn tt-primary" href="${window.__AFUS_WEB_DEMO__?.orderUrl || '../'}" target="_top">${T('اطلب Afus Boutique', 'Obtenir Afus Boutique')}</a>` : `<button class="tt-btn tt-primary" type="button" data-next>${index === 0 ? T('ابدأ الجولة', 'Commencer') : T('التالي', 'Suivant')}</button>`}
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
