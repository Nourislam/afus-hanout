#!/usr/bin/env node
// Before the program starts or is built: are the packages of package-lock.json
// installed, at the versions it names? After pulling a version that adds one
// (exceljs for the Excel files, for example), Electron would otherwise start
// without it and only some screens would fail ("Cannot find module …",
// "No handler registered for 'exports:save'"). Read-only: nothing is changed.
//   node scripts/check-deps.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));

const wanted = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
const problems = [];
for (const name of wanted) {
    const locked = lock.packages?.[`node_modules/${name}`];
    if (!locked || locked.optional) continue;
    const file = path.join(root, 'node_modules', name, 'package.json');
    if (!fs.existsSync(file)) { problems.push(`${name}: not installed`); continue; }
    const installed = JSON.parse(fs.readFileSync(file, 'utf8')).version;
    if (locked.version && installed !== locked.version) problems.push(`${name}: ${installed} installed, ${locked.version} expected`);
}

if (problems.length) {
    console.error('\nThe installed packages do not match package-lock.json:');
    for (const p of problems) console.error(`  - ${p}`);
    console.error('\nRun this once in the project folder, then start again:\n\n  npm install\n');
    process.exit(1);
}
