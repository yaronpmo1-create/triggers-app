// יוצר חבילת עדכון תוכן מ-www/: ota-out/bundle.zip ו-ota-out/ota.json
// הרצה אחרי scripts/build.mjs. ה-zip נכתב ללא תלות חיצונית (deflate מ-zlib).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { NATIVE_API } from './ota-config.mjs';

const root = path.resolve(import.meta.dirname, '..');
const www = path.join(root, 'www');
const out = path.join(root, 'ota-out');

const T = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
export const crc32 = (b) => { let c = -1; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };

export function zipFiles(files) { // files: [{name, data:Buffer}]
  const parts = [], central = []; let off = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8'), raw = f.data, def = zlib.deflateRawSync(raw), crc = crc32(raw);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(def.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(name.length, 26);
    parts.push(lh, name, def);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(def.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
    central.push(ch, name);
    off += 30 + name.length + def.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}

function walk(dir, rel = '') {
  const r = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) { r.push(...walk(path.join(dir, e.name), p)); } else r.push({ name: p, data: fs.readFileSync(path.join(dir, e.name)) });
  }
  return r;
}

if (import.meta.url === new URL(process.argv[1], 'file:///').href || process.argv[1]?.endsWith('make-ota.mjs')) {
  const version = JSON.parse(fs.readFileSync(path.join(www, 'bundle.json'), 'utf8')).version;
  const files = walk(www).sort((a, b) => (a.name < b.name ? -1 : 1));
  const zip = zipFiles(files);
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'bundle.zip'), zip);
  const notesFile = path.join(root, 'notes.txt');
  const notes = fs.existsSync(notesFile) ? fs.readFileSync(notesFile, 'utf8').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 8) : [];
  const meta = { version, minNative: NATIVE_API, size: zip.length, sha256: crypto.createHash('sha256').update(zip).digest('hex'), notes };
  fs.writeFileSync(path.join(out, 'ota.json'), JSON.stringify(meta));
  console.log('ota ready', JSON.stringify(meta), files.length + ' files');
}
