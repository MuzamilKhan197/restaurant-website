import fs from 'node:fs/promises';
import path from 'node:path';
import { format } from 'prettier';
const root = process.cwd();
const target = path.resolve((await fs.readFile('phase4-build-target.txt', 'utf8')).trim());
const parent = path.dirname(target);
if (
  !['C:/workspace', 'C:/Users/dell/AppData/Local/Temp']
    .map((p) => path.resolve(p))
    .includes(parent) ||
  !path.basename(target).startsWith('restaurant-phase4-build-')
)
  throw new Error('Unapproved build location');
async function verify(directory) {
  for (const entry of await fs.readdir(path.join(root, directory), { withFileTypes: true })) {
    const name = path.join(directory, entry.name);
    if (entry.isDirectory()) await verify(name);
    else if (/\.(ts|tsx|css)$/.test(name)) {
      const options = {
        filepath: name,
        singleQuote: true,
        semi: true,
        trailingComma: 'all',
        printWidth: 100,
      };
      const [a, b] = await Promise.all([
        fs.readFile(path.join(root, name), 'utf8'),
        fs.readFile(path.join(target, name), 'utf8'),
      ]);
      if ((await format(a, options)) !== (await format(b, options)))
        throw new Error(`Build source differs: ${name}`);
    }
  }
}
await verify('src');
await fs.access(path.join(target, '.next/BUILD_ID'));
const buildRoot = path.join(target, '.next');
await fs.cp(buildRoot, path.join(root, '.next'), {
  recursive: true,
  filter: (input) => {
    const relative = path.relative(buildRoot, input);
    return relative !== 'cache' && !relative.startsWith('cache' + path.sep);
  },
});
await fs.copyFile(path.join(target, 'phase4-build.log'), path.join(root, 'phase4-build.log'));
console.log(
  'Verified matching source and copied the successful production build into the project.',
);
