import { getDatabaseStatus } from '@/lib/supabase/status';
export const dynamic = 'force-dynamic';

export async function GET() {
  const database = await getDatabaseStatus();
  return Response.json(
    {
      status: 'ok',
      application: 'restaurant',
      phase: 'website_controls',
      database: database.status,
      schemaVersion: database.schemaVersion,
      authentication: database.status === 'ready' ? 'configured' : 'unavailable',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
