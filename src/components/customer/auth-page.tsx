import { ShieldCheck, UtensilsCrossed } from 'lucide-react';
import { AuthForm } from './auth-form';
import { getSupabaseConfig } from '@/lib/supabase/config';
import type { AuthMode } from '@/features/auth/types';
import { getAppUrl } from '@/features/auth/config';
const copy = {
  login: ['Welcome back.', 'Good food. Familiar faces. Sign in to your account.'],
  register: [
    'A seat at our table.',
    'Create your account for a more personal restaurant experience.',
  ],
  forgot: ['Let’s get you back in.', 'Enter your email and we’ll help you reset your password.'],
  reset: ['A fresh start.', 'Choose a new password to secure your account.'],
};
export function AuthPage({
  mode,
  next,
  notice,
}: {
  mode: AuthMode;
  next?: string;
  notice?: string;
}) {
  let canonicalOrigin: string | undefined;
  try {
    canonicalOrigin = getAppUrl();
  } catch {
    /* Setup remains available without auth configuration. */
  }
  return (
    <section className="site-container grid gap-8 py-12 md:min-h-[700px] md:grid-cols-2 md:items-center md:gap-20 md:py-20">
      <div className="hidden rounded-[2rem] bg-[#253b31] p-12 text-white md:block">
        <UtensilsCrossed className="mb-16 size-9 text-orange-300" strokeWidth={1.4} />
        <p className="eyebrow text-orange-200">Good things happen around a table</p>
        <h2 className="mt-6 font-display text-5xl leading-tight">
          Your favourites.
          <br />
          <span className="italic text-orange-200">A little closer.</span>
        </h2>
        <p className="mt-6 max-w-sm text-sm leading-7 text-white/70">
          A warm welcome, thoughtfully prepared food and an account that feels like home.
        </p>
        <p className="mt-16 flex items-center gap-2 text-[11px] text-white/65">
          <ShieldCheck className="size-4" /> Your account stays private and secure.
        </p>
      </div>
      <div className="mx-auto w-full max-w-md">
        <p className="eyebrow text-brand-strong">Saffron &amp; Ember</p>
        <h1 className="mt-4 font-display text-4xl sm:text-5xl">{copy[mode][0]}</h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">{copy[mode][1]}</p>
        <AuthForm
          canonicalOrigin={canonicalOrigin}
          mode={mode}
          next={next}
          notice={notice}
          configured={Boolean(getSupabaseConfig() && canonicalOrigin)}
        />
      </div>
    </section>
  );
}
