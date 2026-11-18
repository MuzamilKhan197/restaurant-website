import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { dishes } from '../data.js';

test('every menu image and HTML local asset is present', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const references = [...html.matchAll(/(?:src|href)="((?:assets\/)[^"]+)"/g)].map(match => match[1]);
  const files = new Set([...references, ...dishes.map(dish => `assets/${dish.image}.jpg`)]);
  for (const path of files) await assert.doesNotReject(access(new URL(`../${path}`, import.meta.url)), `Missing ${path}`);
});

test('every navigation destination has a matching page', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const pages = new Set([...html.matchAll(/data-page="([^"]+)"/g)].map(match => match[1]));
  const destinations = new Set([...html.matchAll(/href="#([^"]+)"/g)].map(match => match[1]));
  for (const destination of destinations) assert.ok(destination === 'main' || pages.has(destination), `Unresolved page: ${destination}`);
});

test('all local font references and font license notices are present', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.ok(!css.includes('@import'), 'Typography must work without external font requests');
  const paths = [...css.matchAll(/url\((assets\/[^)]+)\)/g)].map(match => match[1]);
  assert.ok(paths.length >= 3);
  for (const path of [...paths, 'assets/dmsans-OFL.txt', 'assets/playfairdisplay-OFL.txt']) await access(new URL(`../${path}`, import.meta.url));
});
