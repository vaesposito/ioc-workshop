const AUTH_CACHE_STORAGE_KEY = "detective.auth.cache.v1";
const TOKEN_EXPIRY_SKEW_MS = 60_000;
const TOKEN_REFRESH_THRESHOLD_MS = 120_000;

type UserRole = "view" | "execute" | "admin";

export interface BackendAuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface AuthCacheState {
  accessToken: string | null;
  expiresAtEpochMs: number | null;
  backendUser: BackendAuthUser | null;
  backendAuthCheckedAt: number | null;
}

interface RefreshOptions {
  forceRefresh?: boolean;
  refreshThresholdMs?: number;
}

type RefreshAccessTokenHandler = () => Promise<string | null | undefined>;

let refreshHandler: RefreshAccessTokenHandler | null = null;
let refreshInFlight: Promise<string | null> | null = null;

let state: AuthCacheState = readCacheFromStorage();

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}

function decodeTokenPayload(token: string): Record<string, unknown> | null {
  const segments = token.split(".");
  if (segments.length < 2) {
    return null;
  }

  const payload = segments[1];
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractTokenExpiryEpochMs(token: string): number | null {
  const payload = decodeTokenPayload(token);
  const exp = payload?.exp;
  if (typeof exp === "number" && Number.isFinite(exp)) {
    return exp * 1000;
  }
  if (typeof exp === "string") {
    const parsed = Number.parseInt(exp, 10);
    if (Number.isFinite(parsed)) {
      return parsed * 1000;
    }
  }
  return null;
}

function persistState(nextState: AuthCacheState): void {
  state = nextState;
  const storage = getStorage();
  if (!storage) {
    return;
  }

  if (!nextState.accessToken) {
    storage.removeItem(AUTH_CACHE_STORAGE_KEY);
    return;
  }

  storage.setItem(AUTH_CACHE_STORAGE_KEY, JSON.stringify(nextState));
}

function normalizeParsedState(value: unknown): AuthCacheState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<AuthCacheState>;
  const accessToken =
    typeof candidate.accessToken === "string" ? candidate.accessToken : null;
  const expiresAtEpochMs =
    typeof candidate.expiresAtEpochMs === "number" &&
    Number.isFinite(candidate.expiresAtEpochMs)
      ? candidate.expiresAtEpochMs
      : null;
  const backendUser =
    candidate.backendUser &&
    typeof candidate.backendUser === "object" &&
    typeof candidate.backendUser.id === "string" &&
    typeof candidate.backendUser.name === "string" &&
    typeof candidate.backendUser.email === "string" &&
    (candidate.backendUser.role === "view" ||
      candidate.backendUser.role === "execute" ||
      candidate.backendUser.role === "admin")
      ? (candidate.backendUser as BackendAuthUser)
      : null;
  const backendAuthCheckedAt =
    typeof candidate.backendAuthCheckedAt === "number" &&
    Number.isFinite(candidate.backendAuthCheckedAt)
      ? candidate.backendAuthCheckedAt
      : null;

  if (!accessToken) {
    return {
      accessToken: null,
      expiresAtEpochMs: null,
      backendUser: null,
      backendAuthCheckedAt: null,
    };
  }

  return {
    accessToken,
    expiresAtEpochMs,
    backendUser,
    backendAuthCheckedAt,
  };
}

function readCacheFromStorage(): AuthCacheState {
  const storage = getStorage();
  if (!storage) {
    return {
      accessToken: null,
      expiresAtEpochMs: null,
      backendUser: null,
      backendAuthCheckedAt: null,
    };
  }

  const raw = storage.getItem(AUTH_CACHE_STORAGE_KEY);
  if (!raw) {
    return {
      accessToken: null,
      expiresAtEpochMs: null,
      backendUser: null,
      backendAuthCheckedAt: null,
    };
  }

  try {
    const parsed = JSON.parse(raw);
    const normalized = normalizeParsedState(parsed);
    if (normalized) {
      return normalized;
    }
  } catch {
    // Ignore malformed cache and clear below.
  }

  storage.removeItem(AUTH_CACHE_STORAGE_KEY);
  return {
    accessToken: null,
    expiresAtEpochMs: null,
    backendUser: null,
    backendAuthCheckedAt: null,
  };
}

