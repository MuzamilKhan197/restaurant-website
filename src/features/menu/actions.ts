'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prepareMenuImage } from './image-processing';
import { requireStaff } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';
import {
  categorySchema,
  productSchema,
  variantSchema,
  groupSchema,
  addonSchema,
  linkSchema,
  imageSchema,
  deleteSchema,
  validateImage,
  MAX_IMAGE_SIZE,
} from './validation';
import type { MenuState } from './admin-types';

function values(form: FormData) {
  return {
    ...Object.fromEntries(form),
    is_active: form.get('is_active') === 'on',
    is_available: form.get('is_available') === 'on',
    is_featured: form.get('is_featured') === 'on',
    is_default: form.get('is_default') === 'on',
    dietary_labels: form.getAll('dietary_labels'),
  };
}
function invalid(issues: { message: string }[]): MenuState {
  return { error: issues[0]?.message || 'Check the form details.' };
}
function finish(error: { code?: string } | null, message: string): MenuState {
  if (error)
    return {
      error:
        error.code === '23505'
          ? 'That slug or option name is already in use.'
          : error.code === '23503'
            ? 'This record is still in use. Remove its links first, or mark it inactive to preserve order history.'
            : 'Unable to save this change. Check your access and the record details.',
    };
  revalidatePath('/admin/menu');
  revalidatePath('/admin/menu/[id]', 'page');
  return { success: message };
}
export async function saveCategory(_state: MenuState, form: FormData): Promise<MenuState> {
  const access = await requireStaff('menu.manage');
  const parsed = categorySchema.safeParse(values(form));
  if (!parsed.success) return invalid(parsed.error.issues);
  const client = await createClient();
  const { id, ...record } = parsed.data;
  const result = id
    ? await client
        .from('categories')
        .update(record)
        .eq('restaurant_id', access.restaurant_id)
        .eq('id', id)
        .select('id')
        .single()
    : await client
        .from('categories')
        .insert({ ...record, restaurant_id: access.restaurant_id })
        .select('id')
        .single();
  return finish(result.error, 'Category saved.');
}
export async function saveProduct(_state: MenuState, form: FormData): Promise<MenuState> {
  const access = await requireStaff('menu.manage');
  const parsed = productSchema.safeParse(values(form));
  if (!parsed.success) return invalid(parsed.error.issues);
  const client = await createClient();
  const { id, price, ...record } = parsed.data;
  const data = { ...record, base_price_minor: price };
  const result = id
    ? await client
        .from('products')
        .update(data)
        .eq('restaurant_id', access.restaurant_id)
        .eq('id', id)
        .select('id')
        .single()
    : await client
        .from('products')
        .insert({ ...data, restaurant_id: access.restaurant_id })
        .select('id')
        .single();
  return {
    ...finish(result.error, 'Dish saved.'),
    ...(result.data ? { href: '/admin/menu/' + result.data.id } : {}),
  };
}
export async function saveVariant(_state: MenuState, form: FormData): Promise<MenuState> {
  const access = await requireStaff('menu.manage');
  const parsed = variantSchema.safeParse(values(form));
  if (!parsed.success) return invalid(parsed.error.issues);
  const v = parsed.data;
  const client = await createClient();
  const { error } = await client.rpc('save_menu_variant', {
    p_restaurant: access.restaurant_id,
    p_product: v.product_id,
    p_variant: v.id || null,
    p_name: v.name,
    p_price: v.price,
    p_active: v.is_active,
    p_default: v.is_default,
    p_sort: v.sort_order,
  });
  return finish(error, 'Variant saved.');
}
export async function saveGroup(_state: MenuState, form: FormData): Promise<MenuState> {
  const access = await requireStaff('menu.manage');
  const parsed = groupSchema.safeParse(values(form));
  if (!parsed.success) return invalid(parsed.error.issues);
  const client = await createClient();
  const { id, ...record } = parsed.data;
  const result = id
    ? await client
        .from('addon_groups')
        .update(record)
        .eq('restaurant_id', access.restaurant_id)
        .eq('id', id)
        .select('id')
        .single()
    : await client
        .from('addon_groups')
        .insert({ ...record, restaurant_id: access.restaurant_id })
        .select('id')
        .single();
  return finish(result.error, 'Add-on group saved.');
}
export async function saveAddon(_state: MenuState, form: FormData): Promise<MenuState> {
  const access = await requireStaff('menu.manage');
  const parsed = addonSchema.safeParse(values(form));
  if (!parsed.success) return invalid(parsed.error.issues);
  const client = await createClient();
  const { id, price, ...record } = parsed.data;
  const data = { ...record, price_minor: price };
  const result = id
    ? await client
        .from('addons')
        .update(data)
        .eq('restaurant_id', access.restaurant_id)
        .eq('addon_group_id', record.addon_group_id)
        .eq('id', id)
        .select('id')
        .single()
    : await client
        .from('addons')
        .insert({ ...data, restaurant_id: access.restaurant_id })
        .select('id')
        .single();
  return finish(result.error, 'Add-on saved.');
}
export async function linkGroup(_state: MenuState, form: FormData): Promise<MenuState> {
  const access = await requireStaff('menu.manage');
  const parsed = linkSchema.safeParse(values(form));
  if (!parsed.success) return invalid(parsed.error.issues);
  const client = await createClient();
  const { error } = await client
    .from('product_addon_groups')
    .upsert(
      { ...parsed.data, restaurant_id: access.restaurant_id },
      { onConflict: 'restaurant_id,product_id,addon_group_id' },
    );
  return finish(error, 'Add-on group linked.');
}
export async function uploadImage(_state: MenuState, form: FormData): Promise<MenuState> {
  const access = await requireStaff('menu.manage');
  const parsed = imageSchema.safeParse(values(form));
  if (!parsed.success) return invalid(parsed.error.issues);
  const file = form.get('file');
  if (!(file instanceof File) || file.size > MAX_IMAGE_SIZE)
    return { error: 'Choose a JPEG, PNG or WebP image up to 5 MiB.' };
  const client = await createClient();
  const { data: product } = await client
    .from('products')
    .select('id')
    .eq('restaurant_id', access.restaurant_id)
    .eq('id', parsed.data.product_id)
    .maybeSingle();
  if (!product) return { error: 'Dish unavailable.' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  let prepared: Uint8Array;
  try {
    validateImage(bytes, file.type);
    prepared = await prepareMenuImage(bytes);
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (prepared.length > MAX_IMAGE_SIZE)
    return { error: 'The processed image is too large. Choose a smaller photograph.' };
  const objectPath = `${access.restaurant_id}/products/${product.id}/${randomUUID()}.webp`;
  const upload = await client.storage.from('menu-images').upload(objectPath, prepared, {
    contentType: 'image/webp',
    upsert: false,
    cacheControl: '180',
  });
  if (upload.error) return { error: 'Image upload failed. Please try again.' };
  const { error } = await client.from('product_images').insert({
    restaurant_id: access.restaurant_id,
    product_id: product.id,
    object_path: objectPath,
    alt_text: parsed.data.alt_text,
    sort_order: parsed.data.sort_order,
  });
  if (error) await client.storage.from('menu-images').remove([objectPath]);
  return finish(error, 'Image uploaded.');
}
export async function saveImageMetadata(_state: MenuState, form: FormData): Promise<MenuState> {
  const access = await requireStaff('menu.manage');
  const parsed = imageSchema.safeParse(values(form));
  if (!parsed.success || !parsed.data.id) return { error: 'Check the image details.' };
  const client = await createClient();
  const v = parsed.data;
  const { error } = await client
    .from('product_images')
    .update({ alt_text: v.alt_text, sort_order: v.sort_order })
    .eq('restaurant_id', access.restaurant_id)
    .eq('product_id', v.product_id)
    .eq('id', v.id!)
    .select('id')
    .single();
  return finish(error, 'Image details saved.');
}
export async function deleteMenuRecord(_state: MenuState, form: FormData): Promise<MenuState> {
  const access = await requireStaff('menu.manage');
  const parsed = deleteSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Invalid record.' };
  const client = await createClient();
  const v = parsed.data;
  if (v.entity === 'link') {
    if (!v.product_id || !v.addon_group_id) return { error: 'Invalid group link.' };
    const { error } = await client
      .from('product_addon_groups')
      .delete()
      .eq('restaurant_id', access.restaurant_id)
      .eq('product_id', v.product_id)
      .eq('addon_group_id', v.addon_group_id)
      .select('product_id')
      .single();
    return finish(error, 'Group unlinked.');
  }
  if (!v.id) return { error: 'Invalid record.' };
  if (v.entity === 'image') {
    const { data: image } = await client
      .from('product_images')
      .select('id,object_path')
      .eq('restaurant_id', access.restaurant_id)
      .eq('id', v.id)
      .single();
    if (!image) return { error: 'Image unavailable.' };
    const removal = await client.storage.from('menu-images').remove([image.object_path]);
    if (removal.error) return { error: 'Image file could not be removed. Try again.' };
    const { error } = await client
      .from('product_images')
      .delete()
      .eq('restaurant_id', access.restaurant_id)
      .eq('id', image.id)
      .select('id')
      .single();
    return finish(error, 'Image removed.');
  }
  if (v.entity === 'product') {
    const { count, error } = await client
      .from('product_images')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', access.restaurant_id)
      .eq('product_id', v.id);
    if (error || count)
      return { error: 'Remove the dish images first, or mark the dish inactive.' };
  }
  const tables = {
    category: 'categories',
    product: 'products',
    variant: 'product_variants',
    group: 'addon_groups',
    addon: 'addons',
  } as const;
  const { error } = await client
    .from(tables[v.entity])
    .delete()
    .eq('restaurant_id', access.restaurant_id)
    .eq('id', v.id)
    .select('id')
    .single();
  const result = finish(error, 'Record deleted.');
  if (!error && v.entity === 'product') redirect('/admin/menu?notice=dish_deleted');
  return result;
}
