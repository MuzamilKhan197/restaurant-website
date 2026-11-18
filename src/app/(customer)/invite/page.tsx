import { requireUser } from '@/features/auth/session';
import { AcceptInvitationForm } from '@/components/customer/invitation-form';
export const metadata = { title: 'Join the restaurant team' };
export const dynamic = 'force-dynamic';
export default async function InvitePage() {
  await requireUser('/invite');
  return (
    <section className="site-container max-w-lg py-20">
      <p className="eyebrow text-brand-strong">A warm welcome to the team</p>
      <h1 className="mt-4 font-display text-4xl">Your place behind the scenes.</h1>
      <p className="mt-5 text-sm leading-7 text-muted-foreground">
        Accept the owner’s invitation to join the restaurant workspace.
      </p>
      <AcceptInvitationForm />
    </section>
  );
}
