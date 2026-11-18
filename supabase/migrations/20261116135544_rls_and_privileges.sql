-- Explicit privileges and RLS are both required. Policies never trust
-- user-editable Auth metadata or a role name supplied by the browser.
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public, private to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all tables in schema private to service_role;
revoke all on all tables in schema private from anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant execute on function private.is_published(uuid), private.storefront_visible(uuid), private.product_visible(uuid,uuid), private.addon_group_visible(uuid,uuid) to anon, authenticated;
grant execute on function private.is_owner(uuid), private.is_staff(uuid), private.has_permission(uuid,text), private.is_customer(uuid,uuid), private.can_read_order(uuid,uuid), private.can_read_ticket(uuid,uuid), private.can_read_message(uuid,uuid) to authenticated;

grant select on public.restaurants, public.restaurant_settings, public.delivery_zones, public.categories, public.products, public.product_images, public.product_variants, public.addon_groups, public.product_addon_groups, public.addons to anon, authenticated;
grant select on public.profiles, public.permissions, public.roles, public.role_permissions, public.staff_memberships, public.staff_invitations, public.restaurant_customers, public.customer_addresses, public.orders, public.order_items, public.order_item_addons, public.payments, public.order_status_events, public.support_tickets, public.support_messages, public.support_attachments, public.audit_logs to authenticated;

grant update(display_name,avatar_path) on public.profiles to authenticated;
grant update(name,slug,timezone,is_published,is_sample) on public.restaurants to authenticated;
grant update(contact_email,contact_phone,address,opening_hours,delivery_enabled,delivery_fee_minor,minimum_delivery_minor,tax_rate_bps) on public.restaurant_settings to authenticated;
-- Website switches are exposed only through a narrowly scoped permission RPC.
grant insert(restaurant_id,name,slug) on public.roles to authenticated;
grant update(name,is_active) on public.roles to authenticated;
grant delete on public.roles to authenticated;
grant insert,delete on public.role_permissions to authenticated;
grant insert(restaurant_id,user_id,role_id,display_name,contact_email,status) on public.staff_memberships to authenticated;
grant update(role_id,display_name,contact_email,status) on public.staff_memberships to authenticated;
grant delete on public.staff_memberships to authenticated;
grant insert(restaurant_id,user_id,display_name,contact_email,phone) on public.restaurant_customers to authenticated;
grant update(display_name,contact_email,phone) on public.restaurant_customers to authenticated;
grant insert(restaurant_id,customer_id,label,address_line,area,city,instructions,is_default), update(label,address_line,area,city,instructions,is_default), delete on public.customer_addresses to authenticated;
grant insert,update,delete on public.delivery_zones, public.categories, public.products, public.product_images, public.product_variants, public.addon_groups, public.product_addon_groups, public.addons to authenticated;
-- Financial creation/snapshot writes require a trusted transactional server RPC
-- in Phase 6. Neither a customer nor an owner can submit their own prices here.
grant update(status,rejection_reason,cancellation_reason) on public.orders to authenticated;
grant update(status,recorded_by) on public.payments to authenticated;
grant update(status,priority,assigned_to) on public.support_tickets to authenticated;
grant insert(restaurant_id,ticket_id,author_user_id,author_type,body,is_internal) on public.support_messages to authenticated;
grant insert(restaurant_id,ticket_id,message_id,uploaded_by,object_path,filename,content_type,size_bytes,status) on public.support_attachments to authenticated;

