import { resolveLightBaseUrl } from "@/lib/light-session";
import {
  authenticatedFetch,
  readJsonResponse,
} from "@/lib/api/authenticatedRequest";
import { ApiError } from "@/lib/api/api-types";

export class MarketplaceRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MarketplaceRequestError";
  }
}

async function parseMarketplaceResponse<T>(
  response: Response,
): Promise<T> {
  return readJsonResponse<T>(response);
}

function mapMarketplaceError(error: unknown): never {
  if (error instanceof ApiError) {
    throw new MarketplaceRequestError(
      error.code ?? "MARKETPLACE_REQUEST_FAILED",
      error.serverMessage ?? "市场服务暂时不可用",
    );
  }
  throw error;
}

export async function publicMarketplaceRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const baseURL = resolveLightBaseUrl();
  const response = await fetch(`${baseURL}/api/marketplace/v1${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const error = payload?.error;
    throw new MarketplaceRequestError(
      error?.code ?? "MARKETPLACE_REQUEST_FAILED",
      error?.message ?? "市场服务暂时不可用",
    );
  }
  return parseMarketplaceResponse<T>(response);
}

export async function authenticatedMarketplaceRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const baseURL = resolveLightBaseUrl();
  try {
    const response = await authenticatedFetch(
      `${baseURL}/api/marketplace/v1${path}`,
      {
        ...init,
        headers: {
          Accept: "application/json",
          ...init.headers,
        },
      },
    );
    return parseMarketplaceResponse<T>(response);
  } catch (error) {
    return mapMarketplaceError(error);
  }
}
