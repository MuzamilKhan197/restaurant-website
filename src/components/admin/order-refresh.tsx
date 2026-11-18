'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
export function OrderRefresh({ restaurantId }: { restaurantId: string }) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible' && !document.querySelector('form :focus'))
        router.refresh();
    };
    const client = createClient(),
      channel = client
        .channel('restaurant-orders-' + restaurantId)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'order_status_events',
            filter: 'restaurant_id=eq.' + restaurantId,
          },
          refresh,
        )
        .subscribe();
    const timer = setInterval(refresh, 15000);
    return () => {
      clearInterval(timer);
      void client.removeChannel(channel);
    };
  }, [router, restaurantId]);
  return (
    <p className="text-xs text-muted-foreground">
      Live order updates with a 15-second refresh fallback. Refresh pauses while editing.
    </p>
  );
}
