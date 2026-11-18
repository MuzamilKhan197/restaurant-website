'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';
import { days, hoursSchema, modes, type SettingsResult } from './model';

const version = z.iso.datetime({ offset: true });
function saved() {
  revalidatePath('/', 'layout');
  return { success: 'Changes saved.' };
}
const failed = { error: 'Unable to save. Refresh the page and check your details.' };

export async function saveWebsite(_: SettingsResult, form: FormData): Promise<SettingsResult> {
  const access = await requireStaff('website.manage');
  const input = z
    .object({
      mode: z.enum(modes),
      message: z.string().trim().min(1).max(1000),
      reopening: z.union([z.literal(''), z.iso.datetime({ offset: true })]),
      expected: version,
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return {
      error: 'Enter a maintenance message and an optional reopening time with its UTC offset.',
    };
  const client = await createClient();
  const { error } = await client.rpc('save_website_mode', {
    tenant: access.restaurant_id,
    ...input.data,
    reopening: input.data.reopening || null,
  });
  return error ? failed : saved();
}

const amount = (max: number) =>
  z
    .string()
    .regex(/^\d{1,9}(\.\d{1,2})?$/)
    .transform((value) => {
      const [whole, fraction = ''] = value.split('.');
      return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    })
    .pipe(z.number().int().max(max));

export async function saveBusiness(_: SettingsResult, form: FormData): Promise<SettingsResult> {
  const access = await requireStaff('settings.manage');
  const input = z
    .object({
      email: z.union([z.email().max(254), z.literal('')]),
      phone: z.string().trim().max(30),
      address: z.string().trim().max(300),
      expected: version,
      fee: amount(10000000),
      minimum: amount(100000000),
      tax: amount(10000),
    })
    .safeParse(Object.fromEntries(form));
  const hours = hoursSchema.safeParse(
    Object.fromEntries(
      days.map((day) => [
        day,
        form.get(day + '-closed') === 'on'
          ? null
          : { open: form.get(day + '-open'), close: form.get(day + '-close') },
      ]),
    ),
  );
  if (
    !input.success ||
    !hours.success ||
    Object.values(hours.data).some((day) => day && day.open === day.close)
  )
    return { error: 'Check contact details, opening hours, delivery amounts and tax percentage.' };
  const data = input.data,
    client = await createClient();
  const { error } = await client
    .from('restaurant_settings')
    .update({
      contact_email: data.email || null,
      contact_phone: data.phone || null,
      address: { line: data.address },
      opening_hours: hours.data,
      delivery_enabled: form.get('delivery') === 'on',
      delivery_fee_minor: data.fee,
      minimum_delivery_minor: data.minimum,
      tax_rate_bps: data.tax,
    })
    .eq('restaurant_id', access.restaurant_id)
    .eq('updated_at', data.expected)
    .select('restaurant_id')
    .single();
  return error ? failed : saved();
}

export async function saveZone(_: SettingsResult, form: FormData): Promise<SettingsResult> {
  const access = await requireStaff('settings.manage');
  const input = z
    .object({ id: z.union([z.literal(''), z.uuid()]), name: z.string().trim().min(1).max(100) })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return { error: 'Enter a delivery area name.' };
  const client = await createClient();
  const values = { name: input.data.name, is_active: form.get('active') === 'on' };
  const query = input.data.id
    ? client
        .from('delivery_zones')
        .update(values)
        .eq('restaurant_id', access.restaurant_id)
        .eq('id', input.data.id)
    : client.from('delivery_zones').insert({ ...values, restaurant_id: access.restaurant_id });
  const { error } = await query.select('id').single();
  return error ? failed : saved();
}