function shouldTreatAsExpired(
  expiresAtEpochMs: number | null,
  now = Date.now(),
  skewMs = TOKEN_EXPIRY_SKEW_MS,
): boolean {
  if (!expiresAtEpochMs) {
    return false;
  }
  return now + skewMs >= expiresAtEpochMs;
}

export function syncAuthCacheFromStorage(): void {
  state = readCacheFromStorage();
}

export function registerAuthRefreshHandler(
  handler: RefreshAccessTokenHandler | null,
): void {
  refreshHandler = handler;
}

export function setAuthAccessToken(token: string): void {
  const expiresAtEpochMs = extractTokenExpiryEpochMs(token);
  const isSameToken = state.accessToken === token;

  persistState({
    accessToken: token,
    expiresAtEpochMs,
    backendUser: isSameToken ? state.backendUser : null,
    backendAuthCheckedAt: isSameToken ? state.backendAuthCheckedAt : null,
  });
}

export function setBackendAuthUser(user: BackendAuthUser): void {
  if (!state.accessToken) {
    return;
  }

  persistState({
    ...state,
    backendUser: user,
    backendAuthCheckedAt: Date.now(),
  });
}

export function clearBackendAuthUser(): void {
  if (!state.accessToken) {
    return;
  }

  persistState({
    ...state,
    backendUser: null,
    backendAuthCheckedAt: null,
  });
}

export function clearAuthAccessToken(): void {
  persistState({
    accessToken: null,
    expiresAtEpochMs: null,
    backendUser: null,
    backendAuthCheckedAt: null,
  });
}

export function getBackendAuthUser(): BackendAuthUser | null {
  return state.backendUser;
}

export function getAuthAccessToken(options?: {
  allowExpired?: boolean;
}): string | null {
  const allowExpired = options?.allowExpired ?? false;
  if (!state.accessToken) {
    return null;
  }

  if (!allowExpired && shouldTreatAsExpired(state.expiresAtEpochMs)) {
    return null;
  }

  return state.accessToken;
}

export function isAuthAccessTokenExpired(): boolean {
  return shouldTreatAsExpired(state.expiresAtEpochMs);
}

export function shouldRefreshAuthAccessToken(
  thresholdMs = TOKEN_REFRESH_THRESHOLD_MS,
): boolean {
  if (!state.accessToken || !state.expiresAtEpochMs) {
    return false;
  }
  return Date.now() + thresholdMs >= state.expiresAtEpochMs;
}

export async function ensureFreshAuthAccessToken(
  options?: RefreshOptions,
): Promise<string | null> {
  syncAuthCacheFromStorage();

  const token = state.accessToken;
  if (!token) {
    return null;
  }

  const forceRefresh = options?.forceRefresh ?? false;
  const refreshThresholdMs =
    options?.refreshThresholdMs ?? TOKEN_REFRESH_THRESHOLD_MS;
  const needsRefresh =
    forceRefresh || shouldRefreshAuthAccessToken(refreshThresholdMs);

  if (!needsRefresh) {
    return getAuthAccessToken();
  }

  if (!refreshHandler) {
    if (isAuthAccessTokenExpired()) {
      clearAuthAccessToken();
      return null;
    }
    return getAuthAccessToken();
  }

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const refreshedToken = await refreshHandler();
        if (typeof refreshedToken === "string" && refreshedToken.trim()) {
          setAuthAccessToken(refreshedToken);
          return refreshedToken;
        }

        syncAuthCacheFromStorage();
        return getAuthAccessToken({ allowExpired: true });
      } catch {
        syncAuthCacheFromStorage();
        if (isAuthAccessTokenExpired()) {
          clearAuthAccessToken();
        }
        return getAuthAccessToken();
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  const refreshed = await refreshInFlight;
  if (!refreshed) {
    return null;
  }

  return getAuthAccessToken();
}

export { AUTH_CACHE_STORAGE_KEY };
