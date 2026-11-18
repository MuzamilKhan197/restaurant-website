import Link from 'next/link';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { Plus, UtensilsCrossed, ArrowRight } from 'lucide-react';
import { requireStaff } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';
import { minorInput, toDraft } from '@/features/menu/admin-utils';
import { MenuForm, DeleteMenuForm } from '@/components/admin/menu-form';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PublicationForm } from '@/components/admin/publication-form';
export const metadata = { title: 'Menu management' };
export const dynamic = 'force-dynamic';
export default async function MenuManagement({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const access = await requireStaff();
  if (!access.permissions.some((p) => ['menu.read', 'menu.manage'].includes(p)))
    redirect('/access-denied');
  const canEdit = access.permissions.includes('menu.manage');
  const client = await createClient();
  const params = await searchParams;
  const restaurant = access.is_owner
    ? await client
        .from('restaurants')
        .select('is_published')
        .eq('id', access.restaurant_id)
        .single()
    : null;
  if (restaurant?.error) throw new Error('Unable to load restaurant publication.');
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.page || '1', 10) || 1));
  const q = (params.q || '').slice(0, 100).trim();
  let dishesQuery = client
    .from('products')
    .select('id,name,base_price_minor,category_id,is_active,is_available,is_featured', {
      count: 'exact',
    })
    .eq('restaurant_id', access.restaurant_id)
    .order('sort_order')
    .order('id')
    .range((page - 1) * 30, page * 30 - 1);
  if (q) dishesQuery = dishesQuery.ilike('name', '%' + q.replace(/[\\%_]/g, '\\$&') + '%');
  const category = z.uuid().safeParse(params.category);
  if (category.success) dishesQuery = dishesQuery.eq('category_id', category.data);
  const [categories, products, groups, addons] = await Promise.all([
    client
      .from('categories')
      .select('*')
      .eq('restaurant_id', access.restaurant_id)
      .order('sort_order')
      .order('name'),
    dishesQuery,
    client.from('addon_groups').select('*').eq('restaurant_id', access.restaurant_id).order('name'),
    client.from('addons').select('*').eq('restaurant_id', access.restaurant_id).order('name'),
  ]);
  if ([categories, products, groups, addons].some((result) => result.error))
    throw new Error('Unable to load your menu. Please retry.');
  const categoryChoices = categories.data || [];
  const href = (next: number) =>
    '/admin/menu?' +
    new URLSearchParams({
      page: String(next),
      q,
      ...(category.success ? { category: category.data } : {}),
    }).toString();
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-[9px]">From your kitchen to their table</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            A menu worth coming back for.
          </h1>
          <p className="mt-3 max-w-2xl text-xs leading-6 text-muted-foreground">
            Manage dishes, categories and extras. Published active dishes appear on your customer
            website.
          </p>
        </div>
        <Badge variant="outline">Live database</Badge>
      </div>
      {access.is_owner && restaurant?.data && (
        <PublicationForm published={restaurant.data.is_published} />
      )}
      <div className="mt-7 grid grid-cols-3 gap-4">
        {[
          ['Matching dishes', products.count || 0],
          ['Categories', categoryChoices.length],
          ['Add-on groups', groups.data?.length || 0],
        ].map(([label, count]) => (
          <Card key={label}>
            <CardContent className="p-4 sm:p-6">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className="mt-3 text-2xl font-semibold">{count}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {canEdit && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm">
              <Plus className="mr-2 inline size-4" />
              Add to your menu
            </CardTitle>
            <CardDescription className="text-xs">
              Create a category first, then a dish. Open its editor to add photographs, sizes and
              extras.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <details className="rounded-xl border p-4">
              <summary className="cursor-pointer text-xs font-medium">New category</summary>
              <div className="mt-5">
                <MenuForm kind="category" prefix="new-category" />
              </div>
            </details>
            <details className="rounded-xl border p-4">
              <summary className="cursor-pointer text-xs font-medium">New dish</summary>
              <div className="mt-5">
                {!categoryChoices.length && (
                  <p className="mb-4 text-xs text-muted-foreground">
                    Create your first category to add dishes.
                  </p>
                )}
                <MenuForm kind="product" categories={categoryChoices} prefix="new-dish" />
              </div>
            </details>
          </CardContent>
        </Card>
      )}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm">Your dishes</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="mb-6 flex flex-wrap gap-3">
            <Input
              name="q"
              aria-label="Search dishes"
              placeholder="Search dishes…"
              defaultValue={q}
              className="sm:max-w-xs"
            />
            <select
              name="category"
              aria-label="Filter by category"
              defaultValue={category.success ? category.data : ''}
              className="h-10 rounded-md border bg-background px-3 text-xs"
            >
              <option value="">All categories</option>
              {categoryChoices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button size="sm" variant="outline">
              Filter
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/admin/menu">Reset</Link>
            </Button>
          </form>
          {!products.data?.length ? (
            <div className="rounded-xl border border-dashed px-6 py-12 text-center">
              <UtensilsCrossed className="mx-auto size-7 text-slate-400" />
              <p className="mt-4 text-sm font-medium">
                {q || category.success
                  ? 'No dishes match these filters.'
                  : 'Your first dish starts here.'}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {q || category.success
                  ? 'Reset the filters or try another name.'
                  : 'Add a category and dish above. No sample dishes are inserted automatically.'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {products.data.map((dish) => (
                <div
                  key={dish.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-4"
                >
                  <div>
                    <Link
                      href={'/admin/menu/' + dish.id}
                      className="text-sm font-semibold hover:text-blue-600"
                    >
                      {dish.name}
                    </Link>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {categoryChoices.find((c) => c.id === dish.category_id)?.name} · PKR{' '}
                      {minorInput(dish.base_price_minor)}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Badge variant="outline">{dish.is_active ? 'Active' : 'Inactive'}</Badge>
                      <Badge variant="outline">
                        {dish.is_available ? 'Available' : 'Sold out'}
                      </Badge>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={'/admin/menu/' + dish.id}>
                      {canEdit ? 'Edit dish' : 'View dish'}
                      <ArrowRight />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Page {page} · {products.count || 0} results
            </span>
            <div className="flex gap-3">
              {page > 1 && (
                <Link className="underline" href={href(page - 1)}>
                  Previous
                </Link>
              )}
              {page * 30 < (products.count || 0) && (
                <Link className="underline" href={href(page + 1)}>
                  Next
                </Link>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="mt-6 grid items-start gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Categories</CardTitle>
            <CardDescription className="text-xs">
              Display order controls menu organization. Deactivate a category to hide its dishes
              from future public reads.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!categoryChoices.length && (
              <p className="text-xs text-muted-foreground">No categories yet.</p>
            )}
            {categoryChoices.map((c) => (
              <details key={c.id} className="rounded-xl border p-4">
                <summary className="cursor-pointer text-xs font-medium">
                  {c.name}{' '}
                  <span className="ml-2 text-muted-foreground">
                    #{c.sort_order} · {c.is_active ? 'Active' : 'Inactive'}
                  </span>
                </summary>
                {canEdit && (
                  <div className="mt-5">
                    <MenuForm kind="category" initial={toDraft(c)} prefix={c.id} />
                    <DeleteMenuForm entity="category" id={c.id} />
                  </div>
                )}
              </details>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Reusable add-on groups</CardTitle>
            <CardDescription className="text-xs">
              Create extras once, then link them to individual dishes in the dish editor. Prices are
              in PKR.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canEdit && (
              <details className="rounded-xl border border-blue-200 bg-blue-50/30 p-4">
                <summary className="cursor-pointer text-xs font-medium">New add-on group</summary>
                <div className="mt-5">
                  <MenuForm kind="group" prefix="new-group" />
                </div>
              </details>
            )}
            {!groups.data?.length && (
              <p className="text-xs text-muted-foreground">No add-on groups yet.</p>
            )}
            {groups.data?.map((group) => (
              <details key={group.id} className="rounded-xl border p-4">
                <summary className="cursor-pointer text-xs font-medium">
                  {group.name}{' '}
                  <span className="ml-2 text-muted-foreground">
                    {group.min_selections}–{group.max_selections} choices
                  </span>
                </summary>
                <div className="mt-5 space-y-6">
                  {canEdit && (
                    <>
                      <MenuForm kind="group" prefix={group.id} initial={toDraft(group)} />
                      <DeleteMenuForm entity="group" id={group.id} />
                    </>
                  )}
                  {addons.data
                    ?.filter((addon) => addon.addon_group_id === group.id)
                    .map((addon) => (
                      <div key={addon.id} className="border-t pt-4">
                        <p className="mb-4 text-xs font-semibold">
                          {addon.name} · PKR {minorInput(addon.price_minor)}
                        </p>
                        {canEdit && (
                          <>
                            <MenuForm
                              kind="addon"
                              prefix={addon.id}
                              hidden={{ addon_group_id: group.id }}
                              initial={{ ...toDraft(addon), price: minorInput(addon.price_minor) }}
                            />
                            <DeleteMenuForm entity="addon" id={addon.id} />
                          </>
                        )}
                      </div>
                    ))}
                  {canEdit && (
                    <details className="rounded-lg bg-secondary/50 p-4">
                      <summary className="cursor-pointer text-xs font-medium">Add an extra</summary>
                      <div className="mt-4">
                        <MenuForm
                          kind="addon"
                          prefix={'new-addon-' + group.id}
                          hidden={{ addon_group_id: group.id }}
                        />
                      </div>
                    </details>
                  )}
                </div>
              </details>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
