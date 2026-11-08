// Build of the web demo (npm run build:demo -> dist-demo/): the program's own
// main process and window in one page, Electron and Node played by ./shims.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync } from 'fs';

const ROOT = path.resolve(__dirname, '..');
const SHIMS = path.join(__dirname, 'shims');
const PKG = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

// __dirname / __filename of each program file, as the in-memory disk knows it (/app/electron/...)
function nodePaths() {
    return {
        name: 'afus-demo-node-paths',
        enforce: 'pre',
        transform(code, id) {
            if (!id.startsWith(path.join(ROOT, 'electron')) || !/\.(c?js|mjs)$/.test(id)) return null;
            if (!/__dirname|__filename/.test(code)) return null;
            const rel = path.relative(ROOT, id).split(path.sep).join('/');
            return code.replace(/\b__dirname\b/g, JSON.stringify(`/app/${path.posix.dirname(rel)}`)).replace(/\b__filename\b/g, JSON.stringify(`/app/${rel}`));
        },
    };
}

export default defineConfig({
    root: __dirname,
    publicDir: path.join(ROOT, 'public'),
    base: './',
    plugins: [nodePaths(), react()],
    define: { __AFUS_VERSION__: JSON.stringify(PKG.version) },
    resolve: {
        alias: [
            { find: /^electron$/, replacement: path.join(SHIMS, 'electron.js') },
            { find: /^(node:)?fs$/, replacement: path.join(SHIMS, 'fs.js') },
            { find: /^(node:)?path$/, replacement: path.join(SHIMS, 'path.js') },
            { find: /^(node:)?os$/, replacement: path.join(SHIMS, 'os.js') },
            { find: /^(node:)?crypto$/, replacement: path.join(SHIMS, 'crypto.js') },
            { find: /^(node:)?(http|https|net|child_process|zlib)$/, replacement: path.join(SHIMS, 'empty.js') },
            { find: /^(nodemailer|node-fetch|axios)$/, replacement: path.join(SHIMS, 'empty.js') },
            { find: /^sql\.js$/, replacement: path.join(SHIMS, 'sqljs.js') },
        ],
    },
    build: {
        outDir: path.join(ROOT, 'dist-demo'),
        emptyOutDir: true,
        target: 'es2022',
        rollupOptions: { input: path.join(__dirname, 'index.html') },
        commonjsOptions: { include: [/electron[\\/]/, /node_modules/], transformMixedEsModules: true },
        chunkSizeWarningLimit: 6000,
    },
});
