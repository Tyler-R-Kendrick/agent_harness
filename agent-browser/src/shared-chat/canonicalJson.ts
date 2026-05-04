function serialize(value: unknown): string {
  if (value === null) return 'null';
  const kind = typeof value;
  if (kind === 'string') return JSON.stringify(value);
  if (kind === 'boolean') return value ? 'true' : 'false';
  if (kind === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical JSON rejects non-finite numbers.');
    return JSON.stringify(value);
  }
  if (kind === 'undefined' || kind === 'function' || kind === 'symbol' || kind === 'bigint') {
    throw new TypeError(`Canonical JSON rejects ${kind}.`);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => serialize(entry)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort((left, right) => left.localeCompare(right));
  return `{${keys.map((key) => `${JSON.stringify(key)}:${serialize(record[key])}`).join(',')}}`;
}

export function canonicalJson(value: unknown): string {
  return serialize(value);
}

export function withoutSignature<T extends { signature?: unknown }>(value: T): Omit<T, 'signature'> {
  const { signature: _signature, ...unsigned } = value;
  void _signature;
  return unsigned;
}
