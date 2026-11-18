import 'server-only';
import { redirect } from 'next/navigation';
import { getPublicRestaurant } from './data';

export async function requireStorefrontAvailable() {
  const context = await getPublicRestaurant();
  if (context.state === 'maintenance') redirect('/maintenance');
  return context;
}
