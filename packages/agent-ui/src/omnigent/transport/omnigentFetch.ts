/**
 * The host's sole transport obligation: resolve an Omnigent API path against
 * its base URL and attach credentials. agent-ui never reads tokens or
 * storage itself, so embedded hosts can substitute their own channel.
 */
export type OmnigentFetch = (
  path: string,
  init?: RequestInit,
) => Promise<Response>;

/**
 * Carries the server's machine-readable `code` so callers branch on the
 * failure kind rather than string-matching the status line. The server
 * serializes errors as `{"error": {"code", "message"}}`; `code` is `null`
 * when the body wasn't in that shape.
 */
export class OmnigentApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = "OmnigentApiError";
    this.status = status;
    this.code = code;
  }
}

export async function omnigentJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw await omnigentApiError(response);
  return (await response.json()) as T;
}

export async function omnigentApiError(
  response: Response,
): Promise<OmnigentApiError> {
  let message = `${response.status} ${response.statusText}`;
  let code: string | null = null;
  try {
    const body = (await response.json()) as {
      error?: { code?: string; message?: string };
    };
    if (body.error?.message) message = body.error.message;
    if (body.error?.code) code = body.error.code;
  } catch {
    // Non-JSON or empty body — keep the status-line fallback.
  }
  return new OmnigentApiError(message, response.status, code);
}
