import Link from 'next/link';
import Image from 'next/image';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { ArrowLeft, ImagePlus } from 'lucide-react';
import { requireStaff } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';
import { MenuForm, DeleteMenuForm } from '@/components/admin/menu-form';
import { minorInput, toDraft } from '@/features/menu/admin-utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
export const metadata = { title: 'Dish editor' };
export const dynamic = 'force-dynamic';
export default async function DishEditor({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireStaff();
  if (!access.permissions.some((p) => ['menu.read', 'menu.manage'].includes(p)))
    redirect('/access-denied');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const client = await createClient();
  const tenant = access.restaurant_id;
  const canEdit = access.permissions.includes('menu.manage');
  const [product, categories, variants, images, groups, links] = await Promise.all([
    client.from('products').select('*').eq('restaurant_id', tenant).eq('id', id).maybeSingle(),
    client.from('categories').select('id,name').eq('restaurant_id', tenant).order('sort_order'),
    client
      .from('product_variants')
      .select('*')
      .eq('restaurant_id', tenant)
      .eq('product_id', id)
      .order('sort_order')
      .order('name'),
    client
      .from('product_images')
      .select('*')
      .eq('restaurant_id', tenant)
      .eq('product_id', id)
      .order('sort_order')
      .order('created_at'),
    client.from('addon_groups').select('*').eq('restaurant_id', tenant).order('name'),
    client
      .from('product_addon_groups')
      .select('*')
      .eq('restaurant_id', tenant)
      .eq('product_id', id)
      .order('sort_order'),
  ]);
  if ([product, categories, variants, images, groups, links].some((result) => result.error))
    throw new Error('Unable to load this dish. Please retry.');
  if (!product.data) notFound();
  const signed = images.data?.length
    ? await client.storage.from('menu-images').createSignedUrls(
        images.data.map((image) => image.object_path),
        180,
      )
    : null;
  const dish = product.data;
  return (
    <>
      <Link
        href="/admin/menu"
        className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-blue-600"
      >
        <ArrowLeft className="size-3.5" />
        Back to menu
      </Link>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-[9px]">Dish editor</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{dish.name}</h1>
          <p className="mt-3 text-xs leading-6 text-muted-foreground">
            Keep the details, photographs, sizes and extras in one place. Existing order prices
            remain unchanged.
          </p>
        </div>
        <Badge variant="outline">{canEdit ? 'Menu manager' : 'Read-only access'}</Badge>
      </div>
      <div className="mt-7 grid items-start gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Dish details</CardTitle>
              <CardDescription className="text-xs">
                Inactive dishes are hidden. Sold-out dishes can still be displayed with their
                availability.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {canEdit ? (
                <MenuForm
                  kind="product"
                  prefix={id}
                  categories={categories.data || []}
                  initial={{ ...toDraft(dish), price: minorInput(dish.base_price_minor) }}
                />
              ) : (
                <dl className="space-y-4 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Description</dt>
                    <dd className="mt-1 leading-6">{dish.description || 'No description'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Base price</dt>
                    <dd className="mt-1">PKR {minorInput(dish.base_price_minor)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Allergens</dt>
                    <dd className="mt-1">{dish.allergens.join(', ') || 'Not specified'}</dd>
                  </div>
                </dl>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Photographs</CardTitle>
              <CardDescription className="text-xs leading-6">
                Private Storage with short-lived previews. JPEG, PNG or WebP up to 5 MiB. Lower
                display order appears first.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {signed?.error && (
                <p role="alert" className="text-xs text-red-700">
                  Image previews could not load. Refresh to try again.
                </p>
              )}
              {!images.data?.length && (
                <div className="rounded-xl border border-dashed p-7 text-center">
                  <ImagePlus className="mx-auto size-6 text-slate-400" />
                  <p className="mt-3 text-xs text-muted-foreground">No photographs yet.</p>
                </div>
              )}
              {images.data?.map((image) => {
                const url = signed?.data?.find(
                  (entry) => entry.path === image.object_path,
                )?.signedUrl;
                return (
                  <div key={image.id} className="rounded-xl border p-4">
                    {url ? (
                      <Image
                        src={url}
                        alt={image.alt_text}
                        width={600}
                        height={380}
                        unoptimized
                        className="mb-4 aspect-[3/2] w-full rounded-lg object-cover"
                      />
                    ) : (
                      <p className="mb-4 text-xs text-muted-foreground">
                        Preview unavailable · {image.alt_text}
                      </p>
                    )}
                    {canEdit ? (
                      <>
                        <MenuForm
                          kind="image_meta"
                          prefix={image.id}
                          hidden={{ product_id: id }}
                          initial={toDraft(image)}
                        />
                        <DeleteMenuForm entity="image" id={image.id} label="Remove photograph" />
                      </>
                    ) : (
                      <p className="text-xs">{image.alt_text}</p>
                    )}
                  </div>
                );
              })}
              {canEdit && (
                <details className="rounded-xl bg-secondary/40 p-4">
                  <summary className="cursor-pointer text-xs font-medium">
                    Upload a photograph
                  </summary>
                  <div className="mt-5">
                    <MenuForm kind="image" prefix="new-image" hidden={{ product_id: id }} />
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Sizes &amp; variants</CardTitle>
              <CardDescription className="text-xs leading-6">
                Variant prices are full item prices, not surcharges. Choosing a new default replaces
                the old default atomically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!variants.data?.length && (
                <p className="text-xs text-muted-foreground">
                  No variants. The base dish price applies.
                </p>
              )}
              {variants.data?.map((variant) => (
                <details key={variant.id} className="rounded-xl border p-4">
                  <summary className="cursor-pointer text-xs font-medium">
                    {variant.name} · PKR {minorInput(variant.price_minor)}{' '}
                    <span className="ml-2 text-muted-foreground">
                      {variant.is_default ? 'Default' : !variant.is_active ? 'Inactive' : ''}
                    </span>
                  </summary>
                  {canEdit && (
                    <div className="mt-5">
                      <MenuForm
                        kind="variant"
                        prefix={variant.id}
                        hidden={{ product_id: id }}
                        initial={{ ...toDraft(variant), price: minorInput(variant.price_minor) }}
                      />
                      <DeleteMenuForm entity="variant" id={variant.id} />
                    </div>
                  )}
                </details>
              ))}
              {canEdit && (
                <details className="rounded-xl border border-blue-200 bg-blue-50/30 p-4">
                  <summary className="cursor-pointer text-xs font-medium">New variant</summary>
                  <div className="mt-5">
                    <MenuForm kind="variant" prefix="new-variant" hidden={{ product_id: id }} />
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Linked add-on groups</CardTitle>
              <CardDescription className="text-xs leading-6">
                Create reusable extras on the menu page, then choose which groups belong to this
                dish.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!links.data?.length && (
                <p className="text-xs text-muted-foreground">No add-on groups linked.</p>
              )}
              {links.data?.map((link) => {
                const group = groups.data?.find((group) => group.id === link.addon_group_id);
                return (
                  <div key={link.addon_group_id} className="rounded-xl border p-4">
                    <p className="text-xs font-medium">{group?.name || 'Group unavailable'}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {group?.min_selections}–{group?.max_selections} choices · Order{' '}
                      {link.sort_order} · {group?.is_active ? 'Active' : 'Inactive'}
                    </p>
                    {canEdit && (
                      <DeleteMenuForm
                        entity="link"
                        productId={id}
                        groupId={link.addon_group_id}
                        label="Unlink group"
                      />
                    )}
                  </div>
                );
              })}
              {canEdit && (
                <details className="rounded-xl bg-secondary/40 p-4">
                  <summary className="cursor-pointer text-xs font-medium">
                    Link or reorder an add-on group
                  </summary>
                  <div className="mt-5">
                    <MenuForm
                      kind="link"
                      prefix="link-group"
                      hidden={{ product_id: id }}
                      groups={groups.data || []}
                    />
                  </div>
                </details>
              )}
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/menu">Manage reusable extras</Link>
              </Button>
            </CardContent>
          </Card>
          {canEdit && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Remove an unused dish</CardTitle>
                <CardDescription className="text-xs leading-6">
                  Dishes used in past orders cannot be deleted. Mark them inactive instead. Remove
                  photographs before deleting an unused dish.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DeleteMenuForm entity="product" id={id} label="Delete unused dish" />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
