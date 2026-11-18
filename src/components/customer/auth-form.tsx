'use client';
import { useActionState, useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { login, register, requestPasswordReset, resetPassword } from '@/features/auth/actions';
import type { AuthMode, AuthState } from '@/features/auth/types';

const actions = { login, register, forgot: requestPasswordReset, reset: resetPassword };
const labels = {
  login: 'Sign in',
  register: 'Create account',
  forgot: 'Send reset link',
  reset: 'Save new password',
};
export function AuthForm({
  mode,
  next = '/account',
  configured,
  notice,
  canonicalOrigin,
}: {
  mode: AuthMode;
  next?: string;
  configured: boolean;
  notice?: string;
  canonicalOrigin?: string;
}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(actions[mode], {});
  const [visible, setVisible] = useState(false);
  const passwordRequired = mode !== 'forgot';
  useEffect(() => {
    // Next.js normalizes loopback hosts in server redirects. A browser navigation
    // preserves the configured origin so PKCE email links find the same cookies.
    if (canonicalOrigin && window.location.origin !== canonicalOrigin) {
      const target = new URL(canonicalOrigin);
      target.pathname = window.location.pathname;
      target.search = window.location.search;
      target.hash = window.location.hash;
      window.location.replace(target.href);
    }
  }, [canonicalOrigin]);
  return (
    <form action={action} className="mt-7 space-y-5">
      <input type="hidden" name="next" value={next} />
      {!configured && (
        <p className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-xs leading-6">
          Account services need a Supabase connection.{' '}
          <Link href="/setup" className="underline">
            View setup status
          </Link>
          .
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-secondary p-4 text-xs leading-6">
          {notice}
        </p>
      )}
      {mode === 'register' && (
        <div>
          <label htmlFor="name" className="mb-2 block text-xs font-medium">
            Your name
          </label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            maxLength={100}
            required
            placeholder="How should we call you?"
          />
        </div>
      )}
      {mode !== 'reset' && (
        <div>
          <label htmlFor="email" className="mb-2 block text-xs font-medium">
            Email address
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            placeholder="you@example.com"
          />
        </div>
      )}
      {passwordRequired && (
        <div>
          <label htmlFor="password" className="mb-2 block text-xs font-medium">
            {mode === 'reset' ? 'New password' : 'Password'}
          </label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={visible ? 'text' : 'password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'login' ? 1 : 12}
              maxLength={128}
              required
              className="pr-12"
              aria-describedby={mode !== 'login' ? 'password-help' : undefined}
            />
            <button
              type="button"
              onClick={() => setVisible(!visible)}
              aria-label={visible ? 'Hide password' : 'Show password'}
              className="absolute right-1 top-1 rounded-md p-2 text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary"
            >
              {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {mode !== 'login' && (
            <p id="password-help" className="mt-2 text-[11px] text-muted-foreground">
              Use 12–128 characters. A long, unique passphrase works well.
            </p>
          )}
        </div>
      )}
      {(mode === 'register' || mode === 'reset') && (
        <div>
          <label htmlFor="confirmPassword" className="mb-2 block text-xs font-medium">
            Confirm password
          </label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={visible ? 'text' : 'password'}
            autoComplete="new-password"
            required
            maxLength={128}
          />
        </div>
      )}
      {mode === 'login' && (
        <div className="text-right">
          <Link href="/forgot-password" className="text-xs text-brand-strong hover:underline">
            Forgot your password?
          </Link>
        </div>
      )}
      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800"
        >
          {state.error}
        </p>
      )}
      {state.success && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-6 text-emerald-900"
        >
          {state.success}
        </p>
      )}
      <Button
        type="submit"
        className="w-full"
        disabled={pending || !configured || Boolean(state.success)}
      >
        {pending ? (
          <>
            <LoaderCircle className="animate-spin" /> Please wait…
          </>
        ) : (
          <>
            {labels[mode]} <ArrowRight />
          </>
        )}
      </Button>
      <p className="text-center text-xs leading-6 text-muted-foreground">
        {mode === 'login' ? (
          <>
            New to our table?{' '}
            <Link href="/register" className="font-medium text-brand-strong hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-brand-strong hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
