import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, LifeBuoy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
export const metadata: Metadata = { title: 'Help center' };
const questions = [
  [
    'Is this a real restaurant?',
    'Saffron & Ember is currently a sample restaurant project. Business identity, photographs and menu prices are illustrative. No live restaurant is accepting orders through this new storefront.',
  ],
  [
    'How do I place an order?',
    'Choose dishes, sizes and extras from the menu, add them to your cart, select pickup or an available delivery area, review the final total and place your cash order. If ordering is paused or the restaurant is unpublished, new orders are unavailable.',
  ],
  [
    'Do I need an account to order?',
    'Guest checkout is supported. Save your private tracking link after ordering. Registered customers can access their account order history, saved addresses and support tickets.',
  ],
  [
    'Which payment methods are supported?',
    'Cash on Delivery is available for delivery orders and Pay at Pickup for pickup orders. Online payments are reserved for a later version.',
  ],
  [
    'How do I check allergens?',
    'Each dish page lists its declared allergens and dietary labels. A shared kitchen cannot guarantee an allergen-free meal. Confirm all dietary requirements with restaurant staff before ordering.',
  ],
  [
    'Can I contact customer support?',
    'Create a private support ticket for questions, complaints, delivery issues or cancellation requests. For an order problem, open support from your account order or private tracking page. You can reply and attach images, PDFs or text files up to 5 MB. A support request does not automatically cancel an order.',
  ],
];
export default function HelpPage() {
  return (
    <>
      <div className="page-intro">
        <p className="eyebrow">Good to know</p>
        <h1>
          A few little <em className="font-normal text-brand-strong">answers.</em>
        </h1>
        <p>Before you settle in, here are the essentials.</p>
      </div>
      <section className="site-container max-w-4xl pb-16">
        <div className="divide-y border-y">
          {questions.map(([question, answer]) => (
            <details key={question} className="group py-6">
              <summary className="text-sm font-semibold sm:text-base">{question}</summary>
              <p className="mt-4 max-w-2xl text-sm leading-8 text-muted-foreground">{answer}</p>
            </details>
          ))}
        </div>
        <Card className="mt-9 bg-secondary/50">
          <CardContent className="flex flex-col items-start justify-between gap-5 p-6 sm:flex-row sm:items-center">
            <div className="flex items-start gap-4">
              <LifeBuoy className="mt-1 size-5 shrink-0 text-brand-strong" />
              <div>
                <h2 className="text-sm font-semibold">A little more about us.</h2>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">
                  Get to know the idea behind our table.
                </p>
              </div>
            </div>
            <Link href="/support/new" className="text-link shrink-0">
              Contact support <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
