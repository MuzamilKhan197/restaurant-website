// Run from a normal Windows project terminal when a previous preview owns 3003.
// Never kill a process unless its command identifies this project's Next server.
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const normalized = root.replaceAll('\\', '/').toLowerCase();
const run = (command) =>
  execFileSync('powershell.exe', ['-NoProfile', '-Command', command], {
    encoding: 'utf8',
    windowsHide: true,
  }).trim();
const text = run(
  "Get-NetTCPConnection -LocalPort 3003 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Get-CimInstance Win32_Process -Filter ('ProcessId=' + $_) | Select-Object ProcessId,ParentProcessId,CommandLine } | ConvertTo-Json -Compress",
);
const processes = text ? [JSON.parse(text)].flat() : [];
const owned = (process) => {
  const command = (process?.CommandLine || '').replaceAll('\\', '/').toLowerCase();
  return command.includes(normalized + '/') && command.includes('/next/dist/');
};
for (const process of processes) {
  if (!Number.isInteger(process.ProcessId) || process.ProcessId <= 0 || !owned(process))
    throw new Error(
      'Cannot verify the process using port 3003. Stop the old restaurant server in its original terminal.',
    );
  const parentText = run(
    `Get-CimInstance Win32_Process -Filter 'ProcessId=${Number(process.ParentProcessId)}' | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress`,
  );
  const parent = parentText ? JSON.parse(parentText) : null;
  if (owned(parent) && parent.CommandLine.includes(' dev '))
    run(`Stop-Process -Id ${Number(parent.ProcessId)} -ErrorAction Stop`);
  run(`Stop-Process -Id ${process.ProcessId} -ErrorAction SilentlyContinue`);
}
const child = spawn(
  process.execPath,
  [
    '--use-system-ca',
    path.join(root, 'node_modules/next/dist/bin/next'),
    'start',
    '--hostname',
    '127.0.0.1',
    '--port',
    '3003',
  ],
  { cwd: root, stdio: 'inherit', windowsHide: true },
);
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code || 0;
});
