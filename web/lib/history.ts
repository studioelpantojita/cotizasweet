import {quoteSchema, type SavedQuote} from './quote';

export type HistoryEntry =
  | {kind: 'current'; id: string; saved: SavedQuote}
  | {kind: 'legacy'; id: string; client: string; issued: string | null};

export type HistoryPage = {entries: HistoryEntry[]; nextCursor: string | null};

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function parseHistoryRow(value: unknown): HistoryEntry | null {
  const row = asObject(value);
  if (!row || typeof row.id !== 'string' || !row.id || row.id.length > 128) return null;
  const id = row.id;
  const parsed = quoteSchema.safeParse(row.quote);
  if (parsed.success && typeof row.createdAt === 'string' &&
      typeof row.totalCents === 'number' && Number.isSafeInteger(row.totalCents) && row.totalCents >= 0) {
    return {kind:'current', id, saved:{id, quote:parsed.data, totalCents:row.totalCents, createdAt:row.createdAt}};
  }

  const payload = asObject(row.quote);
  const client = typeof payload?.client === 'string' ? payload.client.trim().slice(0, 160) : '';
  const stored = typeof row.createdAt === 'string' ? row.createdAt.slice(0, 10) : '';
  const issued = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(stored) && Number.isFinite(Date.parse(stored)) ? stored : null;
  return {kind:'legacy', id, client:client || 'Propuesta guardada', issued};
}

export function parseHistoryPage(value: unknown): HistoryPage {
  const page = asObject(value);
  if (!page || !Array.isArray(page.quotes)) {
    throw new Error('No se pudo cargar el historial.');
  }
  // API 2.1 returns at most 200 rows and omits the pagination field.
  const paginated = Object.hasOwn(page, 'nextCursor');
  const nextCursor = paginated ? page.nextCursor : null;
  if (page.quotes.length > (paginated ? 20 : 200) ||
      (nextCursor !== null && (typeof nextCursor !== 'string' || !/^v1\.[A-Za-z0-9_-]{82}$/.test(nextCursor)))) {
    throw new Error('No se pudo cargar el historial.');
  }
  const entries: HistoryEntry[] = [];
  for (const row of page.quotes) {
    const entry = parseHistoryRow(row);
    if (entry) entries.push(entry);
  }
  return {entries:mergeHistoryEntries([], entries),nextCursor};
}

export function mergeHistoryEntries(current: HistoryEntry[], page: HistoryEntry[]): HistoryEntry[] {
  const ids = new Set(current.map(entry=>entry.id));
  const merged = [...current];
  for (const entry of page) {
    if (ids.has(entry.id)) continue;
    ids.add(entry.id);
    merged.push(entry);
  }
  return merged;
}
