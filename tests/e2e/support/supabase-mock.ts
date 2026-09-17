import type { Page, Route } from '@playwright/test';

/**
 * In-memory stand-in for the two Supabase services the auth flow talks to:
 * GoTrue (`/auth/v1`) and PostgREST (`/rest/v1`), plus Storage uploads.
 *
 * It speaks exactly the JSON shapes supabase-js expects, so the application
 * code runs unmodified — only the network is replaced. Every error case the
 * suite exercises (duplicate phone, wrong / expired OTP, bad credentials,
 * duplicate email) mirrors the real GoTrue response for that situation.
 */

export const OTP_CODE = '123456';

interface MockUser {
  id: string;
  phone: string;
  email: string | null;
  password: string;
  metadata: Record<string, unknown>;
  confirmed: boolean;
}

interface Profile {
  id: string;
  phone: string;
  full_name: string;
  email: string | null;
  role: string;
  commune: string | null;
  address: string | null;
  kyc_status: string;
  is_active: boolean;
  [key: string]: unknown;
}

export interface SeedUser {
  phone: string;
  password: string;
  email?: string;
  fullName: string;
  role: 'locataire' | 'bailleur' | 'agence';
}

const json = (route: Route, status: number, body: unknown, headers: Record<string, string> = {}) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*', ...headers },
    body: body === undefined ? '' : JSON.stringify(body),
  });

const authError = (route: Route, status: number, code: string, msg: string) =>
  json(route, status, { code: status, error_code: code, msg });

const b64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

export class SupabaseMock {
  readonly users = new Map<string, MockUser>();
  readonly profiles = new Map<string, Profile>();
  readonly otps = new Map<string, string>();
  readonly calls: Array<{ method: string; path: string }> = [];
  /** When true every OTP is rejected as expired, as GoTrue does after its TTL. */
  expireOtps = false;
  private counter = 0;

  seed(user: SeedUser): MockUser {
    const id = this.uuid();
    const record: MockUser = {
      id,
      phone: user.phone,
      email: user.email ?? null,
      password: user.password,
      metadata: { full_name: user.fullName, role: user.role },
      confirmed: true,
    };
    this.users.set(user.phone, record);
    this.profiles.set(id, {
      id,
      phone: user.phone,
      full_name: user.fullName,
      email: user.email ?? null,
      role: user.role,
      commune: 'Gombe',
      address: null,
      kyc_status: 'pending',
      is_active: true,
    });
    return record;
  }

  userByEmail(email: string): MockUser | undefined {
    return [...this.users.values()].find((u) => u.email?.toLowerCase() === email.toLowerCase());
  }

