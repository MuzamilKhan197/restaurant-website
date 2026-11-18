import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Clock, MessageSquare, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { requireStorefrontAvailable } from '@/features/storefront/availability';
import { days, hoursSchema } from '@/features/settings/model';
import { z } from 'zod';
export const metadata: Metadata = { title: 'Visit us' };

export default async function ContactPage() {
  const { restaurant, settings } = await requireStorefrontAvailable();
  if (restaurant && settings) {
    const address = z.object({ line: z.string() }).safeParse(settings.address).data?.line;
    const hours = hoursSchema.safeParse(settings.opening_hours).data;
    return (
      <section className="site-container max-w-4xl space-y-6 py-16">
        <h1 className="font-serif text-4xl">Visit {restaurant.name}</h1>
        <div className="grid gap-5 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Contact details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {address && <p>{address}</p>}
              {settings.contact_email && <p className="break-all">{settings.contact_email}</p>}
              {settings.contact_phone && <p>{settings.contact_phone}</p>}
              {!address && !settings.contact_email && !settings.contact_phone && (
                <p>Contact details will be posted here.</p>
              )}
              <Link className="inline-block underline" href="/support/new">
                Contact support
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Opening hours</CardTitle>
              <CardDescription>{restaurant.timezone}</CardDescription>
            </CardHeader>
            <CardContent>
              {hours ? (
                <dl className="space-y-2 text-sm">
                  {days.map((day) => (
                    <div key={day} className="flex justify-between gap-3">
                      <dt>{day}</dt>
                      <dd>{hours[day] ? hours[day].open + '–' + hours[day].close : 'Closed'}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm">Opening hours are being confirmed.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }
  return (
    <>
      <div className="page-intro">
        <p className="eyebrow">Come say hello</p>
        <h1>
          Find your way
          <br />
          to <em className="font-normal text-brand-strong">something good.</em>
        </h1>
        <p>
          A question, a celebration, or just a little curiosity. There’s always a reason to connect.
        </p>
      </div>
      <section className="site-container grid gap-6 pb-16 md:grid-cols-2">
        <Card>
          <CardHeader>
            <MapPin className="mb-3 size-6 text-brand-strong" />
            <CardTitle className="font-serif text-3xl font-normal">
              A little corner of Lahore.
            </CardTitle>
            <CardDescription>Lahore, Pakistan · sample location</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-7 text-muted-foreground">
              The actual street address, contact details and operating hours will be added when the
              restaurant is configured. This sample site does not represent an operating business.
            </p>
            <Button asChild variant="outline" className="mt-6">
              <a
                href="https://www.openstreetmap.org/search?query=Lahore%2C%20Pakistan"
                target="_blank"
                rel="noopener noreferrer"
              >
                Explore the sample city <ArrowUpRight />
              </a>
            </Button>
          </CardContent>
        </Card>
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Clock className="size-5 text-brand-strong" />
                <CardTitle>Plan your visit</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-7 text-muted-foreground">
                Business hours are not confirmed in this foundation version. Please check back once
                the restaurant setup is complete.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <MessageSquare className="size-5 text-brand-strong" />
                <CardTitle>A little help?</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-7 text-muted-foreground">
                Find answers about this restaurant concept and what’s available in the current
                version.
              </p>
              <Link href="/support/new" className="text-link mt-4">
                Create a support ticket <ArrowUpRight className="size-4" />
              </Link>
              <Link href="/help" className="text-link mt-4">
                Visit the help center <ArrowUpRight className="size-4" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
