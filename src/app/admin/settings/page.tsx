import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireStaff } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';
import { SettingsForm } from '@/components/admin/settings-form';
import { days, hoursSchema } from '@/features/settings/model';

const field = 'mt-1 block w-full rounded-lg border bg-background px-3 py-2';
export const metadata = { title: 'Restaurant settings' };
export default async function SettingsPage() {
  const access = await requireStaff(),
    canEdit = access.permissions.includes('settings.manage');
  if (!canEdit && !access.permissions.includes('settings.read')) redirect('/access-denied');
  const client = await createClient();
  const [settings, zones, restaurant] = await Promise.all([
    client
      .from('restaurant_settings')
      .select('*')
      .eq('restaurant_id', access.restaurant_id)
      .single(),
    client
      .from('delivery_zones')
      .select('id,name,is_active')
      .eq('restaurant_id', access.restaurant_id)
      .order('name'),
    client
      .from('restaurants')
      .select('name,currency,timezone')
      .eq('id', access.restaurant_id)
      .single(),
  ]);
  if (settings.error || zones.error || restaurant.error)
    throw new Error('Unable to load restaurant settings.');
  const data = settings.data,
    hours = hoursSchema.safeParse(data.opening_hours),
    address = z.object({ line: z.string() }).safeParse(data.address);
  const input = (name: string, label: string, value: string, maxLength = 100, type = 'text') => (
    <label className="block text-sm">
      {label}
      <input name={name} type={type} maxLength={maxLength} defaultValue={value} className={field} />
    </label>
  );
  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-3xl font-semibold">Restaurant settings</h1>
      <p className="text-sm text-muted-foreground">
        {restaurant.data.name} · {restaurant.data.currency} · {restaurant.data.timezone}
      </p>
      <SettingsForm
        key={data.updated_at}
        kind="business"
        label="Save restaurant settings"
        disabled={!canEdit}
      >
        <input type="hidden" name="expected" value={data.updated_at} />
        <h2 className="font-semibold">Public contact details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {input('email', 'Email', data.contact_email || '', 254, 'email')}
          {input('phone', 'Phone', data.contact_phone || '', 30, 'tel')}
        </div>
        {input('address', 'Street address', address.data?.line || '', 300)}
        <h2 className="font-semibold">Opening hours</h2>
        <p className="text-xs text-muted-foreground">
          Hours are displayed on the contact page in {restaurant.data.timezone}. Set website mode to
          Orders paused to stop checkout.
        </p>
        {days.map((day) => {
          const hoursForDay = hours.data?.[day];
          return (
            <div key={day} className="grid items-end gap-3 border-t pt-3 sm:grid-cols-4">
              <p className="text-sm font-medium">{day}</p>
              <label className="text-sm">
                Opens
                <input
                  type="time"
                  name={day + '-open'}
                  defaultValue={hoursForDay?.open || '11:00'}
                  className={field}
                />
              </label>
              <label className="text-sm">
                Closes
                <input
                  type="time"
                  name={day + '-close'}
                  defaultValue={hoursForDay?.close || '22:00'}
                  className={field}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={day + '-closed'} defaultChecked={!hoursForDay} />
                Closed
              </label>
            </div>
          );
        })}
        <h2 className="font-semibold">Delivery and tax</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="delivery" defaultChecked={data.delivery_enabled} />
          Enable delivery
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          {input(
            'fee',
            'Delivery fee (' + restaurant.data.currency + ')',
            (data.delivery_fee_minor / 100).toFixed(2),
          )}
          {input(
            'minimum',
            'Minimum delivery order (' + restaurant.data.currency + ')',
            (data.minimum_delivery_minor / 100).toFixed(2),
          )}
          {input('tax', 'Tax (%)', (data.tax_rate_bps / 100).toFixed(2))}
        </div>
      </SettingsForm>
      <section className="space-y-4">
        <h2 className="font-semibold">Delivery areas</h2>
        <p className="text-sm text-muted-foreground">
          Deactivate an area to remove it from checkout while preserving existing orders.
        </p>
        {!zones.data.length && <p className="text-sm">No delivery areas configured.</p>}
        {zones.data.map((zone) => (
          <SettingsForm key={zone.id} kind="zone" label="Save area" disabled={!canEdit}>
            <input type="hidden" name="id" value={zone.id} />
            {input('name', 'Area name', zone.name)}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={zone.is_active} />
              Active
            </label>
          </SettingsForm>
        ))}
        {canEdit && (
          <SettingsForm kind="zone" label="Add area">
            <input type="hidden" name="id" value="" />
            {input('name', 'New area name', '')}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked />
              Active
            </label>
          </SettingsForm>
        )}
      </section>
    </div>
  );
}
