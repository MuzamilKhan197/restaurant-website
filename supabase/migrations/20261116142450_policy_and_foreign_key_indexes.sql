-- Preserve predicates while using one policy per authenticated operation.
alter policy addon_groups_public_read on public.addon_groups to anon;
drop policy addon_groups_staff_read on public.addon_groups;
create policy combined_select on public.addon_groups for select to authenticated using ((private.addon_group_visible(restaurant_id, id)) or ((private.has_permission(restaurant_id, 'menu.read'::text) OR private.has_permission(restaurant_id, 'menu.manage'::text))));

alter policy addons_public_read on public.addons to anon;
drop policy addons_staff_read on public.addons;
create policy combined_select on public.addons for select to authenticated using (((is_available AND private.addon_group_visible(restaurant_id, addon_group_id))) or ((private.has_permission(restaurant_id, 'menu.read'::text) OR private.has_permission(restaurant_id, 'menu.manage'::text))));

alter policy categories_public_read on public.categories to anon;
drop policy categories_staff_read on public.categories;
create policy combined_select on public.categories for select to authenticated using (((is_active AND private.storefront_visible(restaurant_id))) or ((private.has_permission(restaurant_id, 'menu.read'::text) OR private.has_permission(restaurant_id, 'menu.manage'::text))));

drop policy delivery_zones_staff_read on public.delivery_zones;
alter policy zones_public_read on public.delivery_zones to anon;
create policy combined_select on public.delivery_zones for select to authenticated using (((private.has_permission(restaurant_id, 'menu.read'::text) OR private.has_permission(restaurant_id, 'menu.manage'::text))) or ((is_active AND private.storefront_visible(restaurant_id))));

alter policy product_addon_groups_public_read on public.product_addon_groups to anon;
drop policy product_addon_groups_staff_read on public.product_addon_groups;
create policy combined_select on public.product_addon_groups for select to authenticated using (((private.product_visible(restaurant_id, product_id) AND private.addon_group_visible(restaurant_id, addon_group_id))) or ((private.has_permission(restaurant_id, 'menu.read'::text) OR private.has_permission(restaurant_id, 'menu.manage'::text))));

alter policy images_public_read on public.product_images to anon;
drop policy product_images_staff_read on public.product_images;
create policy combined_select on public.product_images for select to authenticated using ((private.product_visible(restaurant_id, product_id)) or ((private.has_permission(restaurant_id, 'menu.read'::text) OR private.has_permission(restaurant_id, 'menu.manage'::text))));

drop policy product_variants_staff_read on public.product_variants;
alter policy variants_public_read on public.product_variants to anon;
create policy combined_select on public.product_variants for select to authenticated using (((private.has_permission(restaurant_id, 'menu.read'::text) OR private.has_permission(restaurant_id, 'menu.manage'::text))) or ((is_active AND private.product_visible(restaurant_id, product_id))));

alter policy products_public_read on public.products to anon;
drop policy products_staff_read on public.products;
create policy combined_select on public.products for select to authenticated using ((private.product_visible(restaurant_id, id)) or ((private.has_permission(restaurant_id, 'menu.read'::text) OR private.has_permission(restaurant_id, 'menu.manage'::text))));

alter policy settings_public_read on public.restaurant_settings to anon;
drop policy settings_staff_read on public.restaurant_settings;
create policy combined_select on public.restaurant_settings for select to authenticated using ((private.is_published(restaurant_id)) or (private.has_permission(restaurant_id, 'settings.read'::text)));

drop policy restaurant_owner_read on public.restaurants;
alter policy restaurant_read on public.restaurants to anon;
create policy combined_select on public.restaurants for select to authenticated using (((private.is_owner(id) OR private.is_staff(id))) or (is_published));

drop policy attachments_owner_pending_read on public.support_attachments;
drop policy attachments_read on public.support_attachments;
create policy combined_select on public.support_attachments for select to authenticated using ((((uploaded_by = ( SELECT auth.uid() AS uid)) AND private.can_read_message(restaurant_id, message_id))) or (((status = 'ready'::attachment_status) AND private.can_read_message(restaurant_id, message_id))));

drop policy messages_customer_insert on public.support_messages;
drop policy messages_staff_insert on public.support_messages;
create policy combined_insert on public.support_messages for insert to authenticated with check ((((author_user_id = ( SELECT auth.uid() AS uid)) AND (author_type = 'customer'::message_author) AND (NOT is_internal) AND (EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE ((t.restaurant_id = support_messages.restaurant_id) AND (t.id = support_messages.ticket_id) AND private.is_customer(t.restaurant_id, t.customer_id) AND (t.status <> ALL (ARRAY['resolved'::ticket_status, 'closed'::ticket_status]))))))) or (((author_user_id = ( SELECT auth.uid() AS uid)) AND (author_type = 'staff'::message_author) AND private.has_permission(restaurant_id, 'support.reply'::text) AND private.has_permission(restaurant_id, 'support.read'::text))));

create index guest_access_restaurant_id_fk on private.guest_access(restaurant_id);
create index addons_restaurant_id_addon_group_id_fk on public.addons(restaurant_id,addon_group_id);
create index order_item_addons_restaurant_id_addon_id_fk on public.order_item_addons(restaurant_id,addon_id);
create index order_item_addons_restaurant_id_order_id_order_item_id_fk on public.order_item_addons(restaurant_id,order_id,order_item_id);
create index order_items_restaurant_id_product_id_variant_id_fk on public.order_items(restaurant_id,product_id,variant_id);
create index orders_restaurant_id_delivery_zone_id_fk on public.orders(restaurant_id,delivery_zone_id);
create index payments_recorded_by_fk on public.payments(recorded_by);
create index product_addon_groups_restaurant_id_addon_group_id_fk on public.product_addon_groups(restaurant_id,addon_group_id);
create index product_images_restaurant_id_product_id_fk on public.product_images(restaurant_id,product_id);
create index restaurants_owner_user_id_fk on public.restaurants(owner_user_id);
create index role_permissions_permission_key_fk on public.role_permissions(permission_key);
create index staff_invitations_invited_by_fk on public.staff_invitations(invited_by);
create index staff_invitations_restaurant_id_role_id_fk on public.staff_invitations(restaurant_id,role_id);
create index staff_memberships_restaurant_id_role_id_fk on public.staff_memberships(restaurant_id,role_id);
create index support_attachments_restaurant_id_ticket_id_message_id_fk on public.support_attachments(restaurant_id,ticket_id,message_id);
create index support_attachments_uploaded_by_fk on public.support_attachments(uploaded_by);
create index support_messages_author_user_id_fk on public.support_messages(author_user_id);
create index support_tickets_restaurant_id_order_id_fk on public.support_tickets(restaurant_id,order_id);
