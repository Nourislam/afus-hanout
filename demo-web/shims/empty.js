// Parts of Node the web demo never uses (e-mail, local servers).
const notInDemo = () => { throw new Error('not in the demo'); };
// node-fetch / axios (online store connectors): no network in the demo
function offline() { return Promise.reject(new Error('demo: offline')); }
const empty = Object.assign(offline, { createTransport: () => ({ sendMail: notInDemo, verify: notInDemo }), createServer: () => ({ listen() { return this; }, on() { return this; }, close() {}, address: () => ({ port: 0 }) }), request: notInDemo, get: notInDemo, post: offline, create: () => empty });
export default empty;
export const { createTransport, createServer, request, get } = empty;
