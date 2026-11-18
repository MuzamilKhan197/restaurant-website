import { mkdir, writeFile } from 'node:fs/promises';

// Illustrative photography from Unsplash, downloaded locally so the site does
// not need a third-party image service at runtime. See assets/CREDITS.md.
const photos = {
  hero: ['photo-1414235077428-338989a2e8c0', 1400],
  story: ['photo-1517248135467-4c7edcad34c4', 1000],
  salad: ['photo-1512621776951-a57141f2eefd', 700],
  hummus: ['photo-1577906096429-f73c2c312435', 700],
  soup: ['photo-1547592180-85f173990554', 700],
  chicken: ['photo-1532550907401-a500c9a57435', 700],
  steak: ['photo-1546833999-b9f581a1996d', 700],
  salmon: ['photo-1467003909585-2f8a72700288', 700],
  pasta: ['photo-1473093295043-cdd812d0e601', 700],
  cake: ['photo-1578985545062-69928b1d9587', 700],
  cheesecake: ['photo-1533134242443-d4fd215305ad', 700],
  lemonade: ['photo-1544145945-f90425340c7e', 700],
  coffee: ['photo-1461023058943-07fcbe16d735', 700]
};
await mkdir('assets', { recursive: true });
const results = await Promise.allSettled(Object.entries(photos).map(async ([name, [id, width]]) => {
  const response = await fetch(`https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=82&fm=jpg`, { signal: AbortSignal.timeout(45000) });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`${name}: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(`assets/${name}.jpg`, buffer);
  console.log(`${name}.jpg: ${Math.round(buffer.length / 1024)} KB`);
}));
const failures = results.filter(result => result.status === 'rejected');
if (failures.length) { failures.forEach(result => console.error(result.reason.message)); process.exitCode = 1; }
