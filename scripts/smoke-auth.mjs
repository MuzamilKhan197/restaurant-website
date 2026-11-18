import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EXPECTED_SCHEMA_VERSION } from '../src/lib/supabase/schema-version.ts';
const file = process.argv[2] || process.env.APP_URL ? '' : await readFile(new URL('../.env.local', import.meta.url), 'utf8');
const configuredOrigin = process.argv[2] || process.env.APP_URL || file.match(/^APP_URL=(.+)$/m)?.[1];
assert.ok(configuredOrigin, 'Configure APP_URL or pass the deployment URL.');
const appUrl = new URL(configuredOrigin).origin;
const get = (url, headers = {}) =>
  fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(10000) });
const results = [];
const login = await get(`${appUrl}/login`);
assert.equal(login.status, 200);
assert.match(login.headers.get('cache-control'), /no-store/);
results.push('Login loads without a redirect loop and is not cached.');
for (const path of ['/account', '/account/support', '/admin', '/admin/staff', '/admin/orders', '/admin/support', '/admin/reports/export', '/admin/activity', '/admin/settings', '/admin/website']) {
  const response = await get(appUrl + path);
  assert.equal(response.status, 307);
  assert.match(new URL(response.headers.get('location'), appUrl).pathname, /^\/login$/);
  assert.match(response.headers.get('cache-control'), /no-store/);
}
results.push('Account, workspace and staff routes reject anonymous access.');
const health = await (await get(appUrl + '/api/health')).json();
assert.equal(health.database, 'ready');
assert.equal(health.schemaVersion, EXPECTED_SCHEMA_VERSION);
results.push('Health reports the connected schema v'+EXPECTED_SCHEMA_VERSION+'.');
if (new URL(appUrl).hostname === '127.0.0.1') {
  const alternate = new URL('/login', appUrl);
  alternate.hostname = 'localhost';
  const response = await get(alternate);
  assert.equal(response.status, 200);
  results.push('Alternate loopback entry loads.');
}
console.log(results.join('\n'));
