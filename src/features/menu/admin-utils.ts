export function minorInput(value: number) {
  return (value / 100).toFixed(2);
}
export function toDraft(record: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      Array.isArray(value)
        ? value.join(', ')
        : typeof value === 'boolean'
          ? value
            ? 'on'
            : ''
          : value == null
            ? ''
            : String(value),
    ]),
  );
}
