// A file system in the page's memory for the web demo: the program's own
// files (schemas, themes, photos) are put in it at start; what the demo writes
// stays here and is gone when the page is closed or reloaded.
import { Buffer } from 'buffer';
import path from './path.js';

const files = new Map(); // absolute path -> Buffer
const dirs = new Set(['/']);
const norm = (p) => path.resolve(String(p));
const parentsOf = (p) => { const out = []; let d = path.dirname(p); while (d && !dirs.has(d)) { out.push(d); d = path.dirname(d); } return out; };
const enoent = (p, op) => Object.assign(new Error(`ENOENT: no such file or directory, ${op} '${p}'`), { code: 'ENOENT' });
const toBuffer = (data, enc) => (Buffer.isBuffer(data) ? Buffer.from(data) : data instanceof Uint8Array ? Buffer.from(data) : Buffer.from(String(data), typeof enc === 'string' ? enc : enc?.encoding || 'utf8'));
const encOf = (o) => (typeof o === 'string' ? o : o?.encoding || null);

export function seed(p, data) {
    const abs = norm(p);
    parentsOf(abs).forEach(d => dirs.add(d));
    files.set(abs, toBuffer(data));
}

function statOf(abs) {
    const isFile = files.has(abs);
    const isDir = dirs.has(abs);
    if (!isFile && !isDir) return null;
    const size = isFile ? files.get(abs).length : 0;
    const t = new Date();
    return { size, isFile: () => isFile, isDirectory: () => isDir, isSymbolicLink: () => false, mtime: t, mtimeMs: t.getTime(), ctime: t, birthtime: t, mode: 0o644 };
}

const fs = {
    existsSync: (p) => files.has(norm(p)) || dirs.has(norm(p)),
    readFileSync(p, o) {
        const abs = norm(p);
        if (!files.has(abs)) throw enoent(abs, 'open');
        const b = files.get(abs);
        const enc = encOf(o);
        return enc ? b.toString(enc) : Buffer.from(b);
    },
    writeFileSync(p, data, o) { const abs = norm(p); parentsOf(abs).forEach(d => dirs.add(d)); files.set(abs, toBuffer(data, o)); },
    appendFileSync(p, data, o) { const abs = norm(p); const old = files.get(abs) || Buffer.alloc(0); fs.writeFileSync(abs, Buffer.concat([old, toBuffer(data, o)])); },
    mkdirSync(p) { const abs = norm(p); parentsOf(abs).forEach(d => dirs.add(d)); dirs.add(abs); return abs; },
    readdirSync(p, o) {
        const abs = norm(p);
        if (!dirs.has(abs)) throw enoent(abs, 'scandir');
        const pre = abs === '/' ? '/' : `${abs}/`;
        const names = new Set();
        for (const k of [...files.keys(), ...dirs]) if (k.startsWith(pre) && k !== abs) names.add(k.slice(pre.length).split('/')[0]);
        const list = [...names].sort();
        if (o && o.withFileTypes) return list.map(name => { const s = statOf(`${pre}${name}`); return { name, isFile: s.isFile, isDirectory: s.isDirectory, isSymbolicLink: () => false }; });
        return list;
    },
    statSync(p, o) { const s = statOf(norm(p)); if (!s) { if (o && o.throwIfNoEntry === false) return undefined; throw enoent(norm(p), 'stat'); } return s; },
    lstatSync(p, o) { return fs.statSync(p, o); },
    accessSync(p) { if (!fs.existsSync(p)) throw enoent(norm(p), 'access'); },
    unlinkSync(p) { const abs = norm(p); if (!files.delete(abs)) throw enoent(abs, 'unlink'); },
    rmSync(p) { const abs = norm(p); files.delete(abs); dirs.delete(abs); for (const k of [...files.keys()]) if (k.startsWith(`${abs}/`)) files.delete(k); for (const d of [...dirs]) if (d.startsWith(`${abs}/`)) dirs.delete(d); },
    rmdirSync(p) { fs.rmSync(p); },
    renameSync(a, b) { const from = norm(a); if (!files.has(from)) throw enoent(from, 'rename'); fs.writeFileSync(b, files.get(from)); files.delete(from); },
    copyFileSync(a, b) { const from = norm(a); if (!files.has(from)) throw enoent(from, 'copyfile'); fs.writeFileSync(b, files.get(from)); },
    realpathSync: (p) => norm(p),
    openSync: () => 3, closeSync: () => {}, fsyncSync: () => {}, writeSync: () => 0,
    createWriteStream: () => ({ write() { return true; }, end() {}, on() { return this; }, once() { return this; } }),
    watch: () => ({ close() {} }),
};
fs.promises = Object.fromEntries(Object.entries(fs).filter(([, v]) => typeof v === 'function').map(([k, v]) => [k.replace(/Sync$/, ''), async (...a) => v(...a)]));
fs.promises.access = async (p) => fs.accessSync(p);
fs.constants = { F_OK: 0, R_OK: 4, W_OK: 2, X_OK: 1 };

export default fs;
export const { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, lstatSync, accessSync, unlinkSync, rmSync, rmdirSync, renameSync, copyFileSync, appendFileSync, realpathSync, openSync, closeSync, fsyncSync, writeSync, createWriteStream, watch, constants } = fs;
export const promises = fs.promises;
