import { requireStorefrontAvailable } from '@/features/storefront/availability';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Flame, Leaf, Sparkles, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DishCard } from '@/components/customer/dish-card';
import { getPublicMenu } from '@/features/storefront/data';
import { CatalogState } from '@/components/customer/catalog-state';

export const dynamic = 'force-dynamic';
export default async function HomePage() {
  await requireStorefrontAvailable();
  let catalog = await getPublicMenu({ featured: true });
  if (catalog.state === 'ready' && !catalog.dishes.length) catalog = await getPublicMenu();
  return (
    <>
      <section className="site-container grid items-center gap-10 pb-14 pt-10 lg:grid-cols-[1fr_1fr] lg:gap-16 lg:pb-20 lg:pt-14">
        <div>
          <p className="eyebrow flex items-center gap-2 text-[9px]">
            <span className="size-1.5 rounded-full bg-primary" /> Fresh ingredients. Honest
            flavours.
          </p>
          <h1 className="editorial-heading mt-6 text-[60px] min-[430px]:text-7xl lg:text-[88px]">
            Food made
            <br />
            with <em className="font-normal text-brand-strong">feeling.</em>
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-7 text-muted-foreground">
            A little fire, a little soul, and something delicious to share. Settle in for good food
            and even better company.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <Button asChild size="lg">
              <Link href="/menu">
                Explore our menu <ArrowUpRight className="ml-3" />
              </Link>
            </Button>
            <Link href="/about" className="text-link">
              A taste of our story <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-10 flex items-center gap-5 text-[10px] leading-5 text-muted-foreground sm:mt-12">
            <Leaf className="size-8 shrink-0 text-[#697358]" strokeWidth={1} />
            <p>
              Seasonal by nature.
              <br />
              <span className="text-foreground">Thoughtful by choice.</span>
            </p>
            <span className="h-8 w-px bg-border" />
            <p>
              Made fresh.
              <br />
              <span className="text-foreground">Meant to be shared.</span>
            </p>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-xl pb-5">
          <div className="relative h-[390px] overflow-hidden rounded-t-[240px] rounded-b-2xl sm:h-[470px] lg:h-[520px]">
            <Image
              src="/assets/hero.jpg"
              alt="A beautifully set table and a freshly prepared dish in a warm restaurant"
              fill
              priority
              sizes="(max-width: 1024px) 90vw, 50vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
            <p className="absolute bottom-7 w-full px-5 text-center text-[9px] tracking-[.25em] text-white">
              PULL UP A CHAIR. STAY A WHILE.
            </p>
          </div>
          <div className="absolute right-0 top-6 flex size-24 rotate-12 flex-col items-center justify-center gap-1 rounded-full border border-[#d9d0b7] bg-[#f0ebd9] text-[8px] font-medium tracking-widest shadow-sm sm:-right-3">
            <span>FRESH FROM</span>
            <Flame className="size-7 text-brand-strong" strokeWidth={1.4} />
            <span>THE HEART</span>
          </div>
          <div className="absolute bottom-0 left-0 flex items-center gap-3 rounded-xl border bg-card px-5 py-4 shadow-sm sm:-left-5">
            <Sparkles className="size-6 text-brand-strong" strokeWidth={1.3} />
            <div>
              <p className="text-xs font-semibold">Come hungry. Leave happy.</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                There’s always room at our table.
              </p>
            </div>
          </div>
        </div>
      </section>
      <div className="border-y border-[#dce2d1] bg-[#e9eddf]">
        <div className="site-container grid grid-cols-2 items-center gap-4 py-5 text-center text-[10px] font-medium text-[#3f4d36] sm:flex sm:justify-between">
          {[
            'Fresh, seasonal ingredients',
            'Flame-kissed favourites',
            'Something for everyone',
            'Made with a little love',
          ].map((item) => (
            <span key={item} className="flex items-center justify-center gap-3">
              <Sparkles className="hidden size-3 opacity-50 lg:block" />
              {item}
            </span>
          ))}
        </div>
      </div>
      <section className="site-container py-14 sm:py-20">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">A taste of what we do</p>
            <h2 className="editorial-heading mt-3 text-4xl sm:text-[45px]">
              Your next <em className="font-normal text-brand-strong">favourite.</em>
            </h2>
          </div>
          <Link href="/menu" className="text-link w-fit pb-1">
            Discover the full menu <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <div className="grid gap-5 min-[440px]:grid-cols-2 lg:grid-cols-4">
          {catalog.dishes.slice(0, 4).map((dish) => (
            <DishCard key={dish.id} dish={dish} />
          ))}
        </div>
        {!catalog.dishes.length && (
          <CatalogState state={catalog.state} message={catalog.settings?.maintenance_message} />
        )}
        <p className="mt-6 text-[10px] leading-6 text-muted-foreground">
          Discuss allergies with restaurant staff before ordering. Atmosphere photographs are
          illustrative.
        </p>
      </section>
      <section className="site-container grid items-center gap-9 pb-16 md:grid-cols-2 lg:gap-20">
        <div className="relative h-80 overflow-hidden rounded-2xl rounded-tr-[100px] sm:h-[420px]">
          <Image
            src="/assets/story.jpg"
            alt="An inviting restaurant interior with warm natural textures"
            fill
            sizes="(max-width: 768px) 90vw, 45vw"
            className="object-cover brightness-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <p className="absolute bottom-7 left-7 font-serif text-3xl leading-snug text-white">
            Good things happen
            <br />
            <em>around a table.</em>
          </p>
        </div>
        <div>
          <p className="eyebrow">A kitchen with a little soul</p>
          <h2 className="editorial-heading mt-4 text-4xl sm:text-5xl">
            More than a meal.
            <br />
            <em className="font-normal text-brand-strong">A moment.</em>
          </h2>
          <p className="mt-6 text-sm leading-7 text-muted-foreground">
            The best meals aren’t just about what’s on the plate. They’re about the conversations,
            the laughter, and that one extra bite you couldn’t resist.
          </p>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Our restaurant concept brings together comforting favourites and fresh ideas, with
            seasonal ingredients and the warmth of an open flame.
          </p>
          <Link href="/about" className="text-link mt-6">
            Get to know us <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>
      <section className="site-container pb-16 sm:pb-20">
        <div className="relative flex flex-col justify-between gap-7 overflow-hidden rounded-2xl bg-[#253b31] p-8 text-[#faf7f2] sm:p-12 md:flex-row md:items-center">
          <UtensilsCrossed
            className="absolute -right-8 -top-10 size-72 -rotate-12 text-white/[.025]"
            strokeWidth={0.8}
          />
          <div className="relative">
            <p className="eyebrow text-[#d0d8c4]">Make some time for good food</p>
            <h2 className="editorial-heading mt-4 text-4xl sm:text-5xl">
              A little something
              <br />
              for <em className="font-normal text-[#e9c99c]">every appetite.</em>
            </h2>
            <p className="mt-4 text-xs text-white/75">
              Comforting favourites. Fresh discoveries. Room for dessert.
            </p>
          </div>
          <Button
            asChild
            variant="secondary"
            size="lg"
            className="relative w-fit bg-[#efe7d6] text-[#253b31] hover:bg-white"
          >
            <Link href="/menu">
              Find your favourite <ArrowUpRight className="ml-3" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