create policy restaurant_read on public.restaurants for select to anon, authenticated using (is_published);
create policy restaurant_owner_read on public.restaurants for select to authenticated using (private.is_owner(id) or private.is_staff(id));
create policy restaurant_update on public.restaurants for update to authenticated using (private.is_owner(id)) with check (private.is_owner(id));
create policy settings_public_read on public.restaurant_settings for select to anon, authenticated using (private.is_published(restaurant_id));
create policy settings_staff_read on public.restaurant_settings for select to authenticated using (private.has_permission(restaurant_id,'settings.read'));
create policy settings_update on public.restaurant_settings for update to authenticated using (private.has_permission(restaurant_id,'settings.manage')) with check (private.has_permission(restaurant_id,'settings.manage'));
create policy profiles_self_read on public.profiles for select to authenticated using (id=(select auth.uid()));
create policy profiles_self_update on public.profiles for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));
create policy permissions_read on public.permissions for select to authenticated using (true);
create policy roles_read on public.roles for select to authenticated using (private.is_staff(restaurant_id));
create policy roles_owner_insert on public.roles for insert to authenticated with check (private.is_owner(restaurant_id) and not is_system);
create policy roles_owner_update on public.roles for update to authenticated using (private.is_owner(restaurant_id)) with check (private.is_owner(restaurant_id));
create policy roles_owner_delete on public.roles for delete to authenticated using (private.is_owner(restaurant_id) and not is_system);
create policy role_permissions_read on public.role_permissions for select to authenticated using (private.is_staff(restaurant_id));
create policy role_permissions_owner_insert on public.role_permissions for insert to authenticated with check (private.is_owner(restaurant_id));
create policy role_permissions_owner_delete on public.role_permissions for delete to authenticated using (private.is_owner(restaurant_id));
create policy staff_read on public.staff_memberships for select to authenticated using (user_id=(select auth.uid()) or private.has_permission(restaurant_id,'staff.read'));
create policy staff_owner_insert on public.staff_memberships for insert to authenticated with check (private.is_owner(restaurant_id));
create policy staff_owner_update on public.staff_memberships for update to authenticated using (private.is_owner(restaurant_id)) with check (private.is_owner(restaurant_id));
create policy staff_owner_delete on public.staff_memberships for delete to authenticated using (private.is_owner(restaurant_id));
create policy invitations_owner_read on public.staff_invitations for select to authenticated using (private.is_owner(restaurant_id));
create policy customers_read on public.restaurant_customers for select to authenticated using (user_id=(select auth.uid()) or private.has_permission(restaurant_id,'customers.read'));
create policy customers_self_insert on public.restaurant_customers for insert to authenticated with check (user_id=(select auth.uid()) and private.is_published(restaurant_id));
create policy customers_self_update on public.restaurant_customers for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy addresses_self_read on public.customer_addresses for select to authenticated using (private.is_customer(restaurant_id,customer_id));
create policy addresses_self_insert on public.customer_addresses for insert to authenticated with check (private.is_customer(restaurant_id,customer_id));
create policy addresses_self_update on public.customer_addresses for update to authenticated using (private.is_customer(restaurant_id,customer_id)) with check (private.is_customer(restaurant_id,customer_id));
create policy addresses_self_delete on public.customer_addresses for delete to authenticated using (private.is_customer(restaurant_id,customer_id));

create policy categories_public_read on public.categories for select to anon, authenticated using (is_active and private.storefront_visible(restaurant_id));
create policy products_public_read on public.products for select to anon, authenticated using (private.product_visible(restaurant_id,id));
create policy images_public_read on public.product_images for select to anon, authenticated using (private.product_visible(restaurant_id,product_id));
create policy variants_public_read on public.product_variants for select to anon, authenticated using (is_active and private.product_visible(restaurant_id,product_id));
create policy addon_groups_public_read on public.addon_groups for select to anon, authenticated using (private.addon_group_visible(restaurant_id,id));
create policy product_addon_groups_public_read on public.product_addon_groups for select to anon, authenticated using (private.product_visible(restaurant_id,product_id) and private.addon_group_visible(restaurant_id,addon_group_id));
create policy addons_public_read on public.addons for select to anon, authenticated using (is_available and private.addon_group_visible(restaurant_id,addon_group_id));
create policy zones_public_read on public.delivery_zones for select to anon, authenticated using (is_active and private.storefront_visible(restaurant_id));

