-- Phase 2: PostgreSQL is the source of truth. Amounts are integer minor units
-- (PKR paisa), never floating-point rupees. No legacy data is modified.
create schema if not exists private;
revoke all on schema private from public;

create type public.website_mode as enum ('normal', 'orders_paused', 'maintenance');
create type public.membership_status as enum ('active', 'invited', 'suspended');
create type public.order_status as enum ('pending', 'accepted', 'preparing', 'ready', 'completed', 'rejected', 'cancelled');
create type public.fulfilment_method as enum ('delivery', 'pickup');
create type public.cash_payment_method as enum ('cash_on_delivery', 'pay_at_pickup');
create type public.payment_status as enum ('unpaid', 'paid', 'refund_due', 'refunded');
create type public.ticket_category as enum ('order_problem', 'cancellation', 'complaint', 'delivery', 'general');
create type public.ticket_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.ticket_status as enum ('open', 'in_progress', 'waiting_customer', 'escalated', 'resolved', 'closed');
create type public.message_author as enum ('customer', 'staff', 'system');
create type public.attachment_status as enum ('pending', 'ready', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 100),
  avatar_path text check (length(avatar_path) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  currency text not null default 'PKR' check (currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'Asia/Karachi',
  is_published boolean not null default false,
  is_sample boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_published or owner_user_id is not null)
);

create table public.restaurant_settings (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  website_mode public.website_mode not null default 'orders_paused',
  maintenance_message text not null default 'We will be back soon.' check (length(maintenance_message) <= 1000),
  reopening_at timestamptz,
  contact_email text check (length(contact_email) <= 254),
  contact_phone text check (length(contact_phone) <= 30),
  address jsonb not null default '{}' check (jsonb_typeof(address) = 'object'),
  opening_hours jsonb not null default '{}' check (jsonb_typeof(opening_hours) = 'object'),
  delivery_enabled boolean not null default false,
  delivery_fee_minor integer not null default 0 check (delivery_fee_minor between 0 and 10000000),
  minimum_delivery_minor integer not null default 0 check (minimum_delivery_minor between 0 and 100000000),
  tax_rate_bps integer not null default 0 check (tax_rate_bps between 0 and 10000),
  updated_at timestamptz not null default now()
);

create table public.permissions (
  key text primary key,
  description text not null
);
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (restaurant_id, id), unique (restaurant_id, slug)
);
create table public.role_permissions (
  restaurant_id uuid not null,
  role_id uuid not null,
  permission_key text not null references public.permissions(key) on delete restrict,
  primary key (restaurant_id, role_id, permission_key),
  foreign key (restaurant_id, role_id) references public.roles(restaurant_id, id) on delete cascade
);
create table public.staff_memberships (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  role_id uuid not null,
  display_name text not null default '' check (length(display_name) <= 100),
  contact_email text check (length(contact_email) <= 254),
  status public.membership_status not null default 'invited',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id), unique (restaurant_id, user_id),
  foreign key (restaurant_id, role_id) references public.roles(restaurant_id, id) on delete restrict
);
create table public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  role_id uuid not null,
  email text not null check (length(email) <= 254),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (restaurant_id, role_id) references public.roles(restaurant_id, id) on delete restrict,
  check (expires_at > created_at)
);

