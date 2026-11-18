import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createTestDatabase, asUser } from '../tests/helpers/database.mjs';
import { EXPECTED_SCHEMA_VERSION } from '../src/lib/supabase/schema-version.ts';

const database = await createTestDatabase();
let backup;
try {
  await database.exec(await readFile(new URL('../tests/helpers/fixtures.sql', import.meta.url), 'utf8'));
  backup = await database.dumpDataDir();
} finally {
  await database.close();
}

const restored = await PGlite.create({ loadDataDir: backup });
try {
  const version = await restored.query('select public.platform_schema_version() as version');
  assert.equal(version.rows[0].version, EXPECTED_SCHEMA_VERSION);
  const records = await restored.query("select reference,total_minor::text from public.orders where reference='ORD-ONE'");
  assert.deepEqual(records.rows, [{ reference: 'ORD-ONE', total_minor: '100000' }]);
  await restored.exec('begin');
  await assert.rejects(asUser(restored, null, () => restored.query('select id from public.orders'), 'anon'), /permission denied/);
  const owner = await asUser(restored, '20000000-0000-0000-0000-000000000005', () =>
    restored.query("select reference from public.orders where reference in ('ORD-ONE','ORD-OTHER')"),
  );
  assert.deepEqual(owner.rows, [{ reference: 'ORD-ONE' }]);
  await restored.exec('rollback');
  console.log('Fixture backup restored. Schema version, order totals and customer isolation verified.');
} finally {
  await restored.close();
}
