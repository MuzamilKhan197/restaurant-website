import ts from 'typescript';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
function member(node, name) {
  return node.members.find((item) => item.name?.getText().replaceAll(/["']/g, '') === name)?.type;
}
async function schema(path) {
  const source = ts.createSourceFile(
    path,
    await readFile(new URL(path, import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const database = source.statements.find(
    (n) => ts.isTypeAliasDeclaration(n) && n.name.text === 'Database',
  );
  const publicSchema = member(database.type, 'public');
  const names = (node) =>
    node.members.map((item) => item.name.getText().replaceAll(/["']/g, '')).sort();
  const tables = member(publicSchema, 'Tables');
  return {
    tables: Object.fromEntries(
      names(tables).map((name) => [name, names(member(member(tables, name), 'Row'))]),
    ),
    enums: names(member(publicSchema, 'Enums')),
    functions: names(member(publicSchema, 'Functions')),
  };
}
assert.deepEqual(
  await schema('../src/lib/supabase/database.types.ts'),
  await schema('../docs/verification/hosted-database.types.ts'),
);
console.log('Hosted and local public table columns, enum names and RPC names match.');
