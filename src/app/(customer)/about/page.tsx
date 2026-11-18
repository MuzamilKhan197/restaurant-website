import { requireStorefrontAvailable } from '@/features/storefront/availability';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Flame, Leaf, Heart, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
export const metadata: Metadata = { title: 'Our story' };

export default async function AboutPage() {
  await requireStorefrontAvailable();
  return (
    <>
      <div className="page-intro">
        <p className="eyebrow">The heart behind the hearth</p>
        <h1>
          Good food.
          <br />
          <em className="font-normal text-brand-strong">Great company.</em>
        </h1>
        <p>A restaurant concept built around the simple pleasure of gathering together.</p>
      </div>
      <div className="site-container">
        <div className="relative h-72 overflow-hidden rounded-2xl sm:h-[420px]">
          <Image
            src="/assets/story.jpg"
            alt="A welcoming dining room with warm light and natural textures"
            fill
            sizes="90vw"
            className="object-cover"
          />
        </div>
        <section className="grid gap-6 py-12 md:grid-cols-[1fr_2fr] sm:py-16">
          <p className="eyebrow pt-3">Our story</p>
          <div>
            <h2 className="editorial-heading text-4xl sm:text-5xl">
              A little spark.
              <br />
              <em className="font-normal text-brand-strong">A lot of heart.</em>
            </h2>
            <p className="mt-6 max-w-xl text-sm leading-8 text-muted-foreground">
              Saffron &amp; Ember is a sample restaurant concept inspired by two things: the warmth
              of a shared table and the flavours that bring people back for another bite.
            </p>
            <p className="mt-4 max-w-xl text-sm leading-8 text-muted-foreground">
              Imagine a kitchen where familiar comfort meets a curious spirit. Vegetables find their
              way to the flame. A simple sauce gets a fresh twist. Every dish has a place in a meal
              worth slowing down for.
            </p>
          </div>
        </section>
      </div>
      <section className="border-y bg-[#e9eddf]">
        <div className="site-container grid gap-8 py-10 md:grid-cols-3 sm:py-14">
          {[
            {
              icon: Leaf,
              title: 'Led by the season',
              copy: 'Fresh produce, bright herbs and ingredients at their best.',
            },
            {
              icon: Flame,
              title: 'Finished with fire',
              copy: 'Charred edges, slow-roasted comfort and the unmistakable flavour of the grill.',
            },
            {
              icon: Heart,
              title: 'Better together',
              copy: 'Plates to pass around, a welcoming table and a little something for every appetite.',
            },
          ].map(({ icon: Icon, title, copy }) => (
            <article key={title}>
              <Icon className="size-7 text-brand-strong" strokeWidth={1.3} />
              <h3 className="mt-5 font-serif text-2xl">{title}</h3>
              <p className="mt-3 max-w-xs text-xs leading-7 text-[#58604c]">{copy}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="site-container py-14 text-center sm:py-20">
        <h2 className="editorial-heading text-4xl">
          There’s a place
          <br />
          for you <em className="font-normal text-brand-strong">here.</em>
        </h2>
        <Button asChild className="mt-7">
          <Link href="/menu">
            Find your favourite <ArrowUpRight />
          </Link>
        </Button>
        <p className="mt-6 text-[10px] text-muted-foreground">
          Story, imagery and business identity are illustrative sample content.
        </p>
      </section>
    </>
  );
}
