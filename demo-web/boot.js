// The web demo: the real Afus Hanout, its main process and its window in one
// page, with the demo grocery made at start. Nothing is sent anywhere and nothing is
// kept: reloading the page gives the demo shop as new.
import './shims/globals.js';
import { loadAssets } from './assets.js';
import { whenWindow } from './shims/electron.js';

// Straight into the demo shop, in the language of the address (?lang=fr) or Arabic
const asked = new URLSearchParams(location.search).get('lang');
const lang = ['ar', 'fr', 'en'].includes(asked) ? asked : 'ar';
// The program knows it is the web demo (its demo bar offers the tour and the way to order)
// Served at hanout-demo/ next to the Afus website's hanout/ page; siteUrl: back to the website
window.__AFUS_WEB_DEMO__ = {
    orderUrl: lang === 'ar' ? '../hanout/#order' : '../fr/hanout/#order',
    siteUrl: lang === 'ar' ? '../' : '../fr/',
};
document.documentElement.lang = lang;
document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

const bar = document.getElementById('demo-loading-bar');
await loadAssets((p) => { if (bar) bar.style.width = `${Math.round(10 + p * 50)}%`; });

// The program's main process, as on a computer
await import('../electron/main.js');
await whenWindow;
await import('../electron/preload.js');
if (bar) bar.style.width = '70%';

await window.electronAPI.demo.enter({ lang });
if (bar) bar.style.width = '95%';

const { watchImages } = await import('./images.js');
watchImages();
await import('../src/main.jsx');
await import('./tour.js');
document.getElementById('demo-loading')?.remove();
