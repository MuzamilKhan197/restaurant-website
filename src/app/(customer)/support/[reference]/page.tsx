import { SupportConversation } from '@/components/customer/support-conversation';
export const metadata = {
  title: 'Private support ticket',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';
export default async function GuestSupport({ params }: { params: Promise<{ reference: string }> }) {
  return (
    <section className="site-container max-w-3xl py-14">
      <SupportConversation reference={(await params).reference} guest />
    </section>
  );
}
