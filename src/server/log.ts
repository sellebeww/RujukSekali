// Structured JSON logger with allowlist redaction: only known-safe fields are ever written.
const SAFE_FIELDS = new Set([
  'event',
  'correlationId',
  'zone',
  'entity',
  'entityId',
  'planId',
  'holdId',
  'episodeId',
  'status',
  'from',
  'to',
  'count',
  'durationMs',
  'code',
  'route',
  'method',
  'result',
  'expired',
  'error',
]);

export type LogFields = Record<string, unknown>;

export function redact(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [k, v] of Object.entries(fields)) out[k] = SAFE_FIELDS.has(k) ? v : '[redacted]';
  return out;
}

export interface Logger {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

export function createLogger(
  base: LogFields = {},
  sink: (line: string) => void = (l) => console.log(l),
): Logger {
  const write = (level: string, event: string, fields: LogFields = {}) => {
    if (process.env.LOG_SILENT === '1') return;
    sink(JSON.stringify({ level, at: new Date().toISOString(), ...redact({ ...base, ...fields, event }) }));
  };
  return {
    info: (e, f) => write('info', e, f),
    warn: (e, f) => write('warn', e, f),
    error: (e, f) => write('error', e, f),
  };
}
