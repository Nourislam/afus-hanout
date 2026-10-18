// The program's own files (schemas, themes, website pictures and fonts) put
// in the demo's in-memory disk, at the paths the program reads them from.
import { seed } from './shims/fs.js';

const ROOT = '/app';
const texts = import.meta.glob(['../electron/**/*.{sql,json,mjs,md,txt,css}', '../electron/website/storefront/assets/*.js'], { query: '?raw', import: 'default', eager: true });
const binaries = import.meta.glob('../electron/**/*.{webp,png,jpg,jpeg,woff2,woff,ttf,ico,svg}', { query: '?url', import: 'default', eager: true });
// '../electron/x' -> '/electron/x'
const at = (file) => `${ROOT}/${file.replace(/^(\.\.\/)+/, '')}`;

export async function loadAssets(onProgress = () => {}) {
    for (const [file, text] of Object.entries(texts)) seed(at(file), text);
    const list = Object.entries(binaries);
    let done = 0;
    await Promise.all(list.map(async ([file, url]) => {
        try {
            const res = await fetch(url);
            if (res.ok) seed(at(file), new Uint8Array(await res.arrayBuffer()));
        } catch { /* a missing picture only leaves its place empty */ }
        onProgress(++done / list.length);
    }));
}
