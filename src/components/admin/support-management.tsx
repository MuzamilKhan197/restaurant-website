'use client';
import { useActionState, useState } from 'react';
import { manageTicket } from '@/features/support/actions';
import { statuses, priorities, type SupportState } from '@/features/support/validation';
import { Button } from '@/components/ui/button';
export function SupportManagement({
  id,
  status,
  priority,
  assigned,
  previous,
  assignees,
}: {
  id: string;
  status: string;
  priority: string;
  assigned: string | null;
  previous: string;
  assignees: { id: string; name: string }[];
}) {
  const [draft, setDraft] = useState({ status, priority, assigned_to: assigned || '' }),
    [state, action, pending] = useActionState<SupportState, FormData>(manageTicket, {});
  return (
    <form action={action} className="space-y-4 rounded-xl border bg-card p-5">
      <h2 className="font-semibold">Ticket settings</h2>
      <input name="id" type="hidden" value={id} />
      <input name="previous" type="hidden" value={previous} />
      <fieldset className="space-y-4" disabled={pending}>
        {[
          ['status', 'Status', statuses],
          ['priority', 'Priority', priorities],
        ].map(([name, label, options]) => (
          <label key={String(name)} className="block text-sm">
            {label}
            <select
              name={String(name)}
              value={draft[name as 'status' | 'priority']}
              onChange={(e) => setDraft((d) => ({ ...d, [String(name)]: e.target.value }))}
              className="mt-2 block w-full rounded-lg border bg-background p-3"
            >
              {(options as readonly string[]).map((o) => (
                <option key={o} value={o}>
                  {o.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="block text-sm">
          Assigned to
          <select
            name="assigned_to"
            value={draft.assigned_to}
            onChange={(e) => setDraft((d) => ({ ...d, assigned_to: e.target.value }))}
            className="mt-2 block w-full rounded-lg border bg-background p-3"
          >
            <option value="">Unassigned</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" size="sm">
          {pending ? 'Saving...' : 'Save ticket settings'}
        </Button>
      </fieldset>
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-emerald-700">
          {state.success}
        </p>
      )}
    </form>
  );
}
