import { z } from 'zod';
export const categories = [
  'order_problem',
  'cancellation',
  'complaint',
  'delivery',
  'general',
] as const;
export const priorities = ['low', 'normal', 'high', 'urgent'] as const;
export const statuses = [
  'open',
  'in_progress',
  'waiting_customer',
  'escalated',
  'resolved',
  'closed',
] as const;
export const ticketReference = z.string().regex(/^TKT-[A-Z0-9-]{1,40}$/);
export const capability = z.string().regex(/^[a-f0-9]{64}$/);
export const createTicketSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().max(254),
  subject: z.string().trim().min(1).max(150),
  body: z.string().trim().min(1).max(5000),
  category: z.enum(categories),
  order_reference: z.union([z.string().regex(/^ORD-[A-Z0-9-]{1,40}$/), z.literal('')]),
});
export const replySchema = z.object({
  reference: ticketReference,
  body: z.string().trim().min(1, 'Enter your message.').max(5000),
  nonce: z.uuid(),
  internal: z.boolean(),
});
export const ticketViewSchema = z.object({
  id: z.uuid(),
  reference: ticketReference,
  subject: z.string(),
  category: z.enum(categories),
  status: z.enum(statuses),
  priority: z.enum(priorities),
  created_at: z.string(),
  updated_at: z.string(),
  message_count: z.number(),
  page: z.number(),
  messages: z.array(
    z.object({
      id: z.uuid(),
      body: z.string(),
      author_type: z.enum(['staff', 'customer', 'system']),
      is_internal: z.boolean(),
      can_attach: z.boolean(),
      created_at: z.string(),
      attachments: z.array(
        z.object({
          id: z.uuid(),
          filename: z.string(),
          content_type: z.string(),
          size_bytes: z.number(),
        }),
      ),
    }),
  ),
});
export type TicketView = z.infer<typeof ticketViewSchema>;
export type SupportState = {
  error?: string;
  success?: string;
  id?: string;
  reference?: string;
  guest?: boolean;
  token?: string;
  messageId?: string;
};
