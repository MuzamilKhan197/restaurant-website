import 'server-only';
import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { getRestaurantId } from '@/features/auth/config';
import type { Database } from '@/lib/supabase/database.types';
import type { Dish, DietaryLabel } from '@/features/menu/types';

// Public reads deliberately never consume staff cookies or a service key.
export function publicClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  return createClient<Database>(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, cache: 'no-store', signal: AbortSignal.timeout(7000) }),
    },
  });
}
export const getPublicRestaurant = cache(async () => {
  const id = getRestaurantId(),
    client = publicClient();
  if (!id || !client) return { state: 'unavailable' as const, restaurant: null, settings: null };
  const restaurant = await client
    .from('restaurants')
    .select('id,name,currency,timezone,is_sample')
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle();
  if (restaurant.error) return { state: 'unavailable' as const, restaurant: null, settings: null };
  if (!restaurant.data) return { state: 'draft' as const, restaurant: null, settings: null };
  const settings = await client
    .from('restaurant_settings')
    .select(
      'website_mode,maintenance_message,reopening_at,contact_phone,contact_email,address,opening_hours,delivery_enabled,delivery_fee_minor,minimum_delivery_minor',
    )
    .eq('restaurant_id', id)
    .single();
  if (settings.error) return { state: 'unavailable' as const, restaurant: null, settings: null };
  return {
    state:
      settings.data.website_mode === 'maintenance' ? ('maintenance' as const) : ('ready' as const),
    restaurant: restaurant.data,
    settings: settings.data,
  };
});
const tags: Record<string, DietaryLabel> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  gluten_free: 'Gluten-free',
  signature: 'Signature',
};
const productColumns =
  'id,name,slug,category_id,description,base_price_minor,dietary_labels,allergens,is_available,is_featured' as const;
