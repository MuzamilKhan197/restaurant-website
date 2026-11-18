import { SiteHeader } from '@/components/customer/site-header';
import { SiteFooter } from '@/components/customer/site-footer';
import { getPublicRestaurant } from '@/features/storefront/data';

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const context = await getPublicRestaurant();
  return (
    <>
      <SiteHeader />
      <div className="border-b bg-orange-50 px-5 py-2 text-center text-[10px] leading-5 text-orange-900">
        {context.state === 'ready' && context.settings?.website_mode === 'normal'
          ? 'Freshly prepared for pickup. Delivery available in selected areas. Cash payments only.'
          : 'Online ordering is currently unavailable. Explore our menu and plan your next visit.'}
      </div>
      <main id="main-content" tabIndex={-1} className="min-h-[65vh] outline-none">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
