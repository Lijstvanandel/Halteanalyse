export const OSL_ISSUER = 'https://onafhankelijksteenwijkerland.nl';
export const OSL_AUTHORIZE_URL = `${OSL_ISSUER}/authorize`;
export const OSL_LOGOUT_UI_URL = `${OSL_ISSUER}/sso/logout`;
export const OSL_CLIENT_ID = import.meta.env.VITE_OSL_CLIENT_ID || 'mobiliteit';
export const OSL_SCOPE = 'openid profile email export:csv export:json';

const SESSION_KEY = 'osl_sso_session_v1';
const PKCE_TX_KEY = 'osl_sso_pkce_tx_v1';

export interface OslUserProfile {
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
}

export interface OslSession {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: number;
  scope: string;
  user: OslUserProfile | null;
}

export interface PendingExportRequest {
  url: string;
  fallbackFilename?: string;
  modal?: 'punctuality' | 'deelfiets' | 'ovfiets' | 'aansluitingen';
}

interface PkceTransaction {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  returnUrl?: string;
  pendingExport?: PendingExportRequest;
  createdAt: number;
}

let memorySession: OslSession | null = null;
let memoryTx: PkceTransaction | null = null;
const sessionListeners = new Set<(session: OslSession | null) => void>();

function notifyListeners() {
  const current = getOslSession();
  for (const listener of sessionListeners) {
    try {
      listener(current);
    } catch {
      // ignore listener errors
    }
  }
}

export function subscribeOslSession(listener: (session: OslSession | null) => void): () => void {
  sessionListeners.add(listener);
  listener(getOslSession());
  return () => {
    sessionListeners.delete(listener);
  };
}

function loadSessionFromStorage(): OslSession | null {
  if (memorySession) return memorySession;
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OslSession;
    if (parsed && typeof parsed.accessToken === 'string') {
      memorySession = parsed;
      return parsed;
    }
  } catch {
    // ignore storage errors in strict third-party contexts
  }
  return null;
}

function saveSession(session: OslSession | null) {
  memorySession = session;
  if (typeof window !== 'undefined') {
    try {
      if (session) {
        window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } else {
        window.sessionStorage.removeItem(SESSION_KEY);
      }
    } catch {
      // ignore
    }
  }
  notifyListeners();
}

function savePkceTransaction(tx: PkceTransaction | null) {
  memoryTx = tx;
  if (typeof window !== 'undefined') {
    try {
      if (tx) {
        window.sessionStorage.setItem(PKCE_TX_KEY, JSON.stringify(tx));
      } else {
        window.sessionStorage.removeItem(PKCE_TX_KEY);
      }
    } catch {
      // ignore
    }
  }
}

function loadPkceTransaction(): PkceTransaction | null {
  if (memoryTx) return memoryTx;
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PKCE_TX_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PkceTransaction;
  } catch {
    return null;
  }
}

export function getOslSession(): OslSession | null {
  const s = loadSessionFromStorage();
  if (!s) return null;
  // Treat expired accessToken without refreshToken as expired
  if (Date.now() >= s.expiresAt && !s.refreshToken) {
    return null;
  }
  return s;
}

export function getOslRedirectUri(): string {
  if (typeof window === 'undefined') {
    return 'https://mobiliteit.onafhankelijksteenwijkerland.nl/sso/callback';
  }
  const host = window.location.hostname.toLowerCase();
  if (
    host === 'onafhankelijksteenwijkerland.nl' ||
    host.endsWith('.onafhankelijksteenwijkerland.nl') ||
    host.endsWith('.scientiarum.nl')
  ) {
    return `${window.location.origin}/sso/callback`;
  }
  return 'https://mobiliteit.onafhankelijksteenwijkerland.nl/sso/callback';
}

