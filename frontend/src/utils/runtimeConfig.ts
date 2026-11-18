type RuntimeConfig = {
  VITE_API_BASE_URL: string;
  VITE_OIDC_AUTHORITY: string;
  VITE_OIDC_CLIENT_ID: string;
  VITE_OIDC_REDIRECT_URI: string;
  VITE_OIDC_POST_LOGOUT_REDIRECT_URI: string;
};

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: Partial<RuntimeConfig>;
  }
}

function resolveValue(
  runtimeValue: string | undefined,
  fallbackValue: string | undefined,
): string {
  const candidate = runtimeValue?.trim() || fallbackValue?.trim() || "";
  return candidate;
}

export function getRuntimeConfig(): RuntimeConfig {
  const runtimeConfigSource =
    typeof window !== "undefined" ? window.__RUNTIME_CONFIG__ : undefined;

  return {
    VITE_API_BASE_URL: resolveValue(
      runtimeConfigSource?.VITE_API_BASE_URL,
      import.meta.env.VITE_API_BASE_URL as string | undefined,
    ),
    VITE_OIDC_AUTHORITY: resolveValue(
      runtimeConfigSource?.VITE_OIDC_AUTHORITY,
      import.meta.env.VITE_OIDC_AUTHORITY as string | undefined,
    ),
    VITE_OIDC_CLIENT_ID: resolveValue(
      runtimeConfigSource?.VITE_OIDC_CLIENT_ID,
      import.meta.env.VITE_OIDC_CLIENT_ID as string | undefined,
    ),
    VITE_OIDC_REDIRECT_URI: resolveValue(
      runtimeConfigSource?.VITE_OIDC_REDIRECT_URI,
      import.meta.env.VITE_OIDC_REDIRECT_URI as string | undefined,
    ),
    VITE_OIDC_POST_LOGOUT_REDIRECT_URI: resolveValue(
      runtimeConfigSource?.VITE_OIDC_POST_LOGOUT_REDIRECT_URI,
      import.meta.env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI as string | undefined,
    ),
  };
}
