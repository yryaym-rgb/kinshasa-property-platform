/**
 * Authentication, authorisation, CORS and HTTP helpers for Edge Functions.
 */

import { ALLOWED_ORIGINS, INTERNAL_FUNCTION_SECRET } from './env.ts';
import { serviceClient, userClient, type DbClient } from './db.ts';

export type UserRole = 'bailleur' | 'locataire' | 'agence' | 'admin' | 'agent_fiscal' | 'gestionnaire';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  phone: string | null;
  email: string | null;
  fullName: string;
  bailleurId: string | null;
  jwt: string;
  /** RLS-scoped client for reads on behalf of the caller. */
  client: DbClient;
}

// ─── Errors ────────────────────────────────────────────────────────────────

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  constructor(status: number, code: string, message?: string, details?: unknown) {
    super(message ?? code);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const unauthorized = (msg = 'Authentification requise') => new HttpError(401, 'unauthorized', msg);
export const forbidden = (msg = 'Accès refusé') => new HttpError(403, 'forbidden', msg);
export const notFound = (code = 'payment_not_found', msg = 'Ressource introuvable') => new HttpError(404, code, msg);
export const badRequest = (code: string, msg: string, details?: unknown) => new HttpError(400, code, msg, details);
export const conflict = (code: string, msg: string) => new HttpError(409, code, msg);
export const unprocessable = (code: string, msg: string, details?: unknown) => new HttpError(422, code, msg, details);
export const tooManyRequests = (msg = 'Trop de requêtes') => new HttpError(429, 'rate_limited', msg);
export const badGateway = (code: string, msg: string, details?: unknown) => new HttpError(502, code, msg, details);

// ─── CORS ──────────────────────────────────────────────────────────────────

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowAll = ALLOWED_ORIGINS.includes('*');
  const allowed = allowAll || ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': allowAll ? '*' : allowed ? origin : ALLOWED_ORIGINS[0] ?? '',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-request-id, x-idempotency-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function handlePreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders(req) });
  }
  return null;
}

export function requireMethod(req: Request, method: 'POST' | 'GET'): void {
  if (req.method !== method) {
    throw new HttpError(405, 'method_not_allowed', `Méthode ${req.method} non autorisée`);
  }
}

// ─── Responses ─────────────────────────────────────────────────────────────

export function json(req: Request, body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(req), ...extraHeaders },
  });
}

export function errorResponse(req: Request, error: unknown, requestId: string): Response {
  if (error instanceof HttpError) {
    return json(req, { error: { code: error.code, message: error.message, details: error.details, requestId } }, error.status);
  }
  const err = error as { code?: string; message?: string; name?: string };
  if (err?.name === 'ZodError') {
    return json(req, { error: { code: 'validation_failed', message: 'Données invalides', details: err, requestId } }, 422);
  }
  if (err?.name === 'DbError' && err.code && err.code !== 'db_error') {
    const status = err.code === 'payment_not_found' ? 404 : 409;
    return json(req, { error: { code: err.code, message: err.message, requestId } }, status);
  }
  return json(req, { error: { code: 'unknown', message: 'Erreur interne', requestId } }, 500);
}

// ─── JWT auth ──────────────────────────────────────────────────────────────

export function extractBearer(req: Request): string | null {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

/**
 * Validates the JWT with Supabase Auth and loads the profile row (role lives
 * in `public.users.role`, never in user_metadata).
 */
export async function authenticate(req: Request): Promise<AuthenticatedUser> {
  const jwt = extractBearer(req);
  if (!jwt) throw unauthorized();

  const client = userClient(jwt);
  const { data: authData, error: authError } = await client.auth.getUser(jwt);
  if (authError || !authData?.user) throw unauthorized('Session invalide ou expirée');

  const db = serviceClient();
  const { data: profile, error: profileError } = await db
    .from('users')
    .select('id, role, phone, email, full_name, is_active, bailleurs(id)')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError || !profile) throw unauthorized('Profil utilisateur introuvable');
  if (profile.is_active === false) throw forbidden('Compte désactivé');

  const bailleurs = profile.bailleurs as { id: string }[] | { id: string } | null;
  const bailleurId = Array.isArray(bailleurs) ? bailleurs[0]?.id ?? null : bailleurs?.id ?? null;

  return {
    id: profile.id as string,
    role: profile.role as UserRole,
    phone: (profile.phone as string) ?? null,
    email: (profile.email as string) ?? null,
    fullName: profile.full_name as string,
    bailleurId,
    jwt,
    client,
  };
}

export function requireRole(user: AuthenticatedUser, roles: UserRole[]): void {
  if (!roles.includes(user.role)) throw forbidden();
}

export const STAFF_ROLES: UserRole[] = ['admin', 'agent_fiscal', 'gestionnaire', 'agence'];

export function isStaff(user: AuthenticatedUser): boolean {
  return STAFF_ROLES.includes(user.role);
}

/**
 * Internal calls between functions (payment-webhook → tax-calculate) carry a
 * shared secret instead of a user JWT.
 */
export function isInternalCall(req: Request): boolean {
  const header = req.headers.get('x-internal-secret');
  return Boolean(INTERNAL_FUNCTION_SECRET) && header === INTERNAL_FUNCTION_SECRET;
}

// ─── Request metadata ──────────────────────────────────────────────────────

export function clientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() ?? null;
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? null;
}

export function userAgent(req: Request): string | null {
  return req.headers.get('user-agent');
}

export async function readJson<T = unknown>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw badRequest('invalid_json', 'Corps de requête JSON invalide');
  }
}
