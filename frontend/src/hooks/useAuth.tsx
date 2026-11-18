import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AuthProvider as OidcAuthProvider,
  useAuth as useOidcAuth,
} from "react-oidc-context";
import {
  AUTH_CACHE_STORAGE_KEY,
  clearAuthAccessToken,
  clearBackendAuthUser,
  getAuthAccessToken,
  getBackendAuthUser,
  isAuthAccessTokenExpired,
  registerAuthRefreshHandler,
  setAuthAccessToken,
  setBackendAuthUser,
  syncAuthCacheFromStorage,
} from "../utils/authToken";
import { defaultAuthConfigOptionsOIDC } from "../utils/constants";
import { AUTH_FORCED_LOGOUT_EVENT, ApiError, toUserMessage } from "../utils/api";
import { useAuthMeQuery } from "../query/hooks/useAuthMeQuery";
import { getRuntimeConfig } from "../utils/runtimeConfig";
import { queryClient } from "../query/client";

interface AuthContextValue {
  user: {
    id: string;
    name: string;
    email: string;
    familyName: string;
    role: "view" | "execute" | "admin";
  } | null;
  isAdmin: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  loginWithSso: () => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

interface UseAuthOptions {
  verifyBackendAuth?: boolean;
}

const AUTH_ME_TIMEOUT_MS = 8_000;

// This build is the static demo: there is no backend to authenticate against.
function isLocalDevSkipAuth(): boolean {
  return true;
}

function toBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createLocalDevAccessToken(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = toBase64Url(
    JSON.stringify({
      ccoid: "local-dev",
      email_address: "system@detective.local",
      name: "Local Dev",
      role: "admin",
      exp: now + 60 * 60 * 24 * 30,
    }),
  );
  return `${header}.${payload}.`;
}

const LOCAL_DEV_USER = {
  id: "local-dev",
  name: "Local",
  email: "system@detective.local",
  familyName: "Dev",
  role: "admin" as const,
};

if (typeof window !== "undefined" && isLocalDevSkipAuth()) {
  setAuthAccessToken(createLocalDevAccessToken());
  setBackendAuthUser({
    id: LOCAL_DEV_USER.id,
    name: LOCAL_DEV_USER.name,
    email: LOCAL_DEV_USER.email,
    role: LOCAL_DEV_USER.role,
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("Backend authorization timed out"));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const {
    VITE_API_BASE_URL: apiBase,
    VITE_OIDC_AUTHORITY: authority,
    VITE_OIDC_CLIENT_ID: clientId,
    VITE_OIDC_REDIRECT_URI: redirectUri,
    VITE_OIDC_POST_LOGOUT_REDIRECT_URI: postLogoutRedirectUri,
  } = getRuntimeConfig();

  const normalizedApiBase = (apiBase.trim() || window.location.origin).replace(/\/+$/, "");
  const defaultRedirectUri = `${window.location.origin}/callback`;
  const defaultPostLogoutRedirectUri = `${window.location.origin}/`;
  const metadataUrl = `${normalizedApiBase}/api/auth/oidc/.well-known/openid-configuration`;

  if (isLocalDevSkipAuth()) {
    const localAuthority = authority || "https://localhost/local-dev";
    return (
      <OidcAuthProvider
        {...defaultAuthConfigOptionsOIDC}
        authority={localAuthority}
        client_id={clientId || "local-dev"}
        redirect_uri={redirectUri || defaultRedirectUri}
        post_logout_redirect_uri={
          postLogoutRedirectUri || defaultPostLogoutRedirectUri
        }
        automaticSilentRenew={false}
        loadUserInfo={false}
        metadata={{
          issuer: localAuthority,
          authorization_endpoint: `${localAuthority}/authorize`,
          token_endpoint: `${localAuthority}/token`,
          userinfo_endpoint: `${localAuthority}/userinfo`,
          end_session_endpoint: `${localAuthority}/logout`,
          jwks_uri: `${localAuthority}/jwks`,
        }}
      >
        {children}
      </OidcAuthProvider>
    );
  }

  if (!authority || !clientId) {
    throw new Error(
      "Missing OIDC configuration. Set VITE_OIDC_AUTHORITY and VITE_OIDC_CLIENT_ID.",
    );
  }

  const authConfig = {
    ...defaultAuthConfigOptionsOIDC,
    redirect_uri: redirectUri || defaultRedirectUri,
    post_logout_redirect_uri:
      postLogoutRedirectUri || defaultPostLogoutRedirectUri,
    authority,
    client_id: clientId,
    metadataUrl,
  };

  return <OidcAuthProvider {...authConfig}>{children}</OidcAuthProvider>;
}

function resolveOidcRole(profile: Record<string, unknown> | undefined):
  | "view"
  | "execute"
  | "admin" {
  if (!profile) {
    return "view";
  }

  const rawRole = profile.role;
  if (rawRole === "admin" || rawRole === "execute" || rawRole === "view") {
    return rawRole;
  }

  const rawRoles = profile.roles;
  if (Array.isArray(rawRoles)) {
    if (rawRoles.includes("admin")) return "admin";
    if (rawRoles.includes("execute")) return "execute";
    if (rawRoles.includes("view")) return "view";
  }

  return "view";
}

export function useAuth(options?: UseAuthOptions): AuthContextValue {
  const skipAuth = isLocalDevSkipAuth();
  const verifyBackendAuth = options?.verifyBackendAuth ?? false;
  const oidc = useOidcAuth();
  const authMeQuery = useAuthMeQuery(false);
  const [isVerifyingBackend, setIsVerifyingBackend] = useState<boolean>(false);
  const [isBackendAuthorized, setIsBackendAuthorized] = useState<boolean>(() => {
    if (!verifyBackendAuth) return false;
    return !!getBackendAuthUser() && !isAuthAccessTokenExpired();
  });
  const [authCheckedToken, setAuthCheckedToken] = useState<string | null>(null);
  const [authorizationError, setAuthorizationError] = useState<string | null>(
    null,
  );
  const [isForcingLogout, setIsForcingLogout] = useState<boolean>(false);
  const [backendUser, setBackendUser] = useState<{
    id: string;
    name: string;
    email: string;
    role: "view" | "execute" | "admin";
  } | null>(() => {
    if (!verifyBackendAuth) return null;
    return getBackendAuthUser() ?? null;
  });

  const refreshSession = useCallback(async (): Promise<string | null> => {
    const refreshed = await oidc.signinSilent();
    const refreshedToken =
      refreshed?.access_token ?? oidc.user?.access_token ?? null;
    if (refreshedToken) {
      setAuthAccessToken(refreshedToken);
    }
    return refreshedToken;
  }, [oidc]);

  const clearLocalAuthState = useCallback(() => {
    clearAuthAccessToken();
    clearBackendAuthUser();
    queryClient.clear();
    setIsBackendAuthorized(false);
    setBackendUser(null);
    setAuthorizationError(null);
    setAuthCheckedToken(null);
  }, []);

  const clearUnauthorizedSession = useCallback(async () => {
      if (skipAuth || isForcingLogout) {
        return;
      }

      setIsForcingLogout(true);
      clearLocalAuthState();

      try {
        await oidc.removeUser();
      } catch {
        // Ignore OIDC local cleanup failures and continue forced redirect.
      }

      if (window.location.pathname !== "/") {
        window.location.replace("/");
      }

      setIsForcingLogout(false);
    },
    [clearLocalAuthState, isForcingLogout, oidc, skipAuth],
  );

  const isUserNotAllowedError = useCallback((error: unknown): boolean => {
    if (!(error instanceof ApiError)) {
      return false;
    }

    return error.responseText.includes("user_not_allowed");
  }, []);

  useEffect(() => {
    if (!skipAuth) {
      return;
    }

    const token = createLocalDevAccessToken();
    setAuthAccessToken(token);
    setBackendAuthUser({
      id: LOCAL_DEV_USER.id,
      name: LOCAL_DEV_USER.name,
      email: LOCAL_DEV_USER.email,
      role: LOCAL_DEV_USER.role,
    });
    setIsBackendAuthorized(true);
    setBackendUser({
      id: LOCAL_DEV_USER.id,
      name: LOCAL_DEV_USER.name,
      email: LOCAL_DEV_USER.email,
      role: LOCAL_DEV_USER.role,
    });
    setAuthorizationError(null);
    setAuthCheckedToken(token);
  }, [skipAuth]);

  useEffect(() => {
    if (skipAuth) {
      return;
    }
    registerAuthRefreshHandler(async () => refreshSession());
    return () => {
      registerAuthRefreshHandler(null);
    };
  }, [refreshSession, skipAuth]);

  useEffect(() => {
    if (skipAuth) {
      return;
    }
    const token = oidc.user?.access_token;
    if (token) {
      setAuthAccessToken(token);
      return;
    }

    clearAuthAccessToken();
    setIsBackendAuthorized(false);
    setBackendUser(null);
    setAuthorizationError(null);
    setAuthCheckedToken(null);
  }, [oidc.user?.access_token, skipAuth]);

  useEffect(() => {
    if (skipAuth) {
      return;
    }
    const handleForcedLogout = (event: Event) => {
      const customEvent = event as CustomEvent<{ reason?: string }>;
      const reason = customEvent.detail?.reason;
      if (reason !== "user_not_allowed" && reason !== "unauthorized") {
        return;
      }

      void clearUnauthorizedSession();
    };

    window.addEventListener(AUTH_FORCED_LOGOUT_EVENT, handleForcedLogout);
    return () => {
      window.removeEventListener(AUTH_FORCED_LOGOUT_EVENT, handleForcedLogout);
    };
  }, [clearUnauthorizedSession, skipAuth]);

  useEffect(() => {
    function handleStorageEvent(event: StorageEvent): void {
      if (event.key !== AUTH_CACHE_STORAGE_KEY) {
        return;
      }

      syncAuthCacheFromStorage();
      const token = getAuthAccessToken({ allowExpired: true });
      if (!token) {
        setIsBackendAuthorized(false);
        setBackendUser(null);
        setAuthorizationError(null);
        setAuthCheckedToken(null);
      }
    }

    window.addEventListener("storage", handleStorageEvent);
    return () => {
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, []);

  const verifyBackendAuthorization = useCallback(async () => {
    if (skipAuth || !verifyBackendAuth) {
      return;
    }

    const oidcToken = oidc.user?.access_token;
    if (!oidc.isAuthenticated || !oidcToken) {
      setIsBackendAuthorized(false);
      setBackendUser(null);
      setAuthorizationError(null);
      setAuthCheckedToken(null);
      clearBackendAuthUser();
      return;
    }

    setAuthAccessToken(oidcToken);
    const token = getAuthAccessToken({ allowExpired: true });
    if (!token) {
      setIsBackendAuthorized(false);
      setBackendUser(null);
      setAuthorizationError(toUserMessage(null, "auth"));
      setAuthCheckedToken(null);
      return;
    }

    if (authCheckedToken === token) {
      return;
    }

    const cachedUser = getBackendAuthUser();
    if (cachedUser && !isAuthAccessTokenExpired()) {
      setIsBackendAuthorized(true);
      setBackendUser(cachedUser);
      setAuthorizationError(null);
      setAuthCheckedToken(token);
      return;
    }

    setIsVerifyingBackend(true);

    try {
      const { data: response, error: queryError } = await withTimeout(
        authMeQuery.refetch(),
        AUTH_ME_TIMEOUT_MS,
      );
      if (queryError) {
        throw queryError;
      }
      if (!response) {
        throw new Error("Missing auth response");
      }

      if (!response.authenticated || !response.user) {
        await clearUnauthorizedSession();
      } else {
        setIsBackendAuthorized(true);
        setBackendUser(response.user);
        setAuthorizationError(null);
        setBackendAuthUser(response.user);
      }
    } catch (error) {
      if (isUserNotAllowedError(error)) {
        await clearUnauthorizedSession();
        return;
      }

      setIsBackendAuthorized(false);
      setBackendUser(null);
      setAuthorizationError(toUserMessage(error, "auth"));
      clearBackendAuthUser();
    } finally {
      setAuthCheckedToken(getAuthAccessToken({ allowExpired: true }) ?? token);
      setIsVerifyingBackend(false);
    }
  }, [
    authCheckedToken,
    authMeQuery,
    oidc.isAuthenticated,
    oidc.user?.access_token,
    verifyBackendAuth,
    clearUnauthorizedSession,
    isUserNotAllowedError,
    skipAuth,
  ]);

  useEffect(() => {
    if (skipAuth || !verifyBackendAuth) {
      return;
    }

    void verifyBackendAuthorization();
  }, [skipAuth, verifyBackendAuth, verifyBackendAuthorization]);

  return useMemo<AuthContextValue>(() => {
    if (skipAuth) {
      return {
        user: LOCAL_DEV_USER,
        isAdmin: true,
        isLoading: false,
        isAuthenticated: true,
        error: null,
        loginWithSso: async () => {},
        logout: async () => {},
        refreshSession: async () => {},
      };
    }

    const profile = oidc.user?.profile;
    const oidcUser = oidc.isAuthenticated
      ? {
          id: String(profile?.sub ?? ""),
          name: String(profile?.name ?? profile?.preferred_username ?? "User"),
          email: String(profile?.email ?? ""),
          familyName: String(profile?.family_name ?? ""),
          role: resolveOidcRole(profile as Record<string, unknown> | undefined),
        }
      : null;

    const user = verifyBackendAuth
      ? backendUser
        ? {
            id: backendUser.id,
            name:
              backendUser.name ||
              String(profile?.name ?? profile?.preferred_username ?? "User"),
            email: backendUser.email || String(profile?.email ?? ""),
            familyName: String(profile?.family_name ?? ""),
            role: backendUser.role,
          }
        : null
      : oidcUser;

    return {
      user,
      isAdmin: user?.role === "admin",
      isLoading:
        oidc.isLoading ||
        Boolean(oidc.activeNavigator) ||
        isForcingLogout ||
        (verifyBackendAuth ? isVerifyingBackend : false),
      isAuthenticated: verifyBackendAuth
        ? oidc.isAuthenticated && isBackendAuthorized
        : oidc.isAuthenticated,
      error: verifyBackendAuth
        ? authorizationError ?? oidc.error?.message ?? null
        : oidc.error?.message ?? null,
      loginWithSso: async () => {
        await oidc.signinRedirect();
      },
      logout: async () => {
        clearLocalAuthState();
        await oidc.signoutRedirect();
      },
      refreshSession: async () => {
        await refreshSession();
      },
    };
  }, [
    authCheckedToken,
    backendUser,
    authorizationError,
    isVerifyingBackend,
    isBackendAuthorized,
    isForcingLogout,
    clearLocalAuthState,
    oidc,
    refreshSession,
    oidc.user?.access_token,
    verifyBackendAuth,
    skipAuth,
  ]);
}