create policy orders_read on public.orders for select to authenticated using (private.has_permission(restaurant_id,'orders.read') or private.is_customer(restaurant_id,customer_id));
create policy orders_staff_update on public.orders for update to authenticated using (private.has_permission(restaurant_id,'orders.update')) with check (private.has_permission(restaurant_id,'orders.update'));
create policy order_items_read on public.order_items for select to authenticated using (private.can_read_order(restaurant_id,order_id));
create policy order_item_addons_read on public.order_item_addons for select to authenticated using (private.can_read_order(restaurant_id,order_id));
create policy payments_read on public.payments for select to authenticated using (private.can_read_order(restaurant_id,order_id) or private.has_permission(restaurant_id,'payments.manage'));
create policy payments_staff_update on public.payments for update to authenticated using (private.has_permission(restaurant_id,'payments.manage')) with check (private.has_permission(restaurant_id,'payments.manage'));
create policy order_events_read on public.order_status_events for select to authenticated using (private.can_read_order(restaurant_id,order_id));
create policy tickets_read on public.support_tickets for select to authenticated using (private.has_permission(restaurant_id,'support.read') or private.is_customer(restaurant_id,customer_id));
create policy tickets_staff_update on public.support_tickets for update to authenticated using (private.has_permission(restaurant_id,'support.manage')) with check (private.has_permission(restaurant_id,'support.manage'));
create policy messages_read on public.support_messages for select to authenticated using (private.has_permission(restaurant_id,'support.read') or (not is_internal and private.can_read_ticket(restaurant_id,ticket_id)));
create policy messages_customer_insert on public.support_messages for insert to authenticated with check (
  author_user_id=(select auth.uid()) and author_type='customer' and not is_internal and exists (
    select 1 from public.support_tickets t where t.restaurant_id=support_messages.restaurant_id and t.id=support_messages.ticket_id and private.is_customer(t.restaurant_id,t.customer_id) and t.status not in ('resolved','closed')
  )
);
create policy messages_staff_insert on public.support_messages for insert to authenticated with check (author_user_id=(select auth.uid()) and author_type='staff' and private.has_permission(restaurant_id,'support.reply') and private.has_permission(restaurant_id,'support.read'));
create policy attachments_read on public.support_attachments for select to authenticated using (status='ready' and private.can_read_message(restaurant_id,message_id));
create policy attachments_owner_pending_read on public.support_attachments for select to authenticated using (uploaded_by=(select auth.uid()) and private.can_read_message(restaurant_id,message_id));
create policy attachments_insert on public.support_attachments for insert to authenticated with check (status='pending' and uploaded_by=(select auth.uid()) and exists (
  select 1 from public.support_messages m where m.restaurant_id=support_attachments.restaurant_id and m.ticket_id=support_attachments.ticket_id and m.id=support_attachments.message_id
    and m.author_user_id=(select auth.uid()) and private.can_read_message(m.restaurant_id,m.id)
));
create policy audit_staff_read on public.audit_logs for select to authenticated using (private.has_permission(restaurant_id,'audit.read'));

-- No INSERT/UPDATE/DELETE policies exist for financial snapshots, guest keys,
-- audit records, status events or invitations. Default deny is intentional.
alter table private.guest_access enable row level security;
alter table private.idempotency_keys enable row level security;

-- Anonymous callers cannot see whether a draft restaurant, private record or
-- private key exists by querying it. Read helpers return only scoped booleans.

-- All public tables opt in to RLS, including catalog and lookup tables.
alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.restaurant_settings enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.staff_memberships enable row level security;
alter table public.staff_invitations enable row level security;
alter table public.restaurant_customers enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.addon_groups enable row level security;
alter table public.product_addon_groups enable row level security;
alter table public.addons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_addons enable row level security;
alter table public.payments enable row level security;
alter table public.order_status_events enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_attachments enable row level security;
alter table public.audit_logs enable row level security;

create policy delivery_zones_staff_read on public.delivery_zones for select to authenticated using (private.has_permission(restaurant_id,'menu.read') or private.has_permission(restaurant_id,'menu.manage'));
create policy delivery_zones_staff_insert on public.delivery_zones for insert to authenticated with check (private.has_permission(restaurant_id,'menu.manage'));
create policy delivery_zones_staff_update on public.delivery_zones for update to authenticated using (private.has_permission(restaurant_id,'menu.manage')) with check (private.has_permission(restaurant_id,'menu.manage'));
create policy delivery_zones_staff_delete on public.delivery_zones for delete to authenticated using (private.has_permission(restaurant_id,'menu.manage')) ;

create policy categories_staff_read on public.categories for select to authenticated using (private.has_permission(restaurant_id,'menu.read') or private.has_permission(restaurant_id,'menu.manage'));
create policy categories_staff_insert on public.categories for insert to authenticated with check (private.has_permission(restaurant_id,'menu.manage'));
create policy categories_staff_update on public.categories for update to authenticated using (private.has_permission(restaurant_id,'menu.manage')) with check (private.has_permission(restaurant_id,'menu.manage'));
create policy categories_staff_delete on public.categories for delete to authenticated using (private.has_permission(restaurant_id,'menu.manage')) ;

create policy products_staff_read on public.products for select to authenticated using (private.has_permission(restaurant_id,'menu.read') or private.has_permission(restaurant_id,'menu.manage'));
create policy products_staff_insert on public.products for insert to authenticated with check (private.has_permission(restaurant_id,'menu.manage'));
create policy products_staff_update on public.products for update to authenticated using (private.has_permission(restaurant_id,'menu.manage')) with check (private.has_permission(restaurant_id,'menu.manage'));
create policy products_staff_delete on public.products for delete to authenticated using (private.has_permission(restaurant_id,'menu.manage')) ;

