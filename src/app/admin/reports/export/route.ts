import { requireStaff } from '@/features/auth/session';
import { getReportContext, getSalesReport } from '@/features/reports/data';
import { reportRangeSchema, defaultRange, reportCsv } from '@/features/reports/model';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  await requireStaff('reports.read');
  const { restaurant } = await getReportContext(),
    params = new URL(request.url).searchParams,
    defaults = defaultRange(restaurant.timezone),
    range = reportRangeSchema.safeParse({
      from: params.get('from') ?? defaults.from,
      to: params.get('to') ?? defaults.to,
    }),
    type = params.get('type') || 'daily';
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  if (!range.success || !['daily', 'popular'].includes(type))
    return Response.json({ error: 'Choose valid report filters.' }, { status: 400, headers });
  const report = await getSalesReport(range.data.from, range.data.to);
  return new Response(reportCsv(report, type as 'daily' | 'popular'), {
    headers: {
      ...headers,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition':
        'attachment; filename="restaurant-' +
        type +
        '-' +
        range.data.from +
        '-' +
        range.data.to +
        '.csv"',
    },
  });
}
