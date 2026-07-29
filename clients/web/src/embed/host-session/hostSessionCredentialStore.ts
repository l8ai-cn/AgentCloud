import type { HostSessionCredential } from "./hostSessionHandshake";

export interface HostSessionIdentity {
  orgSlug: string;
  podKey: string;
}

export type HostSessionCredentialUpdate =
  | { kind: "established"; identity: HostSessionIdentity }
  | { kind: "rotated" }
  | { kind: "identity-conflict" };

export interface HostSessionCredentialStore {
  accept(credential: HostSessionCredential): HostSessionCredentialUpdate;
  getAccessToken(): string;
}

// AMP issues no refresh_token, so the host re-pushes a fresh bearer on rotation.
// Keeping it behind a stable `getAccessToken` reference lets every consumer read
// the current value without React re-creating the live session runtime.
export function createHostSessionCredentialStore(): HostSessionCredentialStore {
  let accessToken = "";
  let identity: HostSessionIdentity | null = null;
  const getAccessToken = () => {
    if (!accessToken) {
      throw new Error("host_session_credential_missing");
    }
    return accessToken;
  };
  return {
    accept(credential) {
      const next: HostSessionIdentity = {
        orgSlug: credential.orgSlug,
        podKey: credential.podKey,
      };
      if (
        identity &&
        (identity.orgSlug !== next.orgSlug || identity.podKey !== next.podKey)
      ) {
        return { kind: "identity-conflict" };
      }
      accessToken = credential.accessToken;
      if (identity) {
        return { kind: "rotated" };
      }
      identity = next;
      return { kind: "established", identity: next };
    },
    getAccessToken,
  };
}
