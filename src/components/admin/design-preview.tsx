'use client';
import { useState } from 'react';
import { ArrowUpRight, Check, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogTrigger,
} from '@/components/ui/dialog';

export function DesignPreview() {
  const [checked, setChecked] = useState(false);
  const [value, setValue] = useState('');
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Actions &amp; interaction states</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => setChecked(!checked)}>
              {checked ? (
                <>
                  <Check />
                  Selected
                </>
              ) : (
                <>
                  Primary action
                  <ArrowUpRight />
                </>
              )}
            </Button>
            <Button variant="outline">Secondary</Button>
            <Button variant="ghost">Quiet action</Button>
            <Button disabled>Unavailable</Button>
            <Button disabled variant="outline">
              <LoaderCircle className="animate-spin motion-reduce:animate-none" />
              Saving…
            </Button>
          </div>
          <p role="status" className="mt-5 text-xs text-muted-foreground">
            {checked
              ? 'The example selection is active.'
              : 'Choose the primary action to test its selected state.'}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Inputs &amp; accessible focus</CardTitle>
        </CardHeader>
        <CardContent>
          <label htmlFor="sample-input" className="text-xs font-medium">
            Example field
          </label>
          <Input
            id="sample-input"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Try the shared input…"
            className="mt-2"
            aria-describedby="sample-input-hint"
          />
          <p id="sample-input-hint" className="mt-3 text-xs text-muted-foreground">
            Local interaction only. This value is not saved or submitted.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Status language</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Badge>In progress</Badge>
          <Badge variant="success">Ready</Badge>
          <Badge variant="secondary">Upcoming</Badge>
          <Badge variant="outline">Not connected</Badge>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Accessible modal</CardTitle>
        </CardHeader>
        <CardContent>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                Open example dialog <ArrowUpRight />
              </Button>
            </DialogTrigger>
            <DialogContent className="admin-theme">
              <DialogTitle>A thoughtful little detail.</DialogTitle>
              <DialogDescription>
                Focus stays inside this dialog. Escape or Close returns you to the trigger. This is
                a component example, not a transaction.
              </DialogDescription>
              <DialogClose asChild>
                <Button className="w-fit">
                  Got it <Check />
                </Button>
              </DialogClose>
            </DialogContent>
          </Dialog>
          <p className="mt-4 text-xs leading-6 text-muted-foreground">
            Shared Radix-based primitives follow the shadcn/ui component structure.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
