import Link from 'next/link';
import { requireStaff } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';
import { SettingsForm } from '@/components/admin/settings-form';

const field = 'mt-1 block w-full rounded-lg border bg-background px-3 py-2';
export const metadata = { title: 'Website controls' };
export default async function WebsitePage() {
  const access = await requireStaff('website.manage'),
    client = await createClient();
  const { data, error } = await client
    .from('restaurant_settings')
    .select('website_mode,maintenance_message,reopening_at,updated_at')
    .eq('restaurant_id', access.restaurant_id)
    .single();
  if (error) throw new Error('Unable to load website settings.');
  return (
    <section className="max-w-3xl space-y-5">
      <h1 className="text-3xl font-semibold">Website controls</h1>
      <p className="text-sm text-muted-foreground">
        Current mode · {data.website_mode.replaceAll('_', ' ')}. Storefront publication is managed
        separately in Menu.
      </p>
      <SettingsForm key={data.updated_at} kind="website" label="Save website mode">
        <input type="hidden" name="expected" value={data.updated_at} />
        <label className="block text-sm">
          Website mode
          <select name="mode" defaultValue={data.website_mode} className={field}>
            <option value="normal">Normal · browse and order</option>
            <option value="orders_paused">Orders paused · browse only</option>
            <option value="maintenance">Maintenance · show a notice</option>
          </select>
        </label>
        <label className="block text-sm">
          Maintenance message
          <textarea
            name="message"
            className={field}
            rows={4}
            required
            maxLength={1000}
            defaultValue={data.maintenance_message}
          />
        </label>
        <label className="block text-sm">
          Expected reopening (optional)
          <input
            name="reopening"
            className={field}
            defaultValue={data.reopening_at ?? ''}
            placeholder="2026-11-19T18:00:00+05:00"
            aria-describedby="reopening-help"
          />
        </label>
        <p id="reopening-help" className="text-xs text-muted-foreground">
          Use a date and time with its UTC offset, for example 2026-11-19T18:00:00+05:00. This time
          is informational. Change the mode when you reopen.
        </p>
      </SettingsForm>
      <Link href="/" className="text-sm underline">
        View storefront
      </Link>
    </section>
  );
}