export async function getPublicMenu({
  page = 1,
  query = '',
  category = '',
  vegetarian = false,
  featured = false,
}: {
  page?: number;
  query?: string;
  category?: string;
  vegetarian?: boolean;
  featured?: boolean;
} = {}) {
  const context = await getPublicRestaurant();
  const client = publicClient();
  if (context.state !== 'ready' || !context.restaurant || !client)
    return {
      ...context,
      dishes: [] as Dish[],
      categories: [] as { id: string; name: string }[],
      count: 0,
    };
  const tenant = context.restaurant.id;
  const categories = await client
    .from('categories')
    .select('id,name')
    .eq('restaurant_id', tenant)
    .eq('is_active', true)
    .order('sort_order')
    .order('id');
  let request = client
    .from('products')
    .select(productColumns, { count: 'exact' })
    .eq('restaurant_id', tenant)
    .eq('is_active', true)
    .order('sort_order')
    .order('id');
  if (query)
    request = request.ilike('name', '%' + query.slice(0, 100).replace(/[\\%_]/g, '\\$&') + '%');
  if (category) request = request.eq('category_id', category);
  if (vegetarian) request = request.overlaps('dietary_labels', ['vegetarian', 'vegan']);
  if (featured) request = request.eq('is_featured', true);
  const products = await request.range((page - 1) * 24, featured ? 3 : page * 24 - 1);
  if (categories.error || products.error)
    return {
      ...context,
      state: 'unavailable' as const,
      dishes: [] as Dish[],
      categories: [],
      count: 0,
    };
  const ids = products.data.map((p) => p.id);
  const [variants, images, links] = ids.length
    ? await Promise.all([
        client
          .from('product_variants')
          .select('product_id,id,name,price_minor,is_default')
          .eq('restaurant_id', tenant)
          .eq('is_active', true)
          .in('product_id', ids)
          .order('sort_order')
          .order('id'),
        client
          .from('product_images')
          .select('product_id,object_path,alt_text')
          .eq('restaurant_id', tenant)
          .in('product_id', ids)
          .order('sort_order')
          .order('created_at'),
        client
          .from('product_addon_groups')
          .select('product_id,addon_group_id')
          .eq('restaurant_id', tenant)
          .in('product_id', ids)
          .order('sort_order'),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];
  const groupIds = [...new Set((links.data || []).map((link) => link.addon_group_id))];
  const [groups, addons] = groupIds.length
    ? await Promise.all([
        client
          .from('addon_groups')
          .select('id,name,min_selections,max_selections')
          .eq('restaurant_id', tenant)
          .eq('is_active', true)
          .in('id', groupIds),
        client
          .from('addons')
          .select('id,name,price_minor,is_available,addon_group_id')
          .eq('restaurant_id', tenant)
          .in('addon_group_id', groupIds)
          .order('name'),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (variants.error || images.error || links.error || groups.error || addons.error)
    return {
      ...context,
      state: 'unavailable' as const,
      dishes: [] as Dish[],
      categories: categories.data,
      count: 0,
    };
  const paths = [...new Set((images.data || []).map((i) => i.object_path))];
  const signed = paths.length
    ? await client.storage.from('menu-images').createSignedUrls(paths, 180)
    : null;
  const dishes: Dish[] = products.data.map((p) => {
    const sizes = (variants.data || []).filter((v) => v.product_id === p.id);
    const image = (images.data || []).find((i) => i.product_id === p.id);
    return {
      id: p.slug,
      name: p.name,
      category: categories.data.find((c) => c.id === p.category_id)?.name || 'Our menu',
      price:
        (sizes.length ? Math.min(...sizes.map((v) => v.price_minor)) : p.base_price_minor) / 100,
      currency: context.restaurant!.currency,
      fromPrice: sizes.length > 0,
      description: p.description,
      image: '',
      imageUrl: signed?.data?.find((s) => s.path === image?.object_path)?.signedUrl ?? undefined,
      imageAlt: image?.alt_text,
      tags: p.dietary_labels.map((t) => tags[t]).filter(Boolean),
      allergens: p.allergens.join(', ') || 'Ask restaurant staff',
      available: p.is_available,
      featured: p.is_featured,
      selection: {
        productId: p.id,
        basePrice: p.base_price_minor,
        ordering: context.settings.website_mode === 'normal',
        variants: sizes,
        groups: (links.data || [])
          .filter((link) => link.product_id === p.id)
          .flatMap((link) => {
            const group = (groups.data || []).find((entry) => entry.id === link.addon_group_id);
            return group
              ? [
                  {
                    ...group,
                    addons: (addons.data || []).filter(
                      (addon) => addon.addon_group_id === group.id,
                    ),
                  },
                ]
              : [];
          }),
      },
    };
  });
  return { ...context, dishes, categories: categories.data, count: products.count || 0 };
}
export const getPublicDish = cache(async (slug: string) => {
  const context = await getPublicRestaurant();
  const client = publicClient();
  if (context.state !== 'ready' || !context.restaurant || !client)
    return { ...context, dish: null, variants: [], groups: [], images: [] };
  const tenant = context.restaurant.id;
  const dish = await client
    .from('products')
    .select(productColumns)
    .eq('restaurant_id', tenant)
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (dish.error)
    return {
      ...context,
      state: 'unavailable' as const,
      dish: null,
      variants: [],
      groups: [],
      images: [],
    };
  if (!dish.data) return { ...context, dish: null, variants: [], groups: [], images: [] };
  const id = dish.data.id;
  const [variants, links, images] = await Promise.all([
    client
      .from('product_variants')
      .select('id,name,price_minor,is_default')
      .eq('restaurant_id', tenant)
      .eq('product_id', id)
      .eq('is_active', true)
      .order('sort_order')
      .order('id'),
    client
      .from('product_addon_groups')
      .select('addon_group_id')
      .eq('restaurant_id', tenant)
      .eq('product_id', id)
      .order('sort_order'),
    client
      .from('product_images')
      .select('object_path,alt_text')
      .eq('restaurant_id', tenant)
      .eq('product_id', id)
      .order('sort_order')
      .order('created_at'),
  ]);
  if (variants.error || links.error || images.error)
    return {
      ...context,
      state: 'unavailable' as const,
      dish: null,
      variants: [],
      groups: [],
      images: [],
    };
  const groupIds = links.data.map((l) => l.addon_group_id);
  const [groups, addons] = groupIds.length
    ? await Promise.all([
        client
          .from('addon_groups')
          .select('id,name,min_selections,max_selections')
          .eq('restaurant_id', tenant)
          .eq('is_active', true)
          .in('id', groupIds),
        client
          .from('addons')
          .select('id,name,price_minor,is_available,addon_group_id')
          .eq('restaurant_id', tenant)
          .in('addon_group_id', groupIds)
          .order('name'),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (groups.error || addons.error)
    return {
      ...context,
      state: 'unavailable' as const,
      dish: null,
      variants: [],
      groups: [],
      images: [],
    };
  const signed = images.data.length
    ? await client.storage.from('menu-images').createSignedUrls(
        images.data.map((i) => i.object_path),
        180,
      )
    : null;
  return {
    ...context,
    dish: dish.data,
    variants: variants.data,
    groups: links.data.flatMap((link) => {
      const g = (groups.data || []).find((g) => g.id === link.addon_group_id);
      return g
        ? [{ ...g, addons: (addons.data || []).filter((a) => a.addon_group_id === g.id) }]
        : [];
    }),
    images: images.data.map((i) => ({
      ...i,
      url: signed?.data?.find((s) => s.path === i.object_path)?.signedUrl,
    })),
  };
});
