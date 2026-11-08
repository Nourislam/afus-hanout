// Parts of Node the web demo never uses (network, e-mail).
const notInDemo = () => { throw new Error('not in the demo'); };
// node-fetch / axios (online store connectors): no network in the demo
function offline() { return Promise.reject(new Error('demo: offline')); }
// The shop's own server (phone, price checker) answers nothing in the page, but turns on, so its settings can be shown
const server = () => ({ listen(port, cb) { setTimeout(() => cb?.(), 0); return this; }, once() { return this; }, on() { return this; }, close(cb) { setTimeout(() => cb?.(), 0); }, address: () => ({ port: 4560 }) });
const empty = Object.assign(offline, { createTransport: () => ({ sendMail: notInDemo, verify: notInDemo }), createServer: server, request: notInDemo, get: notInDemo, post: offline, create: () => empty });
export default empty;
export const { createTransport, createServer, request, get } = empty;
