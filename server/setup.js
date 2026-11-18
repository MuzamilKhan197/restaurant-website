import { readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
export async function ensureSetup(root) {
  const file = resolve(root, '.env');
  try { await access(file); }
  catch { await writeFile(file, `# Initial local administrator. Change the password in the dashboard after signing in.\nADMIN_EMAIL=admin@restaurant.local\nADMIN_PASSWORD=${randomBytes(24).toString('base64url')}\nPORT=3000\n`, { flag: 'wx', mode: 0o600 }); }
  const contents = await readFile(file, 'utf8');
  return Object.fromEntries(contents.split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).trim().replace(/^("|')|("|')$/g, '')]; }));
}
