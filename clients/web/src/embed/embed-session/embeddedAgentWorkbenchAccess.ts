import type { EmbeddedSessionApiRoute } from "./embeddedSessionApiRoute";

export interface EmbeddedAgentWorkbenchAccess {
  baseUrl: string;
  getAccessToken: () => Promise<string> | string;
  orgSlug: string;
  sessionApi: EmbeddedSessionApiRoute;
  sessionId: string;
}
