import { mkdir, copyFile, cp, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const target = resolve('dist');
await mkdir(target, { recursive: true });
for (const file of ['index.html', '404.html', 'styles.css', 'app.js', 'extras.js', 'data.js', 'admin.html', 'admin.js', 'admin.css', 'robots.txt', 'manifest.webmanifest']) await copyFile(file, resolve(target, file));
for (const directory of ['lib', 'assets']) await cp(directory, resolve(target, directory), { recursive: true });
const files = await readdir(resolve(target, 'assets'));
if (files.length < 12) throw new Error('Missing restaurant images. See README.md.');
for (const file of files) if ((await stat(resolve(target, 'assets', file))).size === 0) throw new Error(`Empty asset: ${file}`);
console.log('Build complete: dist/. Run the Node server with SERVE_DIST=1 for database-backed features.');
