import 'server-only';
import { z } from 'zod';

export function getRestaurantId() {
  const value = z.uuid().safeParse(process.env.RESTAURANT_ID);
  return value.success ? value.data : null;
}
export function getAppUrl() {
  const parsed = z.url().parse(process.env.APP_URL);
  const url = new URL(parsed);
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error('APP_URL must be a trusted application origin.');
  return url.origin;
}
