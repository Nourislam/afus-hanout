// What Node gives every file and the browser does not: process, Buffer, global.
import { Buffer } from 'buffer';

globalThis.global = globalThis;
globalThis.Buffer = Buffer;
globalThis.process = globalThis.process || {};
Object.assign(globalThis.process, {
    platform: 'win32', arch: 'x64', env: { ...(globalThis.process.env || {}), NODE_ENV: 'production' },
    versions: { electron: '33.0.0', chrome: '130.0.0' },
    argv: [], execPath: '/afus/app', resourcesPath: '/afus/resources', type: 'browser',
    cwd: () => '/afus', on: () => {}, once: () => {}, exit: () => {}, nextTick: (fn, ...a) => queueMicrotask(() => fn(...a)),
    hrtime: Object.assign(() => [0, 0], { bigint: () => BigInt(Date.now()) * 1000000n }), memoryUsage: () => ({}), uptime: () => performance.now() / 1000,
    getSystemVersion: () => '10.0', emitWarning: () => {},
});