export function isEmbeddedAuthContext(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return (
    params.get('embed') === 'true' ||
    params.get('widget') === 'true' ||
    window.self !== window.top
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomUrlSafeString(byteLen = 32): string {
  const bytes = new Uint8Array(byteLen);
  window.crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

async function computePkceChallengeS256(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return toBase64Url(new Uint8Array(digest));
}

function buildSessionFromTokenResponse(data: any): OslSession {
  const expiresInSec = Number(data?.expires_in || 3600);
  const session: OslSession = {
    accessToken: String(data.access_token),
    refreshToken: data.refresh_token ? String(data.refresh_token) : undefined,
    idToken: data.id_token ? String(data.id_token) : undefined,
    expiresAt: Date.now() + Math.max(60, expiresInSec - 30) * 1000,
    scope: String(data.scope || OSL_SCOPE),
    user: (data.user as OslUserProfile) || null,
  };
  return session;
}

async function exchangeCodeViaBackend(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<OslSession> {
  const res = await fetch('/api/sso/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: OSL_CLIENT_ID,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.message || data?.error_description || data?.error || 'OSL token uitwisseling mislukt');
  }

  const session = buildSessionFromTokenResponse(data);
  saveSession(session);
  return session;
}

export async function refreshOslSession(): Promise<OslSession | null> {
  const current = loadSessionFromStorage();
  if (!current?.refreshToken) return null;

  try {
    const res = await fetch('/api/sso/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: OSL_CLIENT_ID,
        refresh_token: current.refreshToken,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.access_token) {
      saveSession(null);
      return null;
    }

    const updated = buildSessionFromTokenResponse({
      ...data,
      refresh_token: data.refresh_token || current.refreshToken,
      user: data.user || current.user,
    });
    saveSession(updated);
    return updated;
  } catch {
    return null;
  }
}

export async function getValidOslAccessToken(): Promise<string | null> {
  const s = loadSessionFromStorage();
  if (!s) return null;
  if (Date.now() < s.expiresAt) {
    return s.accessToken;
  }
  const refreshed = await refreshOslSession();
  return refreshed?.accessToken || null;
}

/**
 * Initiates OSL OAuth 2.0 Authorization Code Flow with PKCE S256.
 * - Standalone top-level visit: redirects full page to OSL authorize endpoint and returns null (page navigates).
 * - Embedded visit (?embed=true or inside iframe): opens authorize URL with &response_mode=web_message
 *   in a popup and awaits the { type: "osl-sso-callback", code, state, iss } postMessage.
 */
export async function startOslLogin(
  pendingExport?: PendingExportRequest
): Promise<OslSession | null> {
  const codeVerifier = randomUrlSafeString(48);
  const codeChallenge = await computePkceChallengeS256(codeVerifier);
  const state = randomUrlSafeString(24);
  const redirectUri = getOslRedirectUri();

  const tx: PkceTransaction = {
    state,
    codeVerifier,
    redirectUri,
    returnUrl: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    pendingExport,
    createdAt: Date.now(),
  };
  savePkceTransaction(tx);

  const authParams = new URLSearchParams({
    response_type: 'code',
    client_id: OSL_CLIENT_ID,
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    scope: OSL_SCOPE,
  });

  const embedded = isEmbeddedAuthContext();
  if (embedded) {
    authParams.set('response_mode', 'web_message');
    const popupUrl = `${OSL_AUTHORIZE_URL}?${authParams.toString()}`;

    const popup = window.open(
      popupUrl,
      'osl_sso_popup',
      'width=540,height=720,menubar=no,toolbar=no,location=yes,resizable=yes,scrollbars=yes'
    );
    if (!popup) {
      throw new Error(
        'Pop-up geblokkeerd door browser. Sta pop-ups toe voor deze site om in te loggen via Onafhankelijk Steenwijkerland.'
      );
    }

    return new Promise<OslSession>((resolve, reject) => {
      let settled = false;
      let closeCheckTimer: number | null = null;
      let timeoutTimer: number | null = null;

      const cleanup = () => {
        window.removeEventListener('message', onMessage);
        if (closeCheckTimer !== null) window.clearInterval(closeCheckTimer);
        if (timeoutTimer !== null) window.clearTimeout(timeoutTimer);
      };

      const onMessage = async (event: MessageEvent) => {
        // Strictly validate origin === https://onafhankelijksteenwijkerland.nl
        if (event.origin !== OSL_ISSUER) return;
        const msg = event.data;
        if (!msg || msg.type !== 'osl-sso-callback') return;

        if (msg.error) {
          settled = true;
          cleanup();
          savePkceTransaction(null);
          try {
            popup.close();
          } catch {}
          reject(new Error(String(msg.error_description || msg.error)));
          return;
        }

        if (msg.state !== tx.state || !msg.code) {
          settled = true;
          cleanup();
          savePkceTransaction(null);
          try {
            popup.close();
          } catch {}
          reject(new Error('Ongeldige OSL SSO state ontvangen. Probeer opnieuw.'));
          return;
        }

        try {
          const session = await exchangeCodeViaBackend(
            String(msg.code),
            tx.codeVerifier,
            tx.redirectUri
          );
          settled = true;
          cleanup();
          savePkceTransaction(null);
          try {
            popup.close();
          } catch {}
          resolve(session);
        } catch (err) {
          settled = true;
          cleanup();
          savePkceTransaction(null);
          reject(err);
        }
      };

      window.addEventListener('message', onMessage);

      closeCheckTimer = window.setInterval(() => {
        if (!settled && popup.closed) {
          settled = true;
          cleanup();
          savePkceTransaction(null);
          reject(new Error('OSL SSO inlogvenster gesloten voordat het inloggen was voltooid.'));
        }
      }, 450);

      timeoutTimer = window.setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          savePkceTransaction(null);
          reject(new Error('OSL SSO inloggen duurde te lang (time-out).'));
        }
      }, 5 * 60 * 1000);
    });
  }

  // Standalone full-page redirect
  const standaloneUrl = `${OSL_AUTHORIZE_URL}?${authParams.toString()}`;
  window.location.assign(standaloneUrl);
  return null;
}

/**
 * Handles /sso/callback?code=...&state=... when returning from standalone OSL SSO redirect.
 */
export async function handleOslRedirectCallbackOnBoot(): Promise<{
  handled: boolean;
  pendingExport?: PendingExportRequest;
  error?: string;
}> {
  if (typeof window === 'undefined') return { handled: false };
  const url = new URL(window.location.href);
  if (!url.pathname.startsWith('/sso/callback')) {
    return { handled: false };
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errParam = url.searchParams.get('error');
  const errDesc = url.searchParams.get('error_description');

  // Fallback if opened as popup redirect instead of web_message
  if (window.opener && window.opener !== window) {
    try {
      window.opener.postMessage(
        {
          type: 'osl-sso-callback',
          code,
          state,
          error: errParam,
          error_description: errDesc,
          iss: OSL_ISSUER,
        },
        '*'
      );
    } catch {}
    window.close();
    return { handled: true };
  }

  const tx = loadPkceTransaction();
  const returnUrl = tx?.returnUrl && !tx.returnUrl.startsWith('/sso/callback') ? tx.returnUrl : '/';

  const cleanBrowserUrl = () => {
    try {
      window.history.replaceState({}, document.title, returnUrl);
    } catch {
      window.history.replaceState({}, document.title, '/');
    }
  };

  if (errParam) {
    savePkceTransaction(null);
    cleanBrowserUrl();
    return { handled: true, error: String(errDesc || errParam) };
  }

  if (!code || !state || !tx || tx.state !== state) {
    savePkceTransaction(null);
    cleanBrowserUrl();
    return {
      handled: true,
      error: 'OSL SSO sessiecontrole (state) kwam niet overeen of is verlopen.',
    };
  }

  try {
    await exchangeCodeViaBackend(code, tx.codeVerifier, tx.redirectUri);
    const pendingExport = tx.pendingExport;
    savePkceTransaction(null);
    cleanBrowserUrl();
    return { handled: true, pendingExport };
  } catch (err: any) {
    savePkceTransaction(null);
    cleanBrowserUrl();
    return {
      handled: true,
      error: err?.message || 'Kon OSL SSO inlogcode niet verzilveren.',
    };
  }
}

export async function logoutOsl(redirectToIdpLogout = false): Promise<void> {
  const current = loadSessionFromStorage();
  try {
    await fetch('/api/sso/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(current?.accessToken ? { Authorization: `Bearer ${current.accessToken}` } : {}),
      },
      body: JSON.stringify({
        access_token: current?.accessToken,
        refresh_token: current?.refreshToken,
      }),
    });
  } catch {
    // ignore network failure on logout
  }

  saveSession(null);
  savePkceTransaction(null);

  if (redirectToIdpLogout && !isEmbeddedAuthContext() && typeof window !== 'undefined') {
    const returnUri = encodeURIComponent(window.location.origin + '/');
    window.location.assign(`${OSL_LOGOUT_UI_URL}?redirect_uri=${returnUri}`);
  }
}

