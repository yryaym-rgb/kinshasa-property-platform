/**
 * Structured JSON logger for Edge Functions.
 *
 * Every line is a single JSON object so Supabase log drains / Logflare can
 * index it. Sensitive fields are redacted automatically.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL: LogLevel = (Deno.env.get('LOG_LEVEL') as LogLevel | undefined) ?? 'info';

const SENSITIVE_KEYS = /^(authorization|apikey|api_key|apisecret|api_secret|secret|token|access_token|refresh_token|pin|password|signature|x-signature|webhooksecret)$/i;

export function redact<T>(value: T, depth = 0): T {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEYS.test(k) ? '[REDACTED]' : redact(v, depth + 1);
  }
  return out as T;
}

export interface LogContext {
  fn: string;
  requestId: string;
  paymentId?: string;
  provider?: string;
  userId?: string;
  [key: string]: unknown;
}

export class Logger {
  private readonly context: LogContext;
  private readonly startedAt = performance.now();

  constructor(context: LogContext) {
    this.context = context;
  }

  get requestId(): string {
    return this.context.requestId;
  }

  child(extra: Partial<LogContext>): Logger {
    return new Logger({ ...this.context, ...extra });
  }

  private emit(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;
    const line = {
      ts: new Date().toISOString(),
      level,
      msg: message,
      ...redact(this.context),
      ...(data ? redact(data) : {}),
      elapsedMs: Math.round(performance.now() - this.startedAt),
    };
    const serialized = JSON.stringify(line);
    if (level === 'error') console.error(serialized);
    else if (level === 'warn') console.warn(serialized);
    else console.log(serialized);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.emit('debug', message, data);
  }
  info(message: string, data?: Record<string, unknown>): void {
    this.emit('info', message, data);
  }
  warn(message: string, data?: Record<string, unknown>): void {
    this.emit('warn', message, data);
  }
  error(message: string, error?: unknown, data?: Record<string, unknown>): void {
    this.emit('error', message, {
      ...data,
      error: serializeError(error),
    });
  }
}

export function serializeError(error: unknown): Record<string, unknown> | undefined {
  if (!error) return undefined;
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack?.split('\n').slice(0, 5).join('\n') };
  }
  if (typeof error === 'object') return redact(error as Record<string, unknown>);
  return { message: String(error) };
}

export function newRequestId(): string {
  return crypto.randomUUID();
}

export function createLogger(fn: string, req?: Request, extra?: Partial<LogContext>): Logger {
  const requestId = req?.headers.get('x-request-id') ?? newRequestId();
  return new Logger({ fn, requestId, ...extra });
}
