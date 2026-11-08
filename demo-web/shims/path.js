// POSIX path functions for the web demo's in-memory files.
const normalizeParts = (parts, absolute) => {
    const out = [];
    for (const p of parts) {
        if (!p || p === '.') continue;
        if (p === '..') { if (out.length && out[out.length - 1] !== '..') out.pop(); else if (!absolute) out.push('..'); } else out.push(p);
    }
    return out;
};
const path = {
    sep: '/', delimiter: ':',
    normalize(p) { const abs = String(p).startsWith('/'); const s = normalizeParts(String(p).split('/'), abs).join('/'); return (abs ? '/' : '') + s || (abs ? '/' : '.'); },
    join(...a) { return path.normalize(a.filter(x => x !== '' && x != null).join('/')); },
    resolve(...a) { let r = ''; for (const p of a) { const s = String(p ?? ''); if (!s) continue; r = s.startsWith('/') ? s : `${r}/${s}`; } return path.normalize(r.startsWith('/') ? r : `/${r}`); },
    isAbsolute: (p) => String(p).startsWith('/'),
    dirname(p) { const s = String(p).replace(/\/+$/, ''); const i = s.lastIndexOf('/'); return i <= 0 ? (s.startsWith('/') ? '/' : '.') : s.slice(0, i); },
    basename(p, ext) { const b = String(p).replace(/\/+$/, '').split('/').pop(); return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b; },
    extname(p) { const b = path.basename(p); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(i) : ''; },
    relative(from, to) { const f = path.resolve(from).split('/').filter(Boolean); const t = path.resolve(to).split('/').filter(Boolean); let i = 0; while (i < f.length && f[i] === t[i]) i++; return [...f.slice(i).map(() => '..'), ...t.slice(i)].join('/'); },
    parse(p) { const base = path.basename(p); const ext = path.extname(p); return { root: String(p).startsWith('/') ? '/' : '', dir: path.dirname(p), base, ext, name: ext ? base.slice(0, -ext.length) : base }; },
    format: (o) => path.join(o.dir || o.root || '', o.base || `${o.name || ''}${o.ext || ''}`),
};
path.posix = path;
path.win32 = path;
export default path;
export const { join, resolve, dirname, basename, extname, relative, normalize, isAbsolute, sep, delimiter, parse, format, posix, win32 } = path;