function parseFilenameFromDisposition(header: string | null, fallback = 'dataset_export'): string {
  if (!header) return fallback;
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match && utf8Match[1]) {
    try {
      return decodeURIComponent(utf8Match[1].replace(/["']/g, ''));
    } catch {}
  }
  const plainMatch = header.match(/filename="?([^";]+)"?/i);
  if (plainMatch && plainMatch[1]) {
    return plainMatch[1];
  }
  return fallback;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

/**
 * Fetches a protected .CSV or .JSON dataset export with Authorization: Bearer <access_token>.
 * On HTTP 401 or missing token, automatically triggers OSL SSO PKCE flow and starts the export immediately after callback.
 */
export async function downloadProtectedExport(
  url: string,
  options?: {
    fallbackFilename?: string;
    modal?: PendingExportRequest['modal'];
  }
): Promise<boolean> {
  let token = await getValidOslAccessToken();

  if (!token) {
    const session = await startOslLogin({
      url,
      fallbackFilename: options?.fallbackFilename,
      modal: options?.modal,
    });
    if (!session) {
      // Standalone full-page redirect in progress; download resumes after /sso/callback
      return false;
    }
    token = session.accessToken;
  }

  let res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    // Try refresh first, otherwise trigger interactive OSL SSO login
    const refreshed = await refreshOslSession();
    if (refreshed?.accessToken) {
      res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${refreshed.accessToken}`,
        },
      });
    }

    if (res.status === 401) {
      saveSession(null);
      const session = await startOslLogin({
        url,
        fallbackFilename: options?.fallbackFilename,
        modal: options?.modal,
      });
      if (!session) {
        return false;
      }
      res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      });
    }
  }

  if (res.status === 403) {
    const errBody = await res.json().catch(() => null);
    throw new Error(
      errBody?.message || 'Je OSL-account mist de vereiste exportrechten (scope).'
    );
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new Error(errBody?.message || `Export mislukt (HTTP ${res.status}).`);
  }

  const blob = await res.blob();
  const filename = parseFilenameFromDisposition(
    res.headers.get('Content-Disposition'),
    options?.fallbackFilename || 'steenwijkerland_export'
  );
  triggerBlobDownload(blob, filename);
  return true;
}
