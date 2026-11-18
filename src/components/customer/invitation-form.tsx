'use client';
import { useActionState, useSyncExternalStore, useState } from 'react';
import { acceptInvitation } from '@/features/auth/staff-actions';
import { tokenSchema } from '@/features/auth/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
function subscribe(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}
function snapshot() {
  const value = new URLSearchParams(window.location.hash.slice(1)).get('token');
  return tokenSchema.safeParse(value).success ? value! : '';
}
export function AcceptInvitationForm() {
  const hashToken = useSyncExternalStore(subscribe, snapshot, () => '');
  const [editedToken, setToken] = useState<string | null>(null);
  const token = editedToken ?? hashToken;
  const [state, action, pending] = useActionState(acceptInvitation, {});
  return (
    <form action={action} className="mt-7 space-y-4">
      <label htmlFor="invite-token" className="block text-xs font-medium">
        Invitation token
      </label>
      <Input
        id="invite-token"
        name="token"
        value={token}
        onChange={(event) => setToken(event.target.value.trim())}
        type="password"
        autoComplete="off"
        maxLength={64}
        required
        placeholder="Open the complete invitation link"
      />
      <p className="text-xs leading-6 text-muted-foreground">
        If you signed in separately, reopen the original invitation link. Use the email address the
        owner invited.
      </p>
      {state.error && (
        <p role="alert" className="text-xs leading-6 text-red-700">
          {state.error}
        </p>
      )}
      <Button className="w-full" disabled={pending || !tokenSchema.safeParse(token).success}>
        {pending ? 'Accepting…' : 'Accept invitation'}
      </Button>
    </form>
  );
}