create policy product_images_staff_read on public.product_images for select to authenticated using (private.has_permission(restaurant_id,'menu.read') or private.has_permission(restaurant_id,'menu.manage'));
create policy product_images_staff_insert on public.product_images for insert to authenticated with check (private.has_permission(restaurant_id,'menu.manage'));
create policy product_images_staff_update on public.product_images for update to authenticated using (private.has_permission(restaurant_id,'menu.manage')) with check (private.has_permission(restaurant_id,'menu.manage'));
create policy product_images_staff_delete on public.product_images for delete to authenticated using (private.has_permission(restaurant_id,'menu.manage')) ;

create policy product_variants_staff_read on public.product_variants for select to authenticated using (private.has_permission(restaurant_id,'menu.read') or private.has_permission(restaurant_id,'menu.manage'));
create policy product_variants_staff_insert on public.product_variants for insert to authenticated with check (private.has_permission(restaurant_id,'menu.manage'));
create policy product_variants_staff_update on public.product_variants for update to authenticated using (private.has_permission(restaurant_id,'menu.manage')) with check (private.has_permission(restaurant_id,'menu.manage'));
create policy product_variants_staff_delete on public.product_variants for delete to authenticated using (private.has_permission(restaurant_id,'menu.manage')) ;

create policy addon_groups_staff_read on public.addon_groups for select to authenticated using (private.has_permission(restaurant_id,'menu.read') or private.has_permission(restaurant_id,'menu.manage'));
create policy addon_groups_staff_insert on public.addon_groups for insert to authenticated with check (private.has_permission(restaurant_id,'menu.manage'));
create policy addon_groups_staff_update on public.addon_groups for update to authenticated using (private.has_permission(restaurant_id,'menu.manage')) with check (private.has_permission(restaurant_id,'menu.manage'));
create policy addon_groups_staff_delete on public.addon_groups for delete to authenticated using (private.has_permission(restaurant_id,'menu.manage')) ;

create policy product_addon_groups_staff_read on public.product_addon_groups for select to authenticated using (private.has_permission(restaurant_id,'menu.read') or private.has_permission(restaurant_id,'menu.manage'));
create policy product_addon_groups_staff_insert on public.product_addon_groups for insert to authenticated with check (private.has_permission(restaurant_id,'menu.manage'));
create policy product_addon_groups_staff_update on public.product_addon_groups for update to authenticated using (private.has_permission(restaurant_id,'menu.manage')) with check (private.has_permission(restaurant_id,'menu.manage'));
create policy product_addon_groups_staff_delete on public.product_addon_groups for delete to authenticated using (private.has_permission(restaurant_id,'menu.manage')) ;

create policy addons_staff_read on public.addons for select to authenticated using (private.has_permission(restaurant_id,'menu.read') or private.has_permission(restaurant_id,'menu.manage'));
create policy addons_staff_insert on public.addons for insert to authenticated with check (private.has_permission(restaurant_id,'menu.manage'));
create policy addons_staff_update on public.addons for update to authenticated using (private.has_permission(restaurant_id,'menu.manage')) with check (private.has_permission(restaurant_id,'menu.manage'));
create policy addons_staff_delete on public.addons for delete to authenticated using (private.has_permission(restaurant_id,'menu.manage')) ;

