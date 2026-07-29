import { getApiBaseUrl } from "@/lib/env";
import {
  authenticatedOrganizationFetch,
  readJsonResponse,
} from "./authenticatedRequest";

export type OrgLiveModelUsage = {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens?: number;
  cache_creation_tokens?: number;
  total_cost_usd?: number;
};

export type OrgLiveUsageSummary = {
  object?: string;
  total_cost_usd?: number;
  usage_by_model?: Record<string, OrgLiveModelUsage>;
};

export async function fetchOrgLiveUsageSummary(): Promise<OrgLiveUsageSummary | null> {
  const base = getApiBaseUrl().replace(/\/$/, "");
  const response = await authenticatedOrganizationFetch(
    `${base}/v1/org/usage/summary`,
  );
  if (response.status === 204) return null;
  return readJsonResponse<OrgLiveUsageSummary>(response);
}
