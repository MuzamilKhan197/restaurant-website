'use client';
import { useActionState, useEffect, useState } from 'react';
import {
  readTicket,
  replyTicket,
  uploadTicketFile,
  getTicketFile,
} from '@/features/support/actions';
import type { SupportState, TicketView } from '@/features/support/validation';
import { Button } from '@/components/ui/button';
function fileToken(guest: boolean) {
  return guest ? new URLSearchParams(window.location.hash.slice(1)).get('token') || '' : null;
}
function FileUpload({
  ticket,
  message,
  guest,
  refresh,
}: {
  ticket: string;
  message: string;
  guest: boolean;
  refresh: () => void;
}) {
  const [state, action, pending] = useActionState<SupportState, FormData>(async (prev, form) => {
    form.set('token', fileToken(guest) || '');
    try {
      const result = await uploadTicketFile(prev, form);
      if (result.success) refresh();
      return result;
    } catch {
      return { error: 'Upload interrupted. Please retry.' };
    }
  }, {});
  return (
    <form action={action} className="mt-4 space-y-3 border-t pt-4">
      <input name="ticket_id" type="hidden" value={ticket} />
      <input name="message_id" type="hidden" value={message} />
      <label className="block text-xs">
        Attach evidence (image, PDF or UTF-8 text, up to 5 MB)
        <input
          name="file"
          type="file"
          required
          accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
          disabled={pending}
          className="mt-2 block w-full text-xs"
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? 'Uploading...' : 'Upload file'}
      </Button>
      {state.error && (
        <p role="alert" className="text-xs text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-xs text-emerald-700">
          {state.success}
        </p>
      )}
    </form>
  );
}
function Download({
  ticket,
  id,
  name,
  guest,
}: {
  ticket: string;
  id: string;
  name: string;
  guest: boolean;
}) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [url, setUrl] = useState('');
  async function prepare() {
    setBusy(true);
    setError('');
    try {
      const result = await getTicketFile(ticket, id, fileToken(guest));
      if (result.url) {
        setUrl(result.url);
        window.location.assign(result.url);
      } else setError(result.error || 'Download unavailable.');
    } catch {
      setError('Download unavailable. Please retry.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3 text-xs">
      <button
        type="button"
        disabled={busy}
        onClick={prepare}
        className="break-all text-left underline"
      >
        {busy ? 'Preparing download...' : name}
      </button>
      {url && (
        <a href={url} rel="noreferrer" className="ml-3 underline">
          Download (valid 60 seconds)
        </a>
      )}
      {error && (
        <p role="alert" className="mt-2 text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
export function SupportConversation({
  reference,
  guest = false,
  initial = null,
  staff = false,
  canReply = true,
}: {
  reference: string;
  guest?: boolean;
  initial?: TicketView | null;
  staff?: boolean;
  canReply?: boolean;
}) {
  const [ticket, setTicket] = useState(initial),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(!initial),
    [page, setPage] = useState(1),
    [version, setVersion] = useState(0),
    [body, setBody] = useState(''),
    [internal, setInternal] = useState(false),
    [nonce, setNonce] = useState('');
  const refresh = () => setVersion((v) => v + 1);
  const [state, action, pending] = useActionState<SupportState, FormData>(async (prev, form) => {
    form.set('token', fileToken(guest) || '');
    const requestNonce = nonce || crypto.randomUUID();
    setNonce(requestNonce);
    form.set('nonce', requestNonce);
    try {
      const result = await replyTicket(prev, form);
      if (result.success) {
        setBody('');
        setNonce('');
        setInternal(false);
        setPage(1);
        refresh();
      }
      return result;
    } catch {
      return { error: 'Reply interrupted. Retry the same message to avoid duplicates.' };
    }
  }, {});
  useEffect(() => {
    let active = true,
      inFlight = false;
    async function load() {
      if (inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      try {
        const result = await readTicket(reference, fileToken(guest), page);
        if (!active) return;
        if (result.ticket) {
          setTicket(result.ticket);
          setError('');
        } else {
          setTicket(null);
          setError(result.error || 'Ticket unavailable.');
        }
      } catch {
        if (active) setError('Connection interrupted. Retrying shortly.');
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    }
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [reference, guest, page, version]);
  if (!ticket)
    return (
      <div role={error ? 'alert' : 'status'} className="rounded-xl border bg-card p-8 text-center">
        {loading ? 'Loading your conversation...' : error || 'Ticket unavailable.'}
      </div>
    );
  const closed = ['resolved', 'closed'].includes(ticket.status);
  return (
    <>
      <p className="break-all text-xs text-muted-foreground">{ticket.reference}</p>
      <h1 className="mt-3 font-serif text-4xl">{ticket.subject}</h1>
      <p className="mt-4 text-sm capitalize">
        {ticket.status.replaceAll('_', ' ')} · {ticket.priority} priority ·{' '}
        {ticket.category.replaceAll('_', ' ')}
      </p>
      <p className="mt-3 text-xs leading-6 text-muted-foreground">
        {guest ? 'Keep your private link safe. ' : ''}Updates refresh every 15 seconds. Page {page}{' '}
        of {Math.max(1, Math.ceil(ticket.message_count / 50))}.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-8 space-y-5">
        {ticket.messages.map((message) => (
          <article
            key={message.id}
            className={
              'rounded-xl border p-5 ' +
              (message.is_internal ? 'border-amber-300 bg-amber-50' : 'bg-card')
            }
          >
            <div className="flex flex-wrap justify-between gap-3 text-xs">
              <p className="font-semibold capitalize">
                {message.is_internal
                  ? 'Internal staff note'
                  : message.author_type === 'staff'
                    ? 'Restaurant team'
                    : message.author_type === 'system'
                      ? 'System'
                      : 'Customer'}
              </p>
              <time dateTime={message.created_at} className="text-muted-foreground">
                {new Date(message.created_at).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}
              </time>
            </div>
            <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7">{message.body}</p>
            {message.attachments.map((a) => (
              <Download
                key={a.id}
                ticket={ticket.id}
                id={a.id}
                name={a.filename + ' (' + Math.ceil(a.size_bytes / 1024) + ' KB)'}
                guest={guest}
              />
            ))}
            {message.can_attach && (
              <details className="mt-4 text-xs">
                <summary className="cursor-pointer underline">
                  Add an attachment to this message
                </summary>
                <FileUpload
                  ticket={ticket.id}
                  message={message.id}
                  guest={guest}
                  refresh={refresh}
                />
              </details>
            )}
          </article>
        ))}
      </div>
      <nav aria-label="Conversation pages" className="mt-5 flex justify-center gap-6 text-sm">
        {page > 1 && (
          <button onClick={() => setPage((p) => p - 1)} className="underline">
            Newer messages
          </button>
        )}
        {page * 50 < ticket.message_count && (
          <button onClick={() => setPage((p) => p + 1)} className="underline">
            Older messages
          </button>
        )}
      </nav>
      {closed ? (
        <p className="mt-8 rounded-xl bg-secondary p-5 text-sm">
          This ticket is {ticket.status}. Staff can reopen it if further discussion is needed.
        </p>
      ) : canReply ? (
        <form action={action} className="mt-8 space-y-4 rounded-xl border bg-card p-6">
          <input name="reference" type="hidden" value={reference} />
          <label className="block text-sm">
            {internal ? 'Internal note (visible to staff only)' : 'Your reply'}
            <textarea
              name="body"
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setNonce('');
              }}
              required
              rows={5}
              maxLength={5000}
              disabled={pending}
              className="mt-2 block w-full rounded-lg border bg-background p-3"
            />
          </label>
          {staff && (
            <label className="flex items-center gap-2 text-sm">
              <input
                name="internal"
                type="checkbox"
                checked={internal}
                onChange={(e) => {
                  setInternal(e.target.checked);
                  setNonce('');
                }}
                disabled={pending}
              />
              Internal staff note
            </label>
          )}
          <Button disabled={pending}>
            {pending ? 'Sending...' : internal ? 'Save internal note' : 'Send reply'}
          </Button>
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
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          Reply permission is required to send messages.
        </p>
      )}
    </>
  );
}
