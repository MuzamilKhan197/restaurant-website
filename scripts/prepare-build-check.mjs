// Windows webpack rejects '!' in a project path. Prepare an isolated verification
// copy without renaming the user's workspace or reinstalling pinned dependencies.
import fs from 'node:fs';
import path from 'node:path';
const source = process.cwd();
const allowed = path.resolve(process.argv[2] || 'C:/workspace');
if (
  !['C:/workspace', 'C:/Users/dell/AppData/Local/Temp']
    .map((p) => path.resolve(p))
    .includes(allowed)
)
  throw new Error('Unapproved temporary root');
const target = path.join(allowed, 'restaurant-phase4-build-' + Date.now());
if (!target.startsWith(allowed + path.sep) || fs.existsSync(target))
  throw new Error('Unsafe build target');
fs.mkdirSync(target, { recursive: true });
for (const name of [
  'src',
  'public',
  'docs',
  'tests',
  'scripts',
  'supabase',
  'package.json',
  'package-lock.json',
  'next.config.ts',
  'next-env.d.ts',
  'tsconfig.json',
  'postcss.config.mjs',
  'eslint.config.mjs',
  '.prettierrc.json',
  '.env.local',
]) {
  const input = path.join(source, name);
  if (fs.existsSync(input)) fs.cpSync(input, path.join(target, name), { recursive: true });
}
const moduleRoot = path.join(source, 'node_modules');
let files = 0;
function dependencies(input, output) {
  const info = fs.lstatSync(input);
  if (info.isSymbolicLink()) {
    const resolved = fs.realpathSync(input);
    if (!resolved.startsWith(moduleRoot + path.sep)) throw new Error('External dependency link');
    return dependencies(resolved, output);
  }
  if (info.isDirectory()) {
    fs.mkdirSync(output, { recursive: true });
    for (const entry of fs.readdirSync(input))
      if (entry !== '.cache') dependencies(path.join(input, entry), path.join(output, entry));
  } else {
    try {
      fs.linkSync(input, output);
    } catch {
      fs.copyFileSync(input, output);
    }
    files++;
  }
}
dependencies(moduleRoot, path.join(target, 'node_modules'));
// Concurrent Windows directory creation is blocked in this managed runner.
// Pre-create output folders and retain them in this isolated build only.
const config = path.join(target, 'next.config.ts');
const configText = fs.readFileSync(config, 'utf8');
if (!configText.includes('reactStrictMode: true,'))
  throw new Error('Review temporary build configuration');
fs.writeFileSync(
  config,
  configText.replace('reactStrictMode: true,', 'reactStrictMode: true, cleanDistDir: false,'),
);
function outputs(directory) {
  const relative = path.relative(path.join(target, 'src/app'), directory);
  for (const base of ['.next/server/app', '.next/static/chunks/app', '.next/types/app'])
    fs.mkdirSync(path.join(target, base, relative), { recursive: true });
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }))
    if (entry.isDirectory()) outputs(path.join(directory, entry.name));
}
outputs(path.join(target, 'src/app'));
fs.writeFileSync(path.join(source, 'phase4-build-target.txt'), target + '\n');
console.log(`Prepared ${files} dependency files in ${target}`);
