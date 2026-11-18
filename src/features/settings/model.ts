import { z } from 'zod';
export const days = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const hoursSchema = z.record(z.enum(days), z.object({ open: time, close: time }).nullable());
export const modes = ['normal', 'orders_paused', 'maintenance'] as const;
export type SettingsResult = { error?: string; success?: string };
