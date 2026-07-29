import { getAuthManager } from "@/lib/wasm-core";
import { readCurrentOrg, useAuthStore } from "@/stores/auth";
import { ApiError, type ApiErrorData } from "./api-types";

let logoutPromise: Promise<void> | null = null;

function authError(): ApiError {
  return new ApiError(401, "Unauthorized", {
    code: "AUTH_REQUIRED",
    error: "Authentication required",
  });
}

function orgError(): ApiError {
  return new ApiError(400, "Bad Request", {
    code: "VALIDATION_FAILED",
    error: "Current organization is required",
  });
}

function readToken(): string {
  try {
    const token = getAuthManager().get_token();
    if (token) return token;
  } catch {
    // The typed auth error below is the public contract.
  }
  throw authError();
}

async function parseErrorData(response: Response): Promise<ApiErrorData> {
  const text = await response.text();
  if (!text) return {};
  try {
    const body = JSON.parse(text) as Record<string, unknown>;
    const nested = body.error;
    if (nested && typeof nested === "object") {
      const error = nested as Record<string, unknown>;
      return {
        ...body,
        code: typeof error.code === "string" ? error.code : undefined,
        error: typeof error.message === "string" ? error.message : text,
      };
    }
    return {
      ...body,
      code: typeof body.code === "string" ? body.code : undefined,
      error:
        typeof body.error === "string"
          ? body.error
          : typeof body.message === "string"
            ? body.message
            : text,
    };
  } catch {
    return { error: text };
  }
}

function invalidateSession(): void {
  if (logoutPromise) return;
  logoutPromise = useAuthStore
    .getState()
    .logout()
    .catch(() => undefined)
    .finally(() => {
      logoutPromise = null;
    });
}

async function request(
  url: string,
  init: RequestInit,
  token: string,
  orgSlug?: string,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (orgSlug) headers.set("X-Organization-Slug", orgSlug);
  if (
    init.body !== undefined &&
    !(typeof FormData !== "undefined" && init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, { ...init, headers });
  if (response.ok) return response;

  const data = await parseErrorData(response);
  if (response.status === 401) invalidateSession();
  throw new ApiError(response.status, response.statusText, data);
}

export async function authenticatedFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  return request(url, init, readToken());
}

export function requireCurrentOrganizationSlug(): string {
  const orgSlug = readCurrentOrg()?.slug;
  if (!orgSlug) throw orgError();
  return orgSlug;
}

export async function authenticatedOrganizationFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = readToken();
  return request(url, init, token, requireCurrentOrganizationSlug());
}

export async function readJsonResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}
