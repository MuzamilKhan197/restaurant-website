'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { getAppUrl } from './config';
import { loginSchema, registrationSchema, emailSchema, resetSchema, safeNext } from './validation';
import { requireUser } from './session';
import type { AuthState } from './types';

const unavailable: AuthState = {
  error: 'Account services are unavailable. Please try again later.',
};
export async function login(_state: AuthState, form: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Enter a valid email and password.' };
  try {
    if (!getSupabaseConfig()) return unavailable;
    const client = await createClient();
    const { error, data } = await client.auth.signInWithPassword(parsed.data);
    if (error || !data.user?.email_confirmed_at || data.user.is_anonymous)
      return { error: 'Unable to sign in. Check your details and confirm your email.' };
  } catch {
    return unavailable;
  }
  redirect(safeNext(form.get('next')));
}
export async function register(_state: AuthState, form: FormData): Promise<AuthState> {
  const parsed = registrationSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Check your details.' };
  try {
    if (!getSupabaseConfig()) return unavailable;
    const client = await createClient();
    const { error } = await client.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.name },
        emailRedirectTo: `${getAppUrl()}/auth/callback`,
      },
    });
    if (error) return unavailable;
    return {
      success:
        'Check your inbox to confirm your email. If this address already has an account, sign in or reset your password.',
    };
  } catch {
    return unavailable;
  }
}
export async function requestPasswordReset(_state: AuthState, form: FormData): Promise<AuthState> {
  const parsed = emailSchema.safeParse(form.get('email'));
  if (!parsed.success) return { error: 'Enter a valid email address.' };
  try {
    if (!getSupabaseConfig()) return unavailable;
    const client = await createClient();
    const { error } = await client.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${getAppUrl()}/auth/callback?next=/reset-password`,
    });
    if (error) return unavailable;
    return {
      success:
        'If an account exists for this address, a password reset email is on its way. Check your spam folder too.',
    };
  } catch {
    return unavailable;
  }
}
export async function resetPassword(_state: AuthState, form: FormData): Promise<AuthState> {
  await requireUser('/account');
  const parsed = resetSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Check your password.' };
  try {
    const client = await createClient();
    const { error } = await client.auth.updateUser({ password: parsed.data.password });
    if (error)
      return {
        error: 'Unable to update your password. Request a fresh recovery link and try again.',
      };
    await client.auth.signOut({ scope: 'global' });
  } catch {
    return unavailable;
  }
  redirect('/login?notice=password_updated');
}
export async function logout() {
  const client = await createClient();
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) redirect('/account?notice=signout_failed');
  revalidatePath('/', 'layout');
  redirect('/login?notice=signed_out');
}
