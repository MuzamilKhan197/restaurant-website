import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireStaff } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';
import { readTicket } from '@/features/support/actions';
import { SupportConversation } from '@/components/customer/support-conversation';
import { SupportManagement } from '@/components/admin/support-management';
export const metadata = { title: 'Support ticket' };
export default async function AdminTicket({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireStaff('support.read'),
    client = await createClient(),
    id = (await params).id;
  if (!z.uuid().safeParse(id).success) notFound();
  const result = await client
    .from('support_tickets')
    .select(
      'id,reference,contact_name,contact_email,status,priority,assigned_to,updated_at,order_id',
    )
    .eq('restaurant_id', access.restaurant_id)
    .eq('id', id)
    .maybeSingle();
  if (result.error) throw new Error('Unable to load support ticket.');
  if (!result.data) notFound();
  const ticket = result.data;
  const conversation = await readTicket(ticket.reference, null);
  if (!conversation.ticket) throw new Error('Unable to load conversation.');
  const assignees = access.permissions.includes('support.manage')
      ? await client.rpc('support_assignees', { p_restaurant: access.restaurant_id })
      : null,
    choices = z
      .array(z.object({ id: z.uuid(), name: z.string() }))
      .safeParse(assignees?.data || []);
  if (assignees?.error || !choices.success) throw new Error('Unable to load assignees.');
  return (
    <>
      <Link href="/admin/support" className="text-sm underline">
        All tickets
      </Link>
      <div className="mt-6 grid items-start gap-8 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <SupportConversation
            reference={ticket.reference}
            initial={conversation.ticket}
            staff
            canReply={access.permissions.includes('support.reply')}
          />
        </div>
        <aside className="space-y-5">
          <div className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="font-semibold">Customer</h2>
            <p className="text-sm">{ticket.contact_name}</p>
            <p className="break-all text-sm">{ticket.contact_email}</p>
            {ticket.order_id && access.permissions.includes('orders.read') && (
              <Link
                className="inline-block text-sm underline"
                href={'/admin/orders/' + ticket.order_id}
              >
                View linked order
              </Link>
            )}
          </div>
          {access.permissions.includes('support.manage') && (
            <SupportManagement
              key={ticket.updated_at}
              id={id}
              status={ticket.status}
              priority={ticket.priority}
              assigned={ticket.assigned_to}
              previous={ticket.updated_at}
              assignees={choices.data}
            />
          )}
        </aside>
      </div>
    </>
  );
}
