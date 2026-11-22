// Copies the web files into www (the folder Capacitor packs into the APK).
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const www = path.join(root, 'www');
const files = ['index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });
for (const f of files) fs.copyFileSync(path.join(root, f), path.join(www, f));
console.log('www ready:', files.length, 'files');
