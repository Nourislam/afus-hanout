// sql.js for the browser: the same SQLite the program uses, its WebAssembly file served with the demo.
import initSqlJs from 'sql.js/dist/sql-wasm.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

export default function init(options = {}) {
    return initSqlJs({ ...options, locateFile: () => wasmUrl });
}
