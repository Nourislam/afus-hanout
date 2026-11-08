// The program shows the shop's pictures with its own app:// address (served by
// the main process on a computer). In the web demo the same pictures are in
// the page's memory: each app:// picture is given its in-memory copy.
import fs from './shims/fs.js';
import imageService from '../electron/services/imageService.js';

const TYPES = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
const urls = new Map();

function urlOf(name) {
    if (urls.has(name)) return urls.get(name);
    const file = imageService.safeImagePath(name);
    let url = '';
    try {
        const data = fs.readFileSync(file);
        url = URL.createObjectURL(new Blob([data], { type: TYPES[name.split('.').pop().toLowerCase()] || 'application/octet-stream' }));
    } catch { url = ''; }
    urls.set(name, url);
    return url;
}

function fix(img) {
    const src = img.getAttribute('src') || '';
    if (!src.startsWith('app://')) return;
    let name = src.slice(6).replace(/\/+$/, '');
    try { name = decodeURI(name); } catch { /* as it is */ }
    const url = urlOf(name);
    if (url) img.setAttribute('src', url); else img.removeAttribute('src');
}

export function watchImages(root = document.body) {
    root.querySelectorAll('img[src^="app://"]').forEach(fix);
    new MutationObserver((changes) => {
        for (const c of changes) {
            if (c.type === 'attributes' && c.target.tagName === 'IMG') fix(c.target);
            c.addedNodes?.forEach(n => { if (n.nodeType !== 1) return; if (n.tagName === 'IMG') fix(n); else n.querySelectorAll?.('img[src^="app://"]').forEach(fix); });
        }
    }).observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
}
