import { readFile, writeFile } from 'node:fs/promises';
import { createTestDatabase } from '../tests/helpers/database.mjs';
const target = new URL(
  '../supabase/migrations/20261116142450_policy_and_foreign_key_indexes.sql',
  import.meta.url,
);
if ((await readFile(target, 'utf8')).trim())
  throw new Error('Refusing to overwrite a reviewed migration.');
const db = await createTestDatabase();
try {
  const policies = (
    await db.query(
      "select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' and 'authenticated'=any(roles) order by tablename,cmd,policyname",
    )
  ).rows;
  const groups = new Map();
  for (const policy of policies) {
    const key = policy.tablename + ':' + policy.cmd;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(policy);
  }
  let sql = '-- Preserve predicates while using one policy per authenticated operation.\n';
  for (const rows of groups.values()) {
    if (rows.length < 2) continue;
    for (const p of rows) {
      const others = p.roles.filter((r) => r !== 'authenticated');
      sql += others.length
        ? `alter policy ${p.policyname} on public.${p.tablename} to ${others.join(',')};\n`
        : `drop policy ${p.policyname} on public.${p.tablename};\n`;
    }
    const p = rows[0];
    sql += `create policy combined_${p.cmd.toLowerCase()} on public.${p.tablename} for ${p.cmd.toLowerCase()} to authenticated`;
    if (rows.some((p) => p.qual))
      sql += ' using (' + rows.map((p) => '(' + p.qual + ')').join(' or ') + ')';
    if (rows.some((p) => p.with_check))
      sql += ' with check (' + rows.map((p) => '(' + p.with_check + ')').join(' or ') + ')';
    sql += ';\n\n';
  }
  const indexes = [
    ['private', 'guest_access', 'restaurant_id'],
    ['public', 'addons', 'restaurant_id,addon_group_id'],
    ['public', 'order_item_addons', 'restaurant_id,addon_id'],
    ['public', 'order_item_addons', 'restaurant_id,order_id,order_item_id'],
    ['public', 'order_items', 'restaurant_id,product_id,variant_id'],
    ['public', 'orders', 'restaurant_id,delivery_zone_id'],
    ['public', 'payments', 'recorded_by'],
    ['public', 'product_addon_groups', 'restaurant_id,addon_group_id'],
    ['public', 'product_images', 'restaurant_id,product_id'],
    ['public', 'restaurants', 'owner_user_id'],
    ['public', 'role_permissions', 'permission_key'],
    ['public', 'staff_invitations', 'invited_by'],
    ['public', 'staff_invitations', 'restaurant_id,role_id'],
    ['public', 'staff_memberships', 'restaurant_id,role_id'],
    ['public', 'support_attachments', 'restaurant_id,ticket_id,message_id'],
    ['public', 'support_attachments', 'uploaded_by'],
    ['public', 'support_messages', 'author_user_id'],
    ['public', 'support_tickets', 'restaurant_id,order_id'],
  ];
  for (const [schema, table, columns] of indexes)
    sql += `create index ${table}_${columns.replaceAll(',', '_')}_fk on ${schema}.${table}(${columns});\n`;
  await writeFile(target, sql);
  console.log('Prepared consolidated policy predicates and 18 FK indexes.');
} finally {
  await db.close();
}
