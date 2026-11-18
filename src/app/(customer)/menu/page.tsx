import { requireStorefrontAvailable } from '@/features/storefront/availability';
import Link from 'next/link';
import { DishCard } from '@/components/customer/dish-card';
import { CatalogState } from '@/components/customer/catalog-state';
import { getPublicMenu } from '@/features/storefront/data';
export const metadata = {
  title: 'Our menu',
  description: 'Discover our dishes, sizes and extras.',
};
export const dynamic = 'force-dynamic';
export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const value = (key: string) => (typeof params[key] === 'string' ? (params[key] as string) : '');
  const query = value('q').slice(0, 100),
    category = value('category'),
    vegetarian = value('vegetarian') === '1';
  const page = Math.min(10000, Math.max(1, Number.parseInt(value('page'), 10) || 1));
  await requireStorefrontAvailable();
  const data = await getPublicMenu({ page, query, category, vegetarian });
  const pageLink = (p: number) =>
    '/menu?' +
    new URLSearchParams({ q: query, category, vegetarian: vegetarian ? '1' : '', page: String(p) });
  return (
    <>
      <div className="page-intro">
        <p className="eyebrow">From our kitchen, with love</p>
        <h1>
          A little of <em className="font-normal text-brand-strong">everything.</em>
        </h1>
        <p>Find your favourites. Make room for something new.</p>
      </div>
      <section className="site-container pb-16" aria-label="Restaurant menu">
        {data.state === 'ready' ? (
          <>
            <form className="mb-8 flex flex-wrap gap-3" action="/menu">
              <label className="flex flex-col gap-2 text-xs">
                Search dishes
                <input
                  name="q"
                  defaultValue={query}
                  maxLength={100}
                  placeholder="What are you craving?"
                  className="rounded-lg border bg-card p-3"
                />
              </label>
              <label className="flex flex-col gap-2 text-xs">
                Category
                <select
                  name="category"
                  defaultValue={category}
                  className="rounded-lg border bg-card p-3"
                >
                  <option value="">All categories</option>
                  {data.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 self-end p-3 text-xs">
                <input type="checkbox" name="vegetarian" value="1" defaultChecked={vegetarian} />
                Vegetarian
              </label>
              <button className="self-end rounded-lg bg-primary px-5 py-3 text-sm">
                Find dishes
              </button>
              <Link href="/menu" className="self-end p-3 text-xs underline">
                Clear filters
              </Link>
            </form>
            {data.settings?.website_mode === 'orders_paused' && (
              <p role="status" className="mb-6 rounded-xl bg-secondary p-4 text-sm">
                Online orders are currently paused. You can still explore our menu.
              </p>
            )}
            <p className="mb-5 text-sm text-muted-foreground">{data.count} dishes</p>
            {data.dishes.length ? (
              <div className="grid gap-5 min-[440px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {data.dishes.map((dish) => (
                  <DishCard key={dish.id} dish={dish} />
                ))}
              </div>
            ) : (
              <p className="rounded-xl border p-8 text-center">
                No dishes match your search. Try another category or clear the filters.
              </p>
            )}
            <nav aria-label="Menu pages" className="mt-8 flex items-center justify-center gap-6">
              {page > 1 && (
                <Link className="underline" href={pageLink(page - 1)}>
                  Previous
                </Link>
              )}
              <span className="text-sm">Page {page}</span>
              {page * 24 < data.count && (
                <Link className="underline" href={pageLink(page + 1)}>
                  Next
                </Link>
              )}
            </nav>
          </>
        ) : (
          <CatalogState state={data.state} message={data.settings?.maintenance_message} />
        )}
      </section>
    </>
  );
}
