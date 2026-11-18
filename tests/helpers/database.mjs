import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';

export async function createTestDatabase({ seed = false } = {}) {
  const db = new PGlite();
  await db.exec(await readFile(new URL('./supabase-bootstrap.sql', import.meta.url), 'utf8'));
  const migrationRoot = new URL('../../supabase/migrations/', import.meta.url);
  for (const name of (await readdir(migrationRoot))
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    try {
      await db.exec(await readFile(new URL(name, migrationRoot), 'utf8'));
    } catch (error) {
      await db.close();
      throw new Error(`Migration ${name}: ${error.message}`, { cause: error });
    }
  }
  if (seed)
    await db.exec(await readFile(new URL('../../supabase/seed.sql', import.meta.url), 'utf8'));
  return db;
}

export async function asUser(db, id, fn, role = 'authenticated') {
  // All role names are test-controlled constants, never application input.
  if (!['authenticated', 'anon', 'service_role'].includes(role))
    throw new Error('Invalid test role');
  await db.exec('savepoint test_role;');
  await db.exec(`set role ${role};`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || '']);
  try {
    const value = await fn();
    await db.exec('reset role; release savepoint test_role;');
    await db.query("select set_config('request.jwt.claim.sub','',false)");
    return value;
  } catch (error) {
    await db.exec('rollback to savepoint test_role; reset role; release savepoint test_role;');
    await db.query("select set_config('request.jwt.claim.sub','',false)");
    throw error;
  }
}
