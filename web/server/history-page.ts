export const historyPageSize = 20;
export const historyPayloadLimit = 131_072;
export const invalidHistoryCursor = 'Cursor del historial inválido.';

export type HistoryCursor = { createdAt: string; id: string };
export type StoredHistoryRow = HistoryCursor & { quote: unknown; totalCents: number | null };
export type StoredHistoryPage = { quotes: StoredHistoryRow[]; nextCursor: string | null };

// Keep this wire format in sync with QuoteHistory.cs and the Python API.
const isoUtc = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;
const quoteId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function decodeHistoryCursor(value: string): HistoryCursor | null {
  if (!/^v1\.[A-Za-z0-9_-]{82}$/.test(value) || value.length !== 85) return null;
  const encoded = value.slice(3);
  const bytes = Buffer.from(encoded, 'base64url');
  if (bytes.toString('base64url') !== encoded || bytes.length !== 61) return null;
  const [createdAt, id] = bytes.toString('utf8').split('|');
  if (!isoUtc.test(createdAt) || !id || !quoteId.test(id)) return null;
  const timestamp = new Date(createdAt);
  if (Number.isNaN(timestamp.getTime()) || timestamp.toISOString() !== createdAt || createdAt.startsWith('0000')) return null;
  return { createdAt, id };
}

export function readHistoryCursor(values: string[]): HistoryCursor | null {
  if (!values.length) return null;
  const result = values.length === 1 ? decodeHistoryCursor(values[0]) : null;
  if (!result) throw new TypeError(invalidHistoryCursor);
  return result;
}

export function encodeHistoryCursor({ createdAt, id }: HistoryCursor): string {
  return 'v1.' + Buffer.from(createdAt + '|' + id, 'utf8').toString('base64url');
}

export function parseStoredHistoryPayload(payload: unknown): Record<string, unknown> | null {
  if (typeof payload !== 'string') return null;
  try {
    const value: unknown = JSON.parse(payload);
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
