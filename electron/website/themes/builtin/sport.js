// Sport: heavy capital titles, round buttons, square photos on light grey,
// a bright accent: the look of the big sports brands. Shoes and sportswear.
const SANS = "'Afus Sans', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

module.exports = {
    id: 'sport',
    version: 1,
    name: { ar: 'رياضي', fr: 'Sport', en: 'Sport' },
    description: {
        ar: 'عناوين عريضة جدًا، أزرار مستديرة، صور مربعة على خلفية رمادية فاتحة ولون بارز. للأحذية والملابس الرياضية.',
        fr: 'Titres très gras en capitales, boutons ronds, photos carrées sur gris clair et une couleur vive. Chaussures et sportswear.',
        en: 'Heavy capital titles, round buttons, square photos on light grey and one bright colour. Shoes and sportswear.',
    },
    tags: ['sport', 'men', 'shoes'],
    tokens: {
        colors: { background: '#ffffff', surface: '#f5f5f5', text: '#111111', muted: '#707072', primary: '#111111', onPrimary: '#ffffff', accent: '#fa5400', sale: '#d43f21', border: '#e5e5e5' },
        fonts: {
            heading: "'Helvetica Neue', 'Arial Black', Arial, 'Afus Sans', sans-serif",
            body: SANS,
        },
        type: { baseSize: 16, scale: 1.4, headingWeight: '900', headingCase: 'upper', headingTracking: -0.03, bodyTracking: 0 },
        shape: { radius: 8, buttonRadius: 999, cardRadius: 0 },
        layout: { container: 1440, sectionGap: 72, gridGap: 12 },
        style: { shadow: 'none', border: 1, imageFilter: 'none' },
    },
    header: { style: 'inline', sticky: true, announcement: true, nav: 'inline', search: true },
    productCard: { imageRatio: '1/1', style: 'plain', nameCase: 'none', align: 'start', showBrand: false, showColors: true, showSizes: false, badge: 'text' },
    productPage: { layout: 'split', gallery: 'thumbs', sizes: 'buttons', colors: 'swatches', sticky: true, related: 4 },
    categoryPage: { desktopColumns: 3, mobileColumns: 2, filters: true, banner: false },
    footer: { style: 'dark' },
    home: [
        // Like the promotion-led themes: action picture, a band of offers, three big categories, tabs
        { type: 'hero', variant: 'full', cta: 'all' },
        { type: 'marquee', style: 'bold' },
        { type: 'collage', style: 'trio' },
        { type: 'tabs', limit: 8, columns: 4 },
        { type: 'promo', style: 'banner' },
        { type: 'imageText', style: 'overlay', photo: 2, topic: 'sale' },
        { type: 'products', source: 'available', limit: 8, layout: 'grid', columns: 4 },
        { type: 'trust', style: 'strip' },
        { type: 'contact', style: 'card', whatsapp: true },
    ],
};
