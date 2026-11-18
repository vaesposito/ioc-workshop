import { WebStorageStateStore } from "oidc-client-ts";
import { AuthProviderProps } from "react-oidc-context";

const origin = `${window.location.protocol}//${window.location.host}`;

export const defaultAuthConfigOptionsOIDC: Partial<AuthProviderProps> = {
  scope: "profile openid email offline_access",
  // Use a dedicated callback route so OIDC response handling is deterministic.
  redirect_uri: `${origin}/callback`,
  post_logout_redirect_uri: `${origin}/`,
  automaticSilentRenew: true,
  response_type: "code",
  loadUserInfo: true,
  userStore: new WebStorageStateStore({ store: localStorage }),
  stateStore: new WebStorageStateStore({ store: localStorage }),
  extraQueryParams: { audience: "api://default" },
};
