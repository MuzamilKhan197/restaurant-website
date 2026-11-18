import { OrderTracker } from '@/components/customer/order-tracker';
export const metadata = { title: 'Track your order', robots: { index: false, follow: false } };
export default async function TrackPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  return (
    <section className="site-container max-w-3xl py-14">
      <OrderTracker reference={reference} />
    </section>
  );
}