create table public.restaurant_customers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  display_name text not null check (length(btrim(display_name)) between 1 and 100),
  contact_email text check (length(contact_email) <= 254),
  phone text check (length(phone) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id), unique (restaurant_id, user_id)
);
create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  customer_id uuid not null,
  label text not null check (length(btrim(label)) between 1 and 60),
  address_line text not null check (length(btrim(address_line)) between 5 and 300),
  area text not null check (length(btrim(area)) between 1 and 100),
  city text not null check (length(btrim(city)) between 1 and 100),
  instructions text check (length(instructions) <= 500),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  foreign key (restaurant_id, customer_id) references public.restaurant_customers(restaurant_id, id) on delete cascade
);
create unique index addresses_one_default on public.customer_addresses(restaurant_id, customer_id) where is_default;
create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  is_active boolean not null default true,
  unique (restaurant_id, id), unique (restaurant_id, name)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id), unique (restaurant_id, slug)
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 100),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '' check (length(description) <= 2000),
  base_price_minor integer not null check (base_price_minor between 0 and 100000000),
  dietary_labels text[] not null default '{}' check (dietary_labels <@ array['vegetarian','vegan','gluten_free','signature']::text[]),
  allergens text[] not null default '{}',
  is_active boolean not null default true,
  is_available boolean not null default true,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id), unique (restaurant_id, slug),
  foreign key (restaurant_id, category_id) references public.categories(restaurant_id, id) on delete restrict
);
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  product_id uuid not null,
  object_path text not null unique check (length(object_path) <= 500),
  alt_text text not null check (length(alt_text) between 1 and 200),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (restaurant_id, id),
  foreign key (restaurant_id, product_id) references public.products(restaurant_id, id) on delete cascade
);
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  product_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 80),
  price_minor integer not null check (price_minor between 0 and 100000000),
  is_active boolean not null default true,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  unique (restaurant_id, id), unique (restaurant_id, product_id, id), unique (restaurant_id, product_id, name),
  foreign key (restaurant_id, product_id) references public.products(restaurant_id, id) on delete cascade
);
create unique index variants_one_default on public.product_variants(restaurant_id, product_id) where is_default and is_active;
create table public.addon_groups (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  min_selections integer not null default 0 check (min_selections >= 0),
  max_selections integer not null default 1 check (max_selections between 1 and 20),
  is_active boolean not null default true,
  unique (restaurant_id, id), check (max_selections >= min_selections)
);
create table public.product_addon_groups (
  restaurant_id uuid not null,
  product_id uuid not null,
  addon_group_id uuid not null,
  sort_order integer not null default 0,
  primary key (restaurant_id, product_id, addon_group_id),
  foreign key (restaurant_id, product_id) references public.products(restaurant_id, id) on delete cascade,
  foreign key (restaurant_id, addon_group_id) references public.addon_groups(restaurant_id, id) on delete cascade
);
create table public.addons (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  addon_group_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 100),
  price_minor integer not null default 0 check (price_minor between 0 and 10000000),
  is_available boolean not null default true,
  unique (restaurant_id, id),
  foreign key (restaurant_id, addon_group_id) references public.addon_groups(restaurant_id, id) on delete cascade
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  customer_id uuid,
  reference text not null unique default ('ORD-' || upper(replace(gen_random_uuid()::text, '-', ''))),
  status public.order_status not null default 'pending',
  method public.fulfilment_method not null,
  payment_method public.cash_payment_method not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  contact_name text not null check (length(btrim(contact_name)) between 1 and 100),
  contact_email text not null check (length(contact_email) <= 254),
  contact_phone text not null check (length(contact_phone) between 7 and 30),
  delivery_address jsonb,
  delivery_zone_id uuid,
  notes text not null default '' check (length(notes) <= 1000),
  subtotal_minor bigint not null check (subtotal_minor between 0 and 100000000000),
  delivery_fee_minor integer not null default 0 check (delivery_fee_minor >= 0),
  tax_rate_bps integer not null default 0 check (tax_rate_bps between 0 and 10000),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  total_minor bigint not null check (total_minor = subtotal_minor + delivery_fee_minor + tax_minor),
  rejection_reason text check (length(rejection_reason) <= 500),
  cancellation_reason text check (length(cancellation_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  foreign key (restaurant_id, customer_id) references public.restaurant_customers(restaurant_id, id) on delete restrict,
  foreign key (restaurant_id, delivery_zone_id) references public.delivery_zones(restaurant_id, id) on delete restrict,
  check ((method = 'delivery' and payment_method = 'cash_on_delivery' and delivery_address is not null and jsonb_typeof(delivery_address) = 'object' and delivery_zone_id is not null)
    or (method = 'pickup' and payment_method = 'pay_at_pickup' and delivery_address is null and delivery_zone_id is null and delivery_fee_minor = 0)),
  check (tax_minor = round(subtotal_minor::numeric * tax_rate_bps / 10000)::bigint)
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  order_id uuid not null,
  product_id uuid not null,
  variant_id uuid,
  product_name text not null check (length(product_name) between 1 and 100),
  variant_name text check (length(variant_name) <= 80),
  quantity integer not null check (quantity between 1 and 20),
  unit_price_minor integer not null check (unit_price_minor between 0 and 100000000),
  addons_total_minor integer not null default 0 check (addons_total_minor >= 0),
  line_total_minor bigint not null check (line_total_minor = quantity::bigint * (unit_price_minor::bigint + addons_total_minor)),
  allergens text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (restaurant_id, id), unique (restaurant_id, order_id, id),
  foreign key (restaurant_id, order_id) references public.orders(restaurant_id, id) on delete restrict,
  foreign key (restaurant_id, product_id) references public.products(restaurant_id, id) on delete restrict,
  foreign key (restaurant_id, product_id, variant_id) references public.product_variants(restaurant_id, product_id, id) on delete restrict
);
create table public.order_item_addons (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  order_id uuid not null,
  order_item_id uuid not null,
  addon_id uuid not null,
  addon_name text not null check (length(addon_name) between 1 and 100),
  quantity integer not null default 1 check (quantity between 1 and 10),
  unit_price_minor integer not null check (unit_price_minor >= 0),
  unique (restaurant_id, id),
  foreign key (restaurant_id, order_id, order_item_id) references public.order_items(restaurant_id, order_id, id) on delete restrict,
  foreign key (restaurant_id, addon_id) references public.addons(restaurant_id, id) on delete restrict
);
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  order_id uuid not null,
  method public.cash_payment_method not null,
  status public.payment_status not null default 'unpaid',
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  recorded_by uuid references auth.users(id),
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id), unique (restaurant_id, order_id),
  foreign key (restaurant_id, order_id) references public.orders(restaurant_id, id) on delete restrict
);
create table public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  order_id uuid not null,
  status public.order_status not null,
  created_at timestamptz not null default now(),
  foreign key (restaurant_id, order_id) references public.orders(restaurant_id, id) on delete restrict
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  customer_id uuid,
  order_id uuid,
  reference text not null unique default ('TKT-' || upper(replace(gen_random_uuid()::text, '-', ''))),
  subject text not null check (length(btrim(subject)) between 1 and 150),
  contact_name text not null check (length(btrim(contact_name)) between 1 and 100),
  contact_email text not null check (length(contact_email) <= 254),
  category public.ticket_category not null default 'general',
  priority public.ticket_priority not null default 'normal',
  status public.ticket_status not null default 'open',
  assigned_to uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  foreign key (restaurant_id, customer_id) references public.restaurant_customers(restaurant_id, id) on delete restrict,
  foreign key (restaurant_id, order_id) references public.orders(restaurant_id, id) on delete restrict,
  foreign key (restaurant_id, assigned_to) references public.staff_memberships(restaurant_id, id) on delete restrict
);
create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  ticket_id uuid not null,
  author_user_id uuid references auth.users(id),
  author_type public.message_author not null,
  body text not null check (length(btrim(body)) between 1 and 5000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now(),
  unique (restaurant_id, id), unique (restaurant_id, ticket_id, id),
  foreign key (restaurant_id, ticket_id) references public.support_tickets(restaurant_id, id) on delete restrict,
  check (not is_internal or author_type = 'staff'),
  check (author_type <> 'staff' or author_user_id is not null)
);
create table public.support_attachments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  ticket_id uuid not null,
  message_id uuid not null,
  uploaded_by uuid references auth.users(id),
  object_path text not null unique check (length(object_path) <= 500),
  filename text not null check (length(filename) between 1 and 150),
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp','application/pdf','text/plain')),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  status public.attachment_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (restaurant_id, id),
  foreign key (restaurant_id, ticket_id, message_id) references public.support_messages(restaurant_id, ticket_id, id) on delete restrict
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

