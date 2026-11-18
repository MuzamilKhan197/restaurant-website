import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const files = ['app.js', 'extras.js', 'admin.js', 'data.js'];
for (const directory of ['server', 'scripts', 'lib']) for (const file of await readdir(directory)) if (/\.(js|mjs)$/.test(file)) files.push(`${directory}/${file}`);
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Syntax checked ${files.length} JavaScript modules.`);
