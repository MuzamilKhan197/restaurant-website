import test, { before, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createTestDatabase, asUser } from './helpers/database.mjs';
const id = (prefix, n) => `${prefix}0000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const R = id('1', 1),
  R2 = id('1', 2),
  OWNER = id('2', 1),
  OWNER2 = id('2', 2),
  SUPPORT = id('2', 3),
  OUTSIDER = id('2', 7),
  CUSTOMER = id('2', 5);
const TOKEN = 'c'.repeat(64),
  HASH = createHash('sha256').update(TOKEN).digest('hex');
let db;
const query = (sql, params = []) => db.query(sql, params);
const scalar = async (sql, params = []) => Object.values((await query(sql, params)).rows[0])[0];
const user = (uid, fn) => asUser(db, uid, fn);
const service = (fn) => asUser(db, null, fn, 'service_role');
const role = (slug) =>
  scalar('select id from public.roles where restaurant_id=$1 and slug=$2', [R, slug]);
const invite = async () =>
  user(OWNER, () =>
    scalar('select public.create_staff_invitation($1,$2,$3,$4)', [
      R,
      'user7@example.com',
      awaitedRole,
      HASH,
    ]),
  );
let awaitedRole;
test('additional roles combine permissions and are removed or suspended atomically', async () => {
  const member = await scalar('select id from public.staff_memberships where restaurant_id=$1 and user_id=$2', [R, SUPPORT]);
  const primary = await role('support-agent');
  const developer = await role('developer');
  const ownerRole = await role('owner');
  const setRoles = (actor, extras, status = 'active') => user(actor, () =>
    query('select public.set_staff_roles($1,$2,$3,$4,$5)', [R, member, primary, extras, status]),
  );
  const access = () => user(SUPPORT, () => scalar('select public.current_staff_access($1)', [R]));
  await assert.rejects(setRoles(SUPPORT, [developer]), /Owner access required/);
  await assert.rejects(setRoles(OWNER, [ownerRole]), /Invalid additional staff roles/);
  await assert.rejects(setRoles(OWNER, [await scalar("select id from public.roles where restaurant_id=$1 and slug='developer'",[R2])]), /Invalid additional staff roles/);
  await setRoles(OWNER, [developer, developer]);
  const combined = await access();
  assert.ok(combined.permissions.includes('support.read'));
  assert.ok(combined.permissions.includes('website.manage'));
  assert.ok(!combined.permissions.includes('staff.manage'));
  assert.equal(await scalar('select count(*)::int from public.staff_additional_roles where membership_id=$1',[member]),1);
  await setRoles(OWNER,[developer],'suspended');
  assert.equal(await access(),null);
  await setRoles(OWNER,[]);
  assert.ok(!(await access()).permissions.includes('website.manage'));
});
before(async () => {
  db = await createTestDatabase();
  await db.exec(await readFile(new URL('./helpers/fixtures.sql', import.meta.url), 'utf8'));
  await query(
    "update auth.users set email='user'||right(id::text,1)||'@example.com',email_confirmed_at=now()",
  );
  awaitedRole = await role('support-agent');
});
beforeEach(async () => db.exec('begin;'));
afterEach(async () => {
  await db.exec('reset role;rollback;');
  await query("select set_config('request.jwt.claim.sub','',false)");
});
after(async () => db?.close());

test('authenticated public RPCs are invoker wrappers and bootstrap remains service-only', async () => {
  const exposed = (
    await query(
      "select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and has_function_privilege('authenticated',p.oid,'execute')",
    )
  ).rows;
  assert.deepEqual(exposed, []);
  const anonymous = (
    await query(
      "select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('current_staff_access','create_staff_invitation','accept_staff_invitation','bootstrap_restaurant_owner') and has_function_privilege('anon',p.oid,'execute')",
    )
  ).rows;
  assert.deepEqual(anonymous, []);
});

test('access summary is caller-specific and ignores fabricated metadata', async () => {
  const owner = await user(OWNER, () => scalar('select public.current_staff_access($1)', [R]));
  assert.equal(owner.is_owner, true);
  assert.ok(owner.permissions.includes('staff.manage'));
  const support = await user(SUPPORT, () => scalar('select public.current_staff_access($1)', [R]));
  assert.ok(support.permissions.includes('support.reply'));
  assert.ok(!support.permissions.includes('menu.manage'));
  assert.equal(
    await user(CUSTOMER, () => scalar('select public.current_staff_access($1)', [R])),
    null,
  );
  assert.equal(
    await user(OWNER2, () => scalar('select public.current_staff_access($1)', [R])),
    null,
  );
});
test('unconfirmed and anonymous accounts cannot gain staff access', async () => {
  await query('update auth.users set email_confirmed_at=null where id=$1', [OWNER]);
  await assert.rejects(
    user(OWNER, () => scalar('select public.current_staff_access($1)', [R])),
    /verified account/,
  );
  await query('update auth.users set email_confirmed_at=now(),is_anonymous=true where id=$1', [
    OWNER,
  ]);
  await assert.rejects(
    user(OWNER, () => scalar('select public.current_staff_access($1)', [R])),
    /verified account/,
  );
});
test('only the restaurant owner can create invitations', async () => {
  await assert.rejects(
    user(SUPPORT, () =>
      scalar('select public.create_staff_invitation($1,$2,$3,$4)', [
        R,
        'user7@example.com',
        awaitedRole,
        HASH,
      ]),
    ),
    /Owner access/,
  );
  await assert.rejects(
    user(OWNER2, () =>
      scalar('select public.create_staff_invitation($1,$2,$3,$4)', [
        R,
        'user7@example.com',
        awaitedRole,
        HASH,
      ]),
    ),
    /Owner access/,
  );
  await assert.rejects(
    asUser(db, null, () => scalar('select public.current_staff_access($1)', [R]), 'anon'),
    /permission denied/,
  );
});
test('invitation acceptance is verified-email-bound and single-use', async () => {
  const invitation = await invite();
  assert.equal(
    await scalar('select token_hash from public.staff_invitations where id=$1', [invitation]),
    HASH,
  );
  await assert.rejects(
    user(CUSTOMER, () => scalar('select public.accept_staff_invitation($1)', [TOKEN])),
    /Invitation unavailable/,
  );
  assert.equal(
    await user(OUTSIDER, () => scalar('select public.accept_staff_invitation($1)', [TOKEN])),
    R,
  );
  assert.equal(
    await scalar(
      'select status from public.staff_memberships where restaurant_id=$1 and user_id=$2',
      [R, OUTSIDER],
    ),
    'active',
  );
  await assert.rejects(
    user(OUTSIDER, () => scalar('select public.accept_staff_invitation($1)', [TOKEN])),
    /Invitation unavailable/,
  );
  assert.ok(
    !JSON.stringify((await query('select metadata from public.audit_logs')).rows).includes(TOKEN),
  );
});
test('revoked, expired and disabled-role invitations fail closed', async () => {
  const invitation = await invite();
  await user(OWNER, () => query('select public.revoke_staff_invitation($1,$2)', [R, invitation]));
  await assert.rejects(
    user(OUTSIDER, () => scalar('select public.accept_staff_invitation($1)', [TOKEN])),
    /Invitation unavailable/,
  );
  await query(
    "update public.staff_invitations set revoked_at=null,created_at=now()-interval '3 days',expires_at=now()-interval '1 day' where id=$1",
    [invitation],
  );
  await assert.rejects(
    user(OUTSIDER, () => scalar('select public.accept_staff_invitation($1)', [TOKEN])),
    /Invitation unavailable/,
  );
  await query("update public.staff_invitations set expires_at=now()+interval '1 day' where id=$1", [
    invitation,
  ]);
  // Built-in roles cannot be disabled; use a custom role to test immediate revocation.
  const custom = await user(OWNER, () =>
    scalar(
      "select public.save_custom_role($1,null,'Temporary','temporary',array['support.read'])",
      [R],
    ),
  );
  await query('update public.staff_invitations set role_id=$1 where id=$2', [custom, invitation]);
  await query('update public.roles set is_active=false where id=$1', [custom]);
  await assert.rejects(
    user(OUTSIDER, () => scalar('select public.accept_staff_invitation($1)', [TOKEN])),
    /Invitation unavailable/,
  );
});
test('reissuing an invitation revokes its previous token', async () => {
  const first = await invite();
  const secondHash = createHash('sha256').update('d'.repeat(64)).digest('hex');
  await user(OWNER, () =>
    scalar('select public.create_staff_invitation($1,$2,$3,$4)', [
      R,
      'user7@example.com',
      awaitedRole,
      secondHash,
    ]),
  );
  assert.ok(await scalar('select revoked_at from public.staff_invitations where id=$1', [first]));
  await assert.rejects(
    user(OUTSIDER, () => scalar('select public.accept_staff_invitation($1)', [TOKEN])),
    /Invitation unavailable/,
  );
});
test('owner/customer roles and cross-restaurant roles cannot be invited', async () => {
  for (const invalid of [
    await role('owner'),
    await role('customer'),
    await scalar("select id from public.roles where restaurant_id=$1 and slug='manager'", [R2]),
  ])
    await assert.rejects(
      user(OWNER, () =>
        scalar('select public.create_staff_invitation($1,$2,$3,$4)', [
          R,
          'user7@example.com',
          invalid,
          HASH,
        ]),
      ),
      /Invalid staff role/,
    );
});
test('custom roles update permissions atomically and cannot edit presets', async () => {
  const custom = await user(OWNER, () =>
    scalar(
      "select public.save_custom_role($1,null,'Tickets only','tickets-only',array['support.read','support.reply'])",
      [R],
    ),
  );
  await assert.rejects(
    user(OWNER, () =>
      scalar("select public.save_custom_role($1,$2,'Bad','tickets-only',array['made.up'])", [
        R,
        custom,
      ]),
    ),
    /Invalid permission/,
  );
  assert.equal(
    await scalar('select count(*)::int from public.role_permissions where role_id=$1', [custom]),
    2,
  );
  await assert.rejects(
    user(OWNER, () =>
      scalar("select public.save_custom_role($1,$2,'Hijack','hijack',array['support.read'])", [
        R,
        awaitedRole,
      ]),
    ),
    /Custom role unavailable/,
  );
  await assert.rejects(
    user(SUPPORT, () =>
      scalar("select public.save_custom_role($1,null,'Escalate','escalate',array['menu.manage'])", [
        R,
      ]),
    ),
    /Owner access/,
  );
  await assert.rejects(
    user(OWNER, () =>
      scalar(
        "select public.save_custom_role($1,null,'Escalate','escalate',array['roles.manage'])",
        [R],
      ),
    ),
    /Invalid permission/,
  );
});
test('staff changes are owner-only, tenant-scoped and protect the owner identity', async () => {
  const member = id('d', 1),
    manager = await role('manager');
  await assert.rejects(
    user(SUPPORT, () =>
      query("select public.manage_staff_member($1,$2,$3,'active')", [R, member, manager]),
    ),
    /Owner access/,
  );
  await user(OWNER, () =>
    query("select public.manage_staff_member($1,$2,$3,'suspended')", [R, member, awaitedRole]),
  );
  assert.equal(
    await user(SUPPORT, () => scalar('select public.current_staff_access($1)', [R])),
    null,
  );
  const ownerRole = await role('owner');
  await assert.rejects(
    user(OWNER, () =>
      query("select public.manage_staff_member($1,$2,$3,'active')", [R, member, ownerRole]),
    ),
    /Invalid staff change/,
  );
});
test('owner bootstrap is operator-only, requires confirmation and cannot replace an owner', async () => {
  const draft = await scalar(
    "insert into public.restaurants(name,slug) values('Draft','draft') returning id",
  );
  await assert.rejects(
    user(OUTSIDER, () =>
      query('select public.bootstrap_restaurant_owner($1,$2)', [draft, OUTSIDER]),
    ),
    /permission denied/,
  );
  await service(() => query('select public.bootstrap_restaurant_owner($1,$2)', [draft, OUTSIDER]));
  assert.equal(
    await scalar('select owner_user_id from public.restaurants where id=$1', [draft]),
    OUTSIDER,
  );
  assert.equal(
    await scalar('select is_published from public.restaurants where id=$1', [draft]),
    false,
  );
  await assert.rejects(
    service(() => query('select public.bootstrap_restaurant_owner($1,$2)', [draft, OWNER2])),
    /unavailable/,
  );
});
