export interface EmbeddedSessionApiRoute {
  requestHeaders: Readonly<Record<string, string>>;
  sessionPath: string;
}

export function embedCapabilitySessionRoute(sessionId: string): EmbeddedSessionApiRoute {
  return {
    requestHeaders: {},
    sessionPath: `/v1/embed/sessions/${encodeURIComponent(sessionId)}`,
  };
}

// A host-supplied user bearer is rejected by `/v1/embed/**`, which only accepts
// capability tokens minted by the redeem endpoint. The equivalent org-scoped
// routes serve the same handlers but resolve the tenant from a header.
export function orgMemberSessionRoute(
  sessionId: string,
  orgSlug: string,
): EmbeddedSessionApiRoute {
  return {
    requestHeaders: { "X-Organization-Slug": orgSlug },
    sessionPath: `/v1/sessions/${encodeURIComponent(sessionId)}`,
  };
}
