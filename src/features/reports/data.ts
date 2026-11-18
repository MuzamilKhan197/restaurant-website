import 'server-only';
import { cache } from 'react';
import { requireStaff } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';
import { salesReportSchema, activitySchema } from './model';
export const getReportContext = cache(async () => {
  const access = await requireStaff(),
    client = await createClient();
  const restaurant = await client
    .from('restaurants')
    .select('name,currency,timezone')
    .eq('id', access.restaurant_id)
    .single();
  if (restaurant.error) throw new Error('Unable to load restaurant reporting settings.');
  return { access, restaurant: restaurant.data };
});
export async function getSalesReport(from: string, to: string) {
  const access = await requireStaff('reports.read'),
    client = await createClient(),
    result = await client.rpc('restaurant_sales_report', {
      p_restaurant: access.restaurant_id,
      p_from: from,
      p_to: to,
    });
  const parsed = salesReportSchema.safeParse(result.data);
  if (result.error || !parsed.success)
    throw new Error('Unable to load sales report. Please retry.');
  return parsed.data;
}
export async function getActivity(
  from: string,
  to: string,
  {
    entity = '',
    action = '',
    actor = '',
    page = 1,
  }: { entity?: string; action?: string; actor?: string; page?: number } = {},
) {
  const access = await requireStaff('audit.read'),
    client = await createClient(),
    result = await client.rpc('restaurant_activity_log', {
      p_restaurant: access.restaurant_id,
      p_from: from,
      p_to: to,
      p_entity: entity || null,
      p_action: action || null,
      p_actor: actor || null,
      p_page: page,
    });
  const parsed = activitySchema.safeParse(result.data);
  if (result.error || !parsed.success)
    throw new Error('Unable to load activity log. Please retry.');
  return parsed.data;
}
