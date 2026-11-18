import { requireStorefrontAvailable } from '@/features/storefront/availability';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicDish } from '@/features/storefront/data';
import { CatalogState } from '@/components/customer/catalog-state';
import { DishOptions } from '@/components/customer/dish-options';
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const data = await getPublicDish((await params).id);
  return { title: data.dish?.name || 'Our menu' };
}
export default async function DishPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStorefrontAvailable();
  const data = await getPublicDish((await params).id);
  if (data.state !== 'ready')
    return (
      <section className="site-container py-16">
        <CatalogState state={data.state} message={data.settings?.maintenance_message} />
      </section>
    );
  if (!data.dish) notFound();
  const dish = data.dish;
  return (
    <section className="site-container py-12">
      <Link href="/menu" className="text-sm underline">
        Back to the menu
      </Link>
      <div className="mt-8 grid gap-10 md:grid-cols-2">
        <div>
          {data.images.length ? (
            data.images.map((image, index) => (
              <div
                key={image.object_path}
                className="relative mb-4 aspect-square overflow-hidden rounded-2xl bg-secondary"
              >
                {image.url ? (
                  <Image
                    src={image.url}
                    alt={image.alt_text || dish.name}
                    fill
                    unoptimized
                    priority={index === 0}
                    sizes="(max-width:768px) 90vw, 45vw"
                    className="object-cover"
                  />
                ) : (
                  <p className="p-8">Photo unavailable</p>
                )}
              </div>
            ))
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              Photo coming soon
            </div>
          )}
        </div>
        <div>
          <h1 className="font-serif text-5xl">{dish.name}</h1>
          <p className="mt-5 text-sm leading-7 text-muted-foreground">{dish.description}</p>
          <p className="mt-4 text-xs">{dish.dietary_labels.join(' · ')}</p>
          <DishOptions
            productId={dish.id}
            name={dish.name}
            ordering={data.settings?.website_mode === 'normal'}
            basePrice={dish.base_price_minor}
            currency={data.restaurant!.currency}
            variants={data.variants}
            groups={data.groups}
            available={dish.is_available}
          />
          <div className="mt-8 border-t pt-5">
            <h2 className="font-semibold">Allergen information</h2>
            <p className="mt-3 text-sm">
              {dish.allergens.join(', ') || 'Please ask restaurant staff.'}
            </p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              Prepared in a shared kitchen. Discuss dietary requirements with staff before ordering.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
