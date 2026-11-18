// Same-runner HTTP check: the managed sandbox cannot access the user's existing
// host listener on 3003. Use an isolated child and stop only that owned child.
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
const probe = createServer();
await new Promise((resolve, reject) => {
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', resolve);
});
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const child = spawn(
  process.execPath,
  [
    '--use-system-ca',
    path.join(process.cwd(), 'node_modules/next/dist/bin/next'),
    'start',
    '--hostname',
    '127.0.0.1',
    '--port',
    String(port),
  ],
  {
    cwd: process.cwd(),
    env: { ...process.env, APP_URL: origin },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let logs = '';
child.stdout.on('data', (chunk) => (logs += chunk));
child.stderr.on('data', (chunk) => (logs += chunk));
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Preview startup timed out')), 15000);
    const onData = () => {
      if (logs.includes('Ready in')) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout.on('data', onData);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error('Preview exited: ' + code));
    });
  });
  const get = (pathname) =>
    fetch(origin + pathname, {
      redirect: 'manual',
      headers: { Connection: 'close' },
      signal: AbortSignal.timeout(10000),
    });
  const login = await get('/login');
  assert.equal(login.status, 200);
  assert.match(login.headers.get('cache-control'), /no-store/);
  assert.match(await login.text(), /Welcome back/);
  for (const pathname of [
    '/admin/menu',
    '/admin/menu/50000000-0000-4000-8000-000000000001',
    '/account',
    '/admin/website',
    '/admin/settings',
    '/admin/reports/export',
  ]) {
    const response = await get(pathname);
    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get('location'), origin).pathname, '/login');
  }
  const health = await (await get('/api/health')).json();
  assert.equal(health.application, 'restaurant');
  assert.ok(!JSON.stringify(health).includes('sb_publishable_'));
  console.log(
    'Built app: login renders, protected routes reject anonymous access, and health exposes no keys.',
  );
  console.log('Database reachability in this managed runner: ' + health.database);
} finally {
  child.kill();
}
