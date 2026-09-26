// Copies the Basic Pitch model shipped in node_modules into public/ so the
// browser can fetch it at runtime (it is lazy-loaded only for chord mode).
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/@spotify/basic-pitch/model');
const dest = join(root, 'public/models/basic-pitch');
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log('Basic Pitch model copied to public/models/basic-pitch');
