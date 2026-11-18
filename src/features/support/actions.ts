'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getRestaurantId } from '@/features/auth/config';
import { requireStaff } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';
import {
  createTicketSchema,
  replySchema,
  ticketReference,
  capability,
  ticketViewSchema,
  statuses,
  priorities,
  type SupportState,
} from './validation';
import {
  validateEvidence,
  MAX_FILE_SIZE,
} from '../../../supabase/functions/support-files/validation';
const failure = (error: { code?: string; message?: string } | null) =>
  error?.code === '22023'
    ? error.message || 'Check your request details.'
    : 'Support request unavailable. Check your access or private link and retry.';
function invalidate() {
  revalidatePath('/admin/support', 'layout');
  revalidatePath('/account/support', 'layout');
}
export async function createTicket(_: SupportState, form: FormData): Promise<SupportState> {
  const data = createTicketSchema.safeParse(Object.fromEntries(form)),
    token = capability.safeParse(form.get('token')),
    orderToken = form.get('order_token'),
    tenant = getRestaurantId();
  if (!data.success) return { error: data.error.issues[0].message };
  if (!token.success || !tenant) return { error: 'Unable to start this support request.' };
  if (orderToken && !capability.safeParse(orderToken).success)
    return { error: 'Invalid private order link.' };
  const client = await createClient(),
    result = await client.rpc('create_support_ticket', {
      p_restaurant: tenant,
      p_input: data.data,
      p_token: token.data,
      p_order_token: typeof orderToken === 'string' ? orderToken : null,
    });
  if (result.error) return { error: failure(result.error) };
  const parsed = z
    .object({ id: z.uuid(), reference: ticketReference, guest: z.boolean(), message_id: z.uuid() })
    .safeParse(result.data);
  if (!parsed.success)
    return { error: 'Response unavailable. Retry the same request to avoid duplicate tickets.' };
  invalidate();
  return {
    id: parsed.data.id,
    reference: parsed.data.reference,
    guest: parsed.data.guest,
    token: parsed.data.guest ? token.data : undefined,
    messageId: parsed.data.message_id,
  };
}
export async function readTicket(reference: string, token: string | null, page = 1) {
  const tenant = getRestaurantId();
  if (
    !tenant ||
    !ticketReference.safeParse(reference).success ||
    (token && !capability.safeParse(token).success) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 10000
  )
    return { error: 'Invalid ticket link.' };
  const client = await createClient(),
    result = await client.rpc('read_support_ticket', {
      p_restaurant: tenant,
      p_reference: reference,
      p_token: token || null,
      p_page: page,
    });
  if (result.error) return { error: failure(result.error) };
  const parsed = ticketViewSchema.safeParse(result.data);
  return parsed.success
    ? { ticket: parsed.data }
    : {
        error:
          'Ticket unavailable. Sign in to the correct account or use your private ticket link.',
      };
}
export async function replyTicket(_: SupportState, form: FormData): Promise<SupportState> {
  const data = replySchema.safeParse({
      ...Object.fromEntries(form),
      internal: form.get('internal') === 'on',
    }),
    tenant = getRestaurantId(),
    token = form.get('token');
  if (!data.success) return { error: data.error.issues[0].message };
  if (!tenant || (token && !capability.safeParse(token).success))
    return { error: 'Invalid ticket link.' };
  const client = await createClient(),
    d = data.data,
    result = await client.rpc('reply_support_ticket', {
      p_restaurant: tenant,
      p_reference: d.reference,
      p_token: typeof token === 'string' ? token : null,
      p_body: d.body,
      p_internal: d.internal,
      p_nonce: d.nonce,
    });
  if (result.error) return { error: failure(result.error) };
  invalidate();
  return { success: d.internal ? 'Internal note saved.' : 'Reply sent.', messageId: result.data };
}
export async function manageTicket(_: SupportState, form: FormData): Promise<SupportState> {
  const access = await requireStaff('support.manage');
  if (!access.permissions.includes('support.read'))
    return { error: 'Ticket read access required.' };
  const data = z
    .object({
      id: z.uuid(),
      status: z.enum(statuses),
      priority: z.enum(priorities),
      assigned_to: z.union([z.uuid(), z.literal('')]),
      previous: z.string().max(50),
    })
    .safeParse(Object.fromEntries(form));
  if (!data.success) return { error: 'Check ticket settings.' };
  const d = data.data,
    client = await createClient(),
    result = await client
      .from('support_tickets')
      .update({ status: d.status, priority: d.priority, assigned_to: d.assigned_to || null })
      .eq('restaurant_id', access.restaurant_id)
      .eq('id', d.id)
      .eq('updated_at', d.previous)
      .select('id')
      .single();
  if (result.error)
    return { error: 'Ticket changed or the assignee is unavailable. Refresh and retry.' };
  invalidate();
  return { success: 'Ticket updated.' };
}
export async function uploadTicketFile(_: SupportState, form: FormData): Promise<SupportState> {
  const tenant = getRestaurantId(),
    ticket = z.uuid().safeParse(form.get('ticket_id')),
    message = z.uuid().safeParse(form.get('message_id')),
    token = form.get('token'),
    file = form.get('file');
  if (
    !tenant ||
    !ticket.success ||
    !message.success ||
    (token && !capability.safeParse(token).success)
  )
    return { error: 'Attachment access unavailable.' };
  if (!(file instanceof File) || !file.size || file.size > MAX_FILE_SIZE)
    return { error: 'Choose an image, PDF or text file up to 5 MB.' };
  try {
    validateEvidence(new Uint8Array(await file.arrayBuffer()), file.type);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid file.' };
  }
  const request = new FormData();
  request.set('restaurant_id', tenant);
  request.set('ticket_id', ticket.data);
  request.set('message_id', message.data);
  request.set('token', typeof token === 'string' ? token : '');
  request.set('file', file);
  const client = await createClient(),
    result = await client.functions.invoke('support-files', { body: request });
  if (result.error || result.data?.error)
    return { error: 'Attachment upload failed. Your message is saved; please retry the file.' };
  invalidate();
  return { success: 'Attachment uploaded.' };
}
export async function getTicketFile(
  ticketId: string,
  attachmentId: string,
  token: string | null,
): Promise<{ url?: string; error?: string }> {
  const tenant = getRestaurantId();
  if (
    !tenant ||
    !z.uuid().safeParse(ticketId).success ||
    !z.uuid().safeParse(attachmentId).success ||
    (token && !capability.safeParse(token).success)
  )
    return { error: 'Attachment unavailable.' };
  const form = new FormData();
  form.set('restaurant_id', tenant);
  form.set('ticket_id', ticketId);
  form.set('attachment_id', attachmentId);
  form.set('token', token || '');
  const client = await createClient(),
    result = await client.functions.invoke('support-files', { body: form });
  const url = z.url().safeParse(result.data?.url);
  if (result.error || !url.success)
    return { error: 'Download unavailable. The file or private link may have expired.' };
  // Accept only this project's Storage origin; never return a third-party redirect.
  const expected = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  if (new URL(url.data).origin !== expected.origin) return { error: 'Download unavailable.' };
  return { url: url.data };
}
