import Link from 'next/link';
import { ArrowRight, Check, Database, LockKeyhole, Layers, Radio, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { getDatabaseStatus, EXPECTED_SCHEMA_VERSION } from '@/lib/supabase/status';

const statusLabels = {
  not_configured: 'Connection required',
  invalid_configuration: 'Check configuration',
  unreachable: 'Connection unavailable',
  schema_mismatch: 'Migrations required',
  ready: 'Schema connected',
};
const statusCopy = {
  not_configured:
    'Add the Supabase project URL and public publishable key to your environment, then restart the application.',
  invalid_configuration:
    'The environment configuration could not be validated. Check the URL and public publishable key.',
  unreachable:
    'The project could not be reached or the public key was rejected. Check the project status and configuration.',
  schema_mismatch:
    'The project responded without the expected schema version. Apply and verify the reviewed migrations on the intended project.',
  ready:
    'The public schema-version endpoint returned the expected version. This confirms schema readiness; hosted security and service checks are still required before release.',
};

export default async function DatabaseSetup() {
  const database = await getDatabaseStatus();
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <p className="eyebrow text-[9px]">Platform foundation</p>
            <Badge variant="outline">Phase 2</Badge>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">A secure place to grow.</h1>
          <p className="mt-3 max-w-xl text-xs leading-6 text-muted-foreground">
            Database relationships, access policies and private file storage are prepared. Connect
            your project to continue with accounts and staff access.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/admin">
            Workspace overview <ArrowRight />
          </Link>
        </Button>
      </div>
      <Card className="mt-7 border-blue-200 bg-blue-50/50">
        <CardHeader className="flex-row items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <Database className="size-5" />
          </span>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle className="text-base">Supabase connection</CardTitle>
              <Badge variant="outline">{statusLabels[database.status]}</Badge>
            </div>
            <CardDescription className="mt-3 max-w-3xl text-xs leading-6">
              {statusCopy[database.status]}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-x-8 gap-y-2 text-[11px] text-muted-foreground">
          <span>Expected schema: v{EXPECTED_SCHEMA_VERSION}</span>
          <span>
            Detected schema:{' '}
            {database.schemaVersion === null ? 'Not verified' : `v${database.schemaVersion}`}
          </span>
          <span>No credentials or customer records shown</span>
        </CardContent>
      </Card>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {[
          {
            icon: Layers,
            title: 'One connected data model',
            copy: 'Restaurant-scoped menu, staff, customers, orders, cash payments, support and audit records. Composite relationships prevent cross-restaurant links.',
          },
          {
            icon: ShieldCheck,
            title: 'Permissions in the database',
            copy: 'Row Level Security and explicit grants protect every application table. Owner-only role management and active staff permissions are checked on each request.',
          },
          {
            icon: LockKeyhole,
            title: 'Private by default',
            copy: 'Private file buckets, hashed guest access tokens and protected internal support notes. Customer and order data stay outside public previews.',
          },
          {
            icon: Radio,
            title: 'Minimal order updates',
            copy: 'Only the status-event table is published for Realtime. Access remains scoped to authorized staff and the customer who owns the order.',
          },
        ].map(({ icon: Icon, title, copy }) => (
          <Card key={title}>
            <CardHeader>
              <Icon className="mb-3 size-5 text-blue-600" />
              <CardTitle className="text-sm">{title}</CardTitle>
              <CardDescription className="mt-2 text-xs leading-6">{copy}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm">Verification &amp; next steps</CardTitle>
          <CardDescription className="text-xs">
            Local PostgreSQL policy tests and hosted integration are separate checks.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-3">
          {[
            [
              'Prepared locally',
              'Versioned SQL migrations, generated TypeScript types and automated database policy tests.',
            ],
            [
              'Hosted service verification',
              'Verify Auth email delivery, file uploads and live Realtime delivery before release. Schema readiness is checked above.',
            ],
            [
              'Accounts & access',
              'Phase 3 includes registration, login, verified sessions and protected staff routes. Confirm Auth email configuration and bootstrap the verified owner before inviting the team.',
            ],
          ].map(([title, copy]) => (
            <div key={title}>
              <p className="flex items-center gap-2 text-xs font-medium">
                <Check className="size-3.5 text-blue-600" />
                {title}
              </p>
              <p className="mt-2 text-[11px] leading-6 text-muted-foreground">{copy}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
