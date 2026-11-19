import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export const OSL_ISSUER = 'https://onafhankelijksteenwijkerland.nl';
export const OSL_DISCOVERY_URL = `${OSL_ISSUER}/.well-known/openid-configuration`;
export const OSL_JWKS_URL = `${OSL_ISSUER}/.well-known/jwks.json`;
export const OSL_AUTHORIZE_URL = `${OSL_ISSUER}/authorize`;
export const OSL_TOKEN_URL = `${OSL_ISSUER}/api/auth/token`;
export const OSL_VERIFY_URL = `${OSL_ISSUER}/api/auth/verify`;
export const OSL_USERINFO_URL = `${OSL_ISSUER}/api/auth/userinfo`;
export const OSL_LOGOUT_UI_URL = `${OSL_ISSUER}/sso/logout`;
export const OSL_LOGOUT_API_URL = `${OSL_ISSUER}/api/auth/logout`;

export const OSL_CLIENT_ID = process.env.OSL_CLIENT_ID || 'mobiliteit';
export const OSL_DEFAULT_REDIRECT_URI =
  process.env.OSL_REDIRECT_URI ||
  'https://mobiliteit.onafhankelijksteenwijkerland.nl/sso/callback';
export const OSL_SCOPE = 'openid profile email export:csv export:json';

export interface OslTokenClaims {
  sub?: string;
  id?: string | number;
  username?: string;
  email?: string;
  name?: string;
  role?: string;
  is_member?: boolean;
  membership_state?: string;
  scope?: string;
  scopes?: string[];
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  nbf?: number;
  [key: string]: unknown;
}

export interface AuthenticatedOslRequest extends Request {
  oslUser?: OslTokenClaims;
  oslAccessToken?: string;
}

interface JwkKey extends crypto.JsonWebKey {
  kid?: string;
  alg?: string;
  use?: string;
  kty: string;
}

interface CachedJwks {
  keys: JwkKey[];
  fetchedAt: number;
}

const JWKS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let jwksCache: CachedJwks | null = null;
let inFlightJwksFetch: Promise<JwkKey[]> | null = null;

function base64UrlToBuffer(b64u: string): Buffer {
  const padded = b64u.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
}

function parseJsonBase64Url<T>(b64u: string): T | null {
  try {
    const raw = base64UrlToBuffer(b64u).toString('utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function getOslJwks(forceRefresh = false): Promise<JwkKey[]> {
  const now = Date.now();
  if (!forceRefresh && jwksCache && now - jwksCache.fetchedAt < JWKS_CACHE_TTL_MS) {
    return jwksCache.keys;
  }
  if (inFlightJwksFetch) {
    return inFlightJwksFetch;
  }

  inFlightJwksFetch = (async () => {
    try {
      const res = await fetch(OSL_JWKS_URL, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        throw new Error(`JWKS HTTP ${res.status}`);
      }
      const data = (await res.json()) as { keys?: JwkKey[] };
      const keys = Array.isArray(data?.keys) ? data.keys : [];
      if (keys.length > 0) {
        jwksCache = { keys, fetchedAt: Date.now() };
      }
      return keys;
    } catch (err) {
      if (jwksCache) return jwksCache.keys;
      throw err;
    } finally {
      inFlightJwksFetch = null;
    }
  })();

  return inFlightJwksFetch;
}

function extractScopeSet(claims: OslTokenClaims): Set<string> {
  const set = new Set<string>();
  if (Array.isArray(claims.scopes)) {
    for (const s of claims.scopes) {
      if (typeof s === 'string' && s.trim()) set.add(s.trim());
    }
  }
  if (typeof claims.scope === 'string') {
    for (const s of claims.scope.split(/\s+/)) {
      if (s.trim()) set.add(s.trim());
    }
  }
  return set;
}

export function hasRequiredScope(claims: OslTokenClaims, requiredScope: string): boolean {
  const scopes = extractScopeSet(claims);
  return scopes.has(requiredScope);
}

async function verifyJwtOfflineWithJwks(token: string): Promise<OslTokenClaims | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, sigB64] = parts;
  const header = parseJsonBase64Url<{ alg?: string; kid?: string; typ?: string }>(headerB64);
  const payload = parseJsonBase64Url<OslTokenClaims>(payloadB64);
  if (!header || !payload) return null;
  if (header.alg !== 'RS256') return null;

  // Validate issuer and timestamps first
  if (payload.iss !== OSL_ISSUER) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && nowSec > payload.exp + 5) return null;
  if (typeof payload.nbf === 'number' && nowSec + 5 < payload.nbf) return null;

  let keys = await getOslJwks(false);
  let matchingKey = keys.find(
    (k) =>
      k.kty === 'RSA' &&
      (!header.kid || k.kid === header.kid) &&
      (!k.use || k.use === 'sig')
  );

  // Key rotation fallback: refresh JWKS once if kid wasn't found in cache
  if (!matchingKey && header.kid) {
    keys = await getOslJwks(true);
    matchingKey = keys.find(
      (k) =>
        k.kty === 'RSA' &&
        k.kid === header.kid &&
        (!k.use || k.use === 'sig')
    );
  }

  if (!matchingKey) return null;

  const publicKey = crypto.createPublicKey({
    key: matchingKey as crypto.JsonWebKey,
    format: 'jwk',
  });
  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8');
  const signature = base64UrlToBuffer(sigB64);

  const valid = crypto.verify('RSA-SHA256', signingInput, publicKey, signature);
  if (!valid) return null;

  return payload;
}

