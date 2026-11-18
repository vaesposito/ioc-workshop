/// <reference types="vite/client" />

// The demo is static by construction. Only the dev-server port is configurable;
// everything else that used to be an env flag is now a constant in the code.
interface ImportMetaEnv {
  readonly VITE_APP_CLIENT_PORT?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_OIDC_AUTHORITY?: string;
  readonly VITE_OIDC_CLIENT_ID?: string;
  readonly VITE_OIDC_REDIRECT_URI?: string;
  readonly VITE_OIDC_POST_LOGOUT_REDIRECT_URI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