-- Hidden capability material: not exposed through the Data API or Realtime.
create table private.guest_access (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id),
  resource_type text not null check (resource_type in ('order','ticket')),
  resource_id uuid not null,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);
create table private.idempotency_keys (
  restaurant_id uuid not null references public.restaurants(id),
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  resource_type text not null check (resource_type in ('order','ticket')),
  resource_id uuid not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (restaurant_id, key_hash)
);

create index memberships_user_lookup on public.staff_memberships(user_id, restaurant_id, status);
create index customers_user_lookup on public.restaurant_customers(user_id, restaurant_id);
create index products_category_lookup on public.products(restaurant_id, category_id, is_active);
create index orders_customer_lookup on public.orders(restaurant_id, customer_id, created_at desc);
create index orders_staff_lookup on public.orders(restaurant_id, status, created_at desc);
create index order_items_order_lookup on public.order_items(restaurant_id, order_id);
create index order_addons_item_lookup on public.order_item_addons(restaurant_id, order_item_id);
create index tickets_customer_lookup on public.support_tickets(restaurant_id, customer_id, created_at desc);
create index tickets_assignment_lookup on public.support_tickets(restaurant_id, assigned_to, status);
create index messages_ticket_lookup on public.support_messages(restaurant_id, ticket_id, created_at);
create index attachments_message_lookup on public.support_attachments(restaurant_id, message_id);
create index audit_restaurant_lookup on public.audit_logs(restaurant_id, created_at desc);
create index status_events_order_lookup on public.order_status_events(restaurant_id, order_id, created_at);
