'use client';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  saveCategory,
  saveProduct,
  saveVariant,
  saveGroup,
  saveAddon,
  linkGroup,
  uploadImage,
  saveImageMetadata,
  deleteMenuRecord,
} from '@/features/menu/actions';
import type { MenuFormKind, MenuState, Choice } from '@/features/menu/admin-types';

type Field = {
  name: string;
  label: string;
  type?: 'number' | 'checkbox' | 'textarea' | 'select' | 'file';
  options?: Choice[];
  hint?: string;
  required?: boolean;
  max?: number;
};
const actions = {
  category: saveCategory,
  product: saveProduct,
  variant: saveVariant,
  group: saveGroup,
  addon: saveAddon,
  link: linkGroup,
  image: uploadImage,
  image_meta: saveImageMetadata,
};
const base: Field[] = [
  { name: 'name', label: 'Name', required: true, max: 100 },
  {
    name: 'slug',
    label: 'URL slug',
    required: true,
    max: 100,
    hint: 'Lowercase letters, numbers and hyphens.',
  },
  {
    name: 'sort_order',
    label: 'Display order',
    type: 'number',
    hint: 'Lower numbers appear first.',
  },
  { name: 'is_active', label: 'Active', type: 'checkbox' },
];
const price: Field = {
  name: 'price',
  label: 'Price (PKR)',
  required: true,
  hint: 'Use rupees, up to two decimal places.',
};
const active: Field = { name: 'is_active', label: 'Active', type: 'checkbox' };
function feedback(state: MenuState) {
  return (
    <>
      {state.error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-xs leading-6 text-red-800">
          {state.error}
        </p>
      )}
      {state.success && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs leading-6 text-emerald-800"
        >
          {state.success}
          {state.href && (
            <>
              {' '}
              <Link className="font-semibold underline" href={state.href}>
                Open dish editor
              </Link>
            </>
          )}
        </p>
      )}
    </>
  );
}
export function MenuForm(props: Parameters<typeof MenuFormFields>[0]) {
  // Refresh drafts when a saved server record changes, including another
  // variant losing its default flag. Failed validation leaves the key unchanged.
  return (
    <MenuFormFields
      key={JSON.stringify({ initial: props.initial, hidden: props.hidden })}
      {...props}
    />
  );
}
function MenuFormFields({
  kind,
  initial = {},
  hidden = {},
  categories = [],
  groups = [],
  prefix,
}: {
  kind: MenuFormKind;
  initial?: Record<string, string>;
  hidden?: Record<string, string>;
  categories?: Choice[];
  groups?: Choice[];
  prefix: string;
}) {
  const [state, action, pending] = useActionState<MenuState, FormData>(actions[kind], {});
  const [draft, setDraft] = useState<Record<string, string>>({
    sort_order: '0',
    min_selections: '0',
    max_selections: '1',
    is_active: 'on',
    is_available: 'on',
    ...initial,
  });
  const fields: Field[] =
    kind === 'category'
      ? base
      : kind === 'product'
        ? [
            {
              name: 'category_id',
              label: 'Category',
              type: 'select',
              options: categories,
              required: true,
            },
            ...base.slice(0, 2),
            { name: 'description', label: 'Description', type: 'textarea', max: 2000 },
            price,
            {
              name: 'allergens',
              label: 'Allergens',
              hint: 'Separate with commas, for example: Milk, Wheat.',
              max: 500,
            },
            base[2],
            active,
            { name: 'is_available', label: 'Available to order', type: 'checkbox' },
            { name: 'is_featured', label: 'Featured dish', type: 'checkbox' },
          ]
        : kind === 'variant'
          ? [
              { name: 'name', label: 'Variant name', required: true, max: 80 },
              price,
              base[2],
              active,
              { name: 'is_default', label: 'Default size / variant', type: 'checkbox' },
            ]
          : kind === 'group'
            ? [
                base[0],
                { name: 'min_selections', label: 'Minimum choices', type: 'number' },
                { name: 'max_selections', label: 'Maximum choices', type: 'number' },
                active,
              ]
            : kind === 'addon'
              ? [base[0], price, { name: 'is_available', label: 'Available', type: 'checkbox' }]
              : kind === 'link'
                ? [
                    {
                      name: 'addon_group_id',
                      label: 'Add-on group',
                      type: 'select',
                      options: groups,
                      required: true,
                    },
                    base[2],
                  ]
                : [
                    ...(kind === 'image'
                      ? [
                          {
                            name: 'file',
                            label: 'Food photograph',
                            type: 'file',
                            required: true,
                            hint: 'JPEG, PNG or WebP. Maximum 5 MiB.',
                          } as Field,
                        ]
                      : []),
                    {
                      name: 'alt_text',
                      label: 'Image description',
                      required: true,
                      max: 200,
                      hint: 'Describe the dish for people using screen readers.',
                    },
                    base[2],
                  ];
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={initial.id || ''} />
      {Object.entries(hidden).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const id = prefix + '-' + field.name;
          const change = (value: string) => setDraft((d) => ({ ...d, [field.name]: value }));
          return (
            <div key={id} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
              {field.type === 'checkbox' ? (
                <label className="flex min-h-10 items-center gap-2 text-xs">
                  <input
                    name={field.name}
                    type="checkbox"
                    checked={draft[field.name] === 'on'}
                    onChange={(event) => change(event.target.checked ? 'on' : '')}
                    className="size-4 accent-blue-600"
                  />
                  {field.label}
                </label>
              ) : (
                <>
                  <label htmlFor={id} className="mb-2 block text-xs font-medium">
                    {field.label}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      id={id}
                      name={field.name}
                      required={field.required}
                      value={draft[field.name] || ''}
                      onChange={(event) => change(event.target.value)}
                      className="h-10 w-full rounded-md border bg-background px-3 text-xs"
                    >
                      <option value="">Choose an option</option>
                      {field.options?.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      id={id}
                      name={field.name}
                      value={draft[field.name] || ''}
                      onChange={(event) => change(event.target.value)}
                      maxLength={field.max}
                      rows={3}
                      className="w-full rounded-md border bg-background p-3 text-xs focus:outline-2 focus:outline-ring"
                    />
                  ) : field.type === 'file' ? (
                    <Input
                      id={id}
                      name="file"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      required
                    />
                  ) : (
                    <Input
                      id={id}
                      name={field.name}
                      type={field.type === 'number' ? 'number' : 'text'}
                      inputMode={field.name === 'price' ? 'decimal' : undefined}
                      value={draft[field.name] || ''}
                      onChange={(event) => change(event.target.value)}
                      required={field.required}
                      maxLength={field.max}
                      min={field.type === 'number' ? 0 : undefined}
                      max={
                        field.name === 'max_selections' || field.name === 'min_selections'
                          ? 20
                          : field.type === 'number'
                            ? 10000
                            : undefined
                      }
                      step={field.type === 'number' ? 1 : undefined}
                    />
                  )}
                  {field.hint && (
                    <p className="mt-1.5 text-[10px] leading-5 text-muted-foreground">
                      {field.hint}
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      {kind === 'product' && (
        <fieldset>
          <legend className="mb-3 text-xs font-medium">Dietary labels</legend>
          <div className="flex flex-wrap gap-4">
            {['vegetarian', 'vegan', 'gluten_free', 'signature'].map((label) => (
              <label key={label} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  name="dietary_labels"
                  value={label}
                  checked={(draft.dietary_labels || '')
                    .split(',')
                    .map((s) => s.trim())
                    .includes(label)}
                  onChange={(event) =>
                    setDraft((d) => {
                      const values = (d.dietary_labels || '')
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .filter((v) => v !== label);
                      if (event.target.checked) values.push(label);
                      return { ...d, dietary_labels: values.join(',') };
                    })
                  }
                  className="accent-blue-600"
                />
                {label.replaceAll('_', ' ')}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <Button
        size="sm"
        disabled={
          pending ||
          (kind === 'product' && !categories.length) ||
          (kind === 'link' && !groups.length)
        }
      >
        {pending
          ? 'Saving…'
          : kind === 'image'
            ? 'Upload image'
            : kind === 'link'
              ? 'Link group'
              : 'Save ' +
                (kind === 'image_meta' ? 'image details' : kind === 'product' ? 'dish' : kind)}
      </Button>
      {feedback(state)}
    </form>
  );
}
export function DeleteMenuForm({
  entity,
  id,
  productId,
  groupId,
  label = 'Delete unused record',
}: {
  entity: string;
  id?: string;
  productId?: string;
  groupId?: string;
  label?: string;
}) {
  const [state, action, pending] = useActionState(deleteMenuRecord, {});
  return (
    <form action={action} className="mt-4 border-t pt-4">
      <input name="entity" type="hidden" value={entity} />
      <input name="id" type="hidden" value={id || ''} />
      <input name="product_id" type="hidden" value={productId || ''} />
      <input name="addon_group_id" type="hidden" value={groupId || ''} />
      <Button variant="outline" size="sm" disabled={pending} className="text-red-700">
        {pending ? 'Removing…' : label}
      </Button>
      {feedback(state)}
    </form>
  );
}