  async install(page: Page): Promise<void> {
    await page.route(/^https:\/\/[^/]+\.supabase\.co\/.*/, (route) => this.handle(route));
    // Dashboards open a realtime channel; leave the socket connecting forever.
    await page.routeWebSocket(/\/realtime\/v1\//, () => undefined);
  }

  private uuid(): string {
    this.counter += 1;
    return `00000000-0000-4000-8000-${String(this.counter).padStart(12, '0')}`;
  }

  private publicUser(user: MockUser) {
    const now = new Date().toISOString();
    return {
      id: user.id,
      aud: 'authenticated',
      role: user.confirmed ? 'authenticated' : '',
      email: user.email ?? '',
      phone: user.phone,
      phone_confirmed_at: user.confirmed ? now : null,
      confirmation_sent_at: now,
      app_metadata: { provider: 'phone', providers: ['phone'] },
      user_metadata: user.metadata,
      identities: [],
      created_at: now,
      updated_at: now,
      is_anonymous: false,
    };
  }

  private session(user: MockUser) {
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;
    const header = b64url({ alg: 'HS256', typ: 'JWT' });
    const payload = b64url({
      iss: 'https://mock.supabase.co/auth/v1',
      sub: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      phone: user.phone,
      email: user.email ?? '',
      session_id: this.uuid(),
      iat,
      exp,
    });
    return {
      access_token: `${header}.${payload}.mock-signature`,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: exp,
      refresh_token: `refresh-${user.id}-${iat}`,
      user: this.publicUser(user),
    };
  }

  private userFromAuthHeader(route: Route): MockUser | undefined {
    const auth = route.request().headers()['authorization'] ?? '';
    const token = auth.replace(/^Bearer\s+/i, '');
    const payload = token.split('.')[1];
    if (!payload) return undefined;
    try {
      const { sub } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sub?: string };
      return [...this.users.values()].find((u) => u.id === sub);
    } catch {
      return undefined;
    }
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    this.calls.push({ method, path: url.pathname + url.search });

    if (method === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
          'access-control-allow-headers': '*',
        },
      });
    }

    const body = ((): Record<string, unknown> => {
      try {
        const parsed: unknown = request.postDataJSON();
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
      } catch {
        return {};
      }
    })();

    if (url.pathname.startsWith('/auth/v1/')) return this.handleAuth(route, url, method, body);
    if (url.pathname.startsWith('/rest/v1/')) return this.handleRest(route, url, method, body);
    if (url.pathname.startsWith('/storage/v1/object/')) {
      return json(route, 200, { Key: url.pathname.replace('/storage/v1/object/', ''), Id: this.uuid() });
    }
    return json(route, 404, { message: `unmocked ${method} ${url.pathname}` });
  }

  private handleAuth(route: Route, url: URL, method: string, body: Record<string, unknown>): Promise<void> {
    const path = url.pathname.replace('/auth/v1', '');
    const phone = typeof body.phone === 'string' ? body.phone : '';

    switch (`${method} ${path}`) {
      case 'POST /signup': {
        if (this.users.has(phone)) return authError(route, 422, 'user_already_exists', 'User already registered');
        const user: MockUser = {
          id: this.uuid(),
          phone,
          email: null,
          password: String(body.password ?? ''),
          metadata: ((body.data as Record<string, unknown>) ?? {}) as Record<string, unknown>,
          confirmed: false,
        };
        this.users.set(phone, user);
        this.otps.set(phone, OTP_CODE);
        return json(route, 200, this.publicUser(user));
      }
      case 'POST /otp': {
        if (!this.users.has(phone)) return authError(route, 422, 'otp_disabled', 'Signups not allowed for otp');
        this.otps.set(phone, OTP_CODE);
        return json(route, 200, {});
      }
      case 'POST /resend': {
        this.otps.set(phone, OTP_CODE);
        this.expireOtps = false;
        return json(route, 200, {});
      }
      case 'POST /verify': {
        const user = this.users.get(phone);
        const expected = this.otps.get(phone);
        if (!user || !expected || this.expireOtps || body.token !== expected) {
          return authError(route, 403, 'otp_expired', 'Token has expired or is invalid');
        }
        this.otps.delete(phone);
        user.confirmed = true;
        return json(route, 200, this.session(user));
      }
      case 'POST /token': {
        const grant = url.searchParams.get('grant_type');
        if (grant === 'password') {
          const user =
            typeof body.email === 'string' ? this.userByEmail(body.email) : this.users.get(phone);
          if (!user || !user.confirmed || user.password !== body.password) {
            return authError(route, 400, 'invalid_credentials', 'Invalid login credentials');
          }
          return json(route, 200, this.session(user));
        }
        if (grant === 'refresh_token') {
          const match = /^refresh-(.+)-\d+$/.exec(String(body.refresh_token ?? ''));
          const user = [...this.users.values()].find((u) => u.id === match?.[1]);
          if (!user) return authError(route, 400, 'refresh_token_not_found', 'Invalid Refresh Token');
          return json(route, 200, this.session(user));
        }
        return authError(route, 400, 'unsupported_grant_type', 'unsupported grant type');
      }
      case 'GET /user': {
        const user = this.userFromAuthHeader(route);
        if (!user) return authError(route, 401, 'no_authorization', 'missing authorization');
        return json(route, 200, this.publicUser(user));
      }
      case 'PUT /user': {
        const user = this.userFromAuthHeader(route);
        if (!user) return authError(route, 401, 'no_authorization', 'missing authorization');
        if (typeof body.email === 'string') {
          const owner = this.userByEmail(body.email);
          if (owner && owner.id !== user.id) {
            return authError(route, 422, 'email_exists', 'A user with this email address has already been registered');
          }
          user.email = body.email;
        }
        if (typeof body.password === 'string') user.password = body.password;
        return json(route, 200, this.publicUser(user));
      }
      case 'POST /logout':
        return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
      case 'POST /recover':
        return json(route, 200, {});
      default:
        return json(route, 404, { message: `unmocked auth ${method} ${path}` });
    }
  }

  private handleRest(route: Route, url: URL, method: string, body: Record<string, unknown>): Promise<void> {
    const table = url.pathname.replace('/rest/v1/', '');
    const accept = route.request().headers()['accept'] ?? '';
    const wantsObject = accept.includes('vnd.pgrst.object');
    const idFilter = /^eq\.(.+)$/.exec(url.searchParams.get('id') ?? '')?.[1];

    if (table === 'users') {
      if (method === 'POST') {
        const row = body as unknown as Profile;
        const existing = this.profiles.get(row.id);
        const merged = { ...existing, ...row };
        this.profiles.set(row.id, merged);
        return json(route, 201, wantsObject ? merged : [merged]);
      }
      if (method === 'PATCH') {
        const existing = idFilter ? this.profiles.get(idFilter) : undefined;
        if (existing) this.profiles.set(idFilter!, { ...existing, ...body });
        return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
      }
      if (method === 'GET') {
        const profile = idFilter ? this.profiles.get(idFilter) : undefined;
        if (wantsObject) {
          if (!profile) {
            return json(route, 406, { code: 'PGRST116', details: 'The result contains 0 rows', message: 'JSON object requested, multiple (or no) rows returned' });
          }
          return json(route, 200, { ...profile, bailleurs: [] });
        }
        return json(route, 200, profile ? [{ ...profile, bailleurs: [] }] : []);
      }
    }

    if (table === 'bailleurs' && method === 'POST') {
      return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' } });
    }

    // Anything the dashboards ask for is empty: the suite verifies the auth
    // flow reaches them, not their data.
    if (method === 'GET' || method === 'HEAD') {
      if (wantsObject) {
        return json(route, 406, { code: 'PGRST116', details: 'The result contains 0 rows', message: 'JSON object requested, multiple (or no) rows returned' });
      }
      return json(route, 200, [], { 'content-range': '*/0' });
    }
    if (table.startsWith('rpc/')) return json(route, 200, wantsObject ? null : []);
    return json(route, 201, wantsObject ? body : [body]);
  }
}