-- Keep tenant scope and foreign ownership immutable on every update.
create trigger guard_identity before update on public.profiles for each row execute function private.guard_identity('id');
create trigger guard_identity before update on public.restaurants for each row execute function private.guard_identity('id');
create trigger guard_identity before update on public.restaurant_settings for each row execute function private.guard_identity('id','restaurant_id');
create trigger guard_identity before update on public.roles for each row execute function private.guard_identity('id','restaurant_id');
create trigger guard_identity before update on public.role_permissions for each row execute function private.guard_identity('id','restaurant_id','role_id','permission_key');
create trigger guard_identity before update on public.staff_memberships for each row execute function private.guard_identity('id','restaurant_id','user_id');
create trigger guard_identity before update on public.staff_invitations for each row execute function private.guard_identity('id','restaurant_id');
create trigger guard_identity before update on public.restaurant_customers for each row execute function private.guard_identity('id','restaurant_id','user_id');
create trigger guard_identity before update on public.customer_addresses for each row execute function private.guard_identity('id','restaurant_id','customer_id');
create trigger guard_identity before update on public.delivery_zones for each row execute function private.guard_identity('id','restaurant_id');
create trigger guard_identity before update on public.categories for each row execute function private.guard_identity('id','restaurant_id');
create trigger guard_identity before update on public.products for each row execute function private.guard_identity('id','restaurant_id');
create trigger guard_identity before update on public.product_images for each row execute function private.guard_identity('id','restaurant_id','product_id');
create trigger guard_identity before update on public.product_variants for each row execute function private.guard_identity('id','restaurant_id','product_id');
create trigger guard_identity before update on public.addon_groups for each row execute function private.guard_identity('id','restaurant_id');
create trigger guard_identity before update on public.product_addon_groups for each row execute function private.guard_identity('id','restaurant_id','product_id','addon_group_id');
create trigger guard_identity before update on public.addons for each row execute function private.guard_identity('id','restaurant_id','addon_group_id');
create trigger guard_identity before update on public.orders for each row execute function private.guard_identity('id','restaurant_id');
create trigger guard_identity before update on public.payments for each row execute function private.guard_identity('id','restaurant_id');
create trigger guard_identity before update on public.support_tickets for each row execute function private.guard_identity('id','restaurant_id','customer_id','order_id','reference','contact_name','contact_email','created_at');
create trigger guard_identity before update on public.support_attachments for each row execute function private.guard_identity('id','restaurant_id','ticket_id','message_id','uploaded_by','object_path','created_at');
create trigger immutable_record before update or delete on public.order_items for each row execute function private.immutable_record();
create trigger immutable_record before update or delete on public.order_item_addons for each row execute function private.immutable_record();
create trigger immutable_record before update or delete on public.order_status_events for each row execute function private.immutable_record();
create trigger immutable_record before update or delete on public.support_messages for each row execute function private.immutable_record();
create trigger immutable_record before update or delete on public.audit_logs for each row execute function private.immutable_record();
create trigger touch_updated_at before update on public.profiles for each row execute function private.touch_updated_at();
create trigger touch_updated_at before update on public.restaurants for each row execute function private.touch_updated_at();
create trigger touch_updated_at before update on public.restaurant_settings for each row execute function private.touch_updated_at();
create trigger touch_updated_at before update on public.staff_memberships for each row execute function private.touch_updated_at();
create trigger touch_updated_at before update on public.restaurant_customers for each row execute function private.touch_updated_at();
create trigger touch_updated_at before update on public.customer_addresses for each row execute function private.touch_updated_at();
create trigger touch_updated_at before update on public.categories for each row execute function private.touch_updated_at();
create trigger touch_updated_at before update on public.products for each row execute function private.touch_updated_at();
create trigger touch_updated_at before update on public.orders for each row execute function private.touch_updated_at();
create trigger touch_updated_at before update on public.payments for each row execute function private.touch_updated_at();
create trigger touch_updated_at before update on public.support_tickets for each row execute function private.touch_updated_at();
create trigger audit_change after insert or update or delete on public.restaurants for each row execute function private.audit_change();
create trigger audit_change after insert or update or delete on public.restaurant_settings for each row execute function private.audit_change();
create trigger audit_change after insert or update or delete on public.roles for each row execute function private.audit_change();
create trigger audit_change after insert or update or delete on public.role_permissions for each row execute function private.audit_change();
create trigger audit_change after insert or update or delete on public.staff_memberships for each row execute function private.audit_change();
create trigger audit_change after insert or update or delete on public.staff_invitations for each row execute function private.audit_change();
create trigger audit_change after insert or update or delete on public.restaurant_customers for each row execute function private.audit_change();
create trigger audit_change after insert or update or delete on public.delivery_zones for each row execute function private.audit_change();
create trigger audit_change after insert or update or delete on public.categories for each row execute function private.audit_change();
create trigger audit_change after insert or update or delete on public.products for each row execute function private.audit_change();
create trigger audit_change after insert or update or delete on public.product_images for each row execute function private.audit_change();
create trigger audit_change after insert or update or delete on public.product_variants for each row execute function private.audit_change();
create trigger audit_change after insert or update or delete on public.addon_groups for each row execute function private.audit_change();
create trigger audit_change after insert or update or delete on public.product_addon_groups for each row execute function private.audit_change();
create trigger audit_change after insert or update or delete on public.addons for each row execute function private.audit_change();
create trigger audit_change after insert or update or delete on public.orders for each row execute function private.audit_change();
create trigger audit_change after insert or update or delete on public.order_items for each row execute function private.audit_change();
create trigger audit_change after insert or update or delete on public.order_item_addons for each row execute function private.audit_change();
create trigger audit_change after insert or update or delete on public.payments for each row execute function private.audit_change();
create trigger audit_change after insert or update or delete on public.support_tickets for each row execute function private.audit_change();
create trigger audit_change after insert or update or delete on public.support_messages for each row execute function private.audit_change();
create trigger audit_change after insert or update or delete on public.support_attachments for each row execute function private.audit_change();
