import { PARAM_LABELS } from './labels';

export const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const secretKey = (key: string) => /password|passwd|pwd|token|secret|authorization|cookie|apikey|privatekey|credential/i.test(key.replace(/[-_\s]/g, ''));
const redactText = (value: string) => value
  .replace(/\bBearer\s+\S+/gi, 'Bearer [已隐藏]')
  .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, '[已隐藏]')
  .replace(/\bsk-[\w-]{12,}/g, '[已隐藏]')
  .replace(/((?:password|token|secret|api[_-]?key)\s*[:=]\s*)[^\s,;]+/gi, '$1[已隐藏]');
export const text = (value: unknown, limit = 160): string => typeof value === 'string'
  ? redactText(value).replace(/[\r\n\t]+/g, ' ').trim().slice(0, limit) : '';

/** Bound recursion and output size before any renderer or debug view sees a payload. */
export function safeValue(value: unknown): unknown {
  const secrets = new Set<string>();
  const visited = new WeakSet<object>();
  const collect = (item: unknown, depth: number) => {
    if (!item || typeof item !== 'object' || depth > 6 || visited.has(item)) return;
    visited.add(item);
    for (const [key, child] of Object.entries(item).slice(0, 100)) {
      if (secretKey(key) && typeof child === 'string' && child.length >= 3) secrets.add(child);
      else collect(child, depth + 1);
    }
  };
  collect(value, 0);
  const seen = new WeakSet<object>();
  let nodes = 0;
  const clean = (item: unknown, depth: number): unknown => {
    if (++nodes > 600 || depth > 7) return '[内容过长]';
    if (typeof item === 'string') {
      let result = item;
      for (const secret of secrets) result = result.split(secret).join('[已隐藏]');
      return redactText(result).slice(0, 8000);
    }
    if (item === null || typeof item === 'number' || typeof item === 'boolean') return item;
    if (typeof item !== 'object') return undefined;
    if (seen.has(item)) return '[重复引用]';
    seen.add(item);
    if (Array.isArray(item)) return item.slice(0, 100).map(child => clean(child, depth + 1));
    return Object.fromEntries(Object.entries(item).slice(0, 100).map(([key, child]) =>
      [key, secretKey(key) ? '[已隐藏]' : clean(child, depth + 1)]));
  };
  return clean(value, 0);
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return text(value, 1000);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(safeValue(value), null, 2)?.slice(0, 12000) ?? '—';
}

export function safeSummary(input: unknown): { label: string; value: string }[] {
  const params = record(record(input).params ?? input);
  return Object.entries(params).flatMap(([key, value]) => {
    if (!PARAM_LABELS[key] || secretKey(key) || !['string', 'number', 'boolean'].includes(typeof value)) return [];
    return [{ label: PARAM_LABELS[key], value: formatValue(value).replace(/\b(1\d{2})\d{4}(\d{4})\b/g, '$1****$2').slice(0, 120) }];
  }).slice(0, 4);
}