async function verifyTokenOnline(token: string): Promise<OslTokenClaims | null> {
  try {
    const res = await fetch(OSL_VERIFY_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    if (data?.valid === false || data?.active === false) return null;
    const claims: OslTokenClaims = (data?.claims || data?.user || data) as OslTokenClaims;
    if (claims.iss && claims.iss !== OSL_ISSUER) return null;
    if (data?.scope && !claims.scope) claims.scope = data.scope;
    if (Array.isArray(data?.scopes) && !claims.scopes) claims.scopes = data.scopes;
    return claims;
  } catch {
    return null;
  }
}

export async function verifyOslBearerToken(token: string): Promise<OslTokenClaims | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;

  // 1. Offline RS256 verification via cached JWKS
  try {
    const offlineClaims = await verifyJwtOfflineWithJwks(trimmed);
    if (offlineClaims) return offlineClaims;
  } catch {
    // Fall back to online verify endpoint
  }

  // 2. Fallback to GET https://onafhankelijksteenwijkerland.nl/api/auth/verify
  return verifyTokenOnline(trimmed);
}

export function extractBearerTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (typeof authHeader === 'string') {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match && match[1]) return match[1].trim();
  }
  return null;
}

export function requireOslExportAuth(requiredScope: 'export:csv' | 'export:json') {
  return async (req: AuthenticatedOslRequest, res: Response, next: NextFunction) => {
    const token = extractBearerTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'OSL_SSO_REQUIRED',
        message: 'Geen geldig OSL SSO Bearer token ontvangen. Log in via Onafhankelijk Steenwijkerland om datasets te exporteren.',
      });
    }

    const claims = await verifyOslBearerToken(token);
    if (!claims) {
      return res.status(401).json({
        success: false,
        error: 'OSL_SSO_INVALID_TOKEN',
        message: 'Het OSL SSO token is ongeldig of verlopen. Log opnieuw in.',
      });
    }

    if (!hasRequiredScope(claims, requiredScope)) {
      return res.status(403).json({
        success: false,
        error: 'OSL_SSO_INSUFFICIENT_SCOPE',
        message: `Ontbrekende OSL SSO scope: ${requiredScope}`,
      });
    }

    req.oslUser = claims;
    req.oslAccessToken = token;
    next();
  };
}

export async function exchangeOslToken(payload: Record<string, string>) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(payload)) {
    if (v !== undefined && v !== null && v !== '') {
      body.set(k, v);
    }
  }
  if (!body.has('client_id')) {
    body.set('client_id', OSL_CLIENT_ID);
  }

  const res = await fetch(OSL_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
    signal: AbortSignal.timeout(10000),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return { ok: res.ok, status: res.status, data: json };
}

export async function fetchOslUserinfo(token: string) {
  const res = await fetch(OSL_USERINFO_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(5000),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

export async function logoutOslSession(accessToken?: string | null, refreshToken?: string | null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(OSL_LOGOUT_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      client_id: OSL_CLIENT_ID,
      ...(refreshToken ? { refresh_token: refreshToken } : {}),
    }),
    signal: AbortSignal.timeout(5000),
  });
  return { ok: res.ok, status: res.status };
}
