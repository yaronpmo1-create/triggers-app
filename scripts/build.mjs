// Copies the web files into www (the folder Capacitor packs into the APK) and stamps the content version.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const www = path.join(root, 'www');
const files = ['index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });
for (const f of files) fs.copyFileSync(path.join(root, f), path.join(www, f));
const version = Number(process.env.GITHUB_RUN_NUMBER || process.env.TR_VERSION || 0);
fs.writeFileSync(path.join(www, 'bundle.json'), JSON.stringify({ version }));
console.log('www ready:', files.length, 'files, version', version);
