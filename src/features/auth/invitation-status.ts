// Display status only; PostgreSQL rechecks expiry when an invitation is accepted.
export function invitationStatus(invitation: {
  accepted_at: string | null;
  revoked_at: string | null;
  expires_at: string;
}) {
  if (invitation.accepted_at) return 'Accepted';
  if (invitation.revoked_at) return 'Revoked';
  return Date.parse(invitation.expires_at) <= Date.now() ? 'Expired' : 'Pending';
}
