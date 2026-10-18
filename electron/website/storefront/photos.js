/**
 * The website's built-in photos (storefront/photos/, Unsplash licence, see
 * CREDITS.md): shown only where the shop has no picture of its own yet,
 * so no theme ever shows an empty grey box. Pure: the same shop gives the
 * same photos.
 *
 *   heroPhoto(themeId)         the photo of the home page's big picture
 *                              (each theme has its own, matching its kind of shop)
 *   themePhotos(themeId)       the theme's own photos (hero, then its lookbook and
 *                              picture-with-text sections)
 *   categoryPhoto(name, index) a photo matching the category's name
 *                              (ar / fr / en words), else one of the others
 *   PHOTO_FILES                every built-in photo (file names)
 *   readPhoto(file)            its bytes (Buffer), null for any other name
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'photos');
const HERO = ['hero-store.webp', 'hero-boutique.webp', 'hero-rack.webp'];
const BY_KIND = {
    women: ['women.webp', 'women-2.webp'],
    men: ['men.webp', 'shirts.webp'],
    kids: ['kids.webp', 'kids-2.webp'],
    shoes: ['shoes.webp'],
    bags: ['bags.webp'],
    sale: ['sale.webp'],
    jackets: ['jackets.webp'],
    basics: ['folded.webp'],
};
// Words of a category's name, in the three languages of the program
const WORDS = [
    ['kids', /enfant|kid|child|bébé|bebe|baby|garçon|fille|girl|boy|أطفال|اطفال|طفل|بنات|أولاد|اولاد|رضع/i],
    ['women', /femme|women|woman|lady|dame|robe|dress|jupe|skirt|نساء|نسائ|سيدات|فساتين|فستان|عباي|حجاب/i],
    ['men', /homme|\bmen\b|\bman\b|chemise|shirt|costume|suit|رجال|رجالي|قمصان|قميص|بدل/i],
    ['shoes', /chaussure|shoe|basket|sneaker|botte|boot|sandale|أحذية|احذية|حذاء|صندل/i],
    ['bags', /sac|bag|accessoire|accessor|bijou|jewel|ceinture|belt|حقائب|حقيبة|إكسسوار|اكسسوار|أكسسوار|مجوهرات|حزام/i],
    ['jackets', /veste|jacket|manteau|coat|blouson|jaquette|معاطف|معطف|جاكيت|سترات|سترة/i],
    ['sale', /solde|promo|sale|offre|تخفيض|عروض|تنزيلات/i],
    ['basics', /t-?shirt|tee|pull|sweat|pyjama|basic|تيشيرت|كنزة|بيجام/i],
];
// Each theme's own photos: the first is its hero, the others its picture sections
const THEME = {
    luxury: ['look-coats.webp', 'look-suit-dark.webp', 'look-shopping.webp'],
    atelier: ['look-neutral.webp', 'look-suit.webp', 'look-coats.webp'],
    streetwear: ['look-street.webp', 'look-sneakers-2.webp', 'look-denim.webp'],
    sport: ['look-fitness.webp', 'look-runner.webp', 'look-sport.webp'],
    kids: ['look-kids.webp', 'look-girl.webp', 'look-baby.webp', 'look-kid.webp'],
    classic: ['look-flatlay.webp', 'look-classic-flat.webp', 'look-suit.webp'],
    'fashion-modern': ['look-scarf.webp', 'look-coat-street.webp', 'look-rack-color.webp'],
    minimal: ['look-tee.webp', 'look-knit.webp', 'look-neutral.webp'],
};
const ANY = ['folded.webp', 'jackets.webp', 'shirts.webp', 'women.webp', 'men.webp', 'bags.webp', 'shoes.webp', 'kids.webp'];
const PHOTO_FILES = [...new Set([...HERO, ...Object.values(THEME).flat(), ...Object.values(BY_KIND).flat(), ...ANY, 'look-sneakers.webp'])];

const hash = (s) => [...String(s || '')].reduce((h, ch) => (h * 31 + ch.codePointAt(0)) >>> 0, 7);

function heroPhoto(themeId) {
    return THEME[themeId]?.[0] || HERO[hash(themeId) % HERO.length];
}

/** The theme's own photos (a theme without its own: the shop photos). */
function themePhotos(themeId) {
    return THEME[themeId] || HERO;
}

function categoryPhoto(name, index = 0) {
    const kind = WORDS.find(([, re]) => re.test(String(name || '')))?.[0];
    const list = kind ? BY_KIND[kind] : ANY;
    return list[(kind ? 0 : index) % list.length] || ANY[0];
}

const cache = new Map();
function readPhoto(file) {
    if (!PHOTO_FILES.includes(file)) return null;
    if (!cache.has(file)) {
        try { cache.set(file, fs.readFileSync(path.join(DIR, file))); } catch { cache.set(file, null); }
    }
    return cache.get(file);
}

/** For the program's preview (its frame shows data: pictures only). */
function photoDataUrl(file) {
    const data = readPhoto(file);
    return data ? `data:image/webp;base64,${data.toString('base64')}` : '';
}

module.exports = { heroPhoto, themePhotos, categoryPhoto, readPhoto, photoDataUrl, PHOTO_FILES };
