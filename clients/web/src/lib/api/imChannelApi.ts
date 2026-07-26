import { lightFetch } from "@/lib/light-auth/api-fetch";
import { imChannelsBasePath } from "@/lib/api/imChannelApiBase";

export type IMProviderType = "feishu" | "dingtalk" | "wecom" | "slack" | "weixin" | "wechat";
export type IMConnectionStatus = "disabled" | "active" | "error";

export interface IMProviderMeta {
  type: IMProviderType;
  display_name: string;
}

export type IMDMPolicy = "pairing" | "open" | "allowlist" | "disabled" | "guest";
export type IMGroupPolicy = "open" | "allowlist" | "disabled";
export type IMLocale = "en" | "zh-CN";

export interface IMConnection {
  id: number;
  organization_id: number;
  provider: IMProviderType;
  name: string;
  channel_id?: number | null;
  config: Record<string, unknown>;
  status: IMConnectionStatus;
  transport?: string;
  dm_policy?: IMDMPolicy;
  group_policy?: IMGroupPolicy;
  allow_from?: string[] | unknown;
  streaming_mode?: string;
  locale?: IMLocale;
  last_error?: string | null;
  created_by_user_id: number;
  created_at: string;
  updated_at: string;
  webhook_url?: string;
}

export interface CreateIMConnectionInput {
  provider: IMProviderType;
  name: string;
  channel_id?: number;
  config: Record<string, unknown>;
  status?: IMConnectionStatus;
  dm_policy?: IMDMPolicy;
  group_policy?: IMGroupPolicy;
  allow_from?: string[];
  transport?: string;
  locale?: IMLocale;
}

export interface UpdateIMConnectionInput {
  name?: string;
  channel_id?: number | null;
  config?: Record<string, unknown>;
  status?: IMConnectionStatus;
  dm_policy?: IMDMPolicy;
  group_policy?: IMGroupPolicy;
  allow_from?: string[];
  transport?: string;
  locale?: IMLocale;
}

function base(): string {
  return imChannelsBasePath();
}

export async function listIMProviders(): Promise<IMProviderMeta[]> {
  const res = await lightFetch<{ providers: IMProviderMeta[] }>(`${base()}/providers`, {
    authenticated: true,
  });
  return res.providers ?? [];
}

export async function listIMConnections(): Promise<IMConnection[]> {
  const res = await lightFetch<{ connections: IMConnection[] }>(base(), {
    authenticated: true,
  });
  return res.connections ?? [];
}

export async function getIMConnection(id: number): Promise<IMConnection> {
  const res = await lightFetch<{ connection: IMConnection }>(`${base()}/${id}`, {
    authenticated: true,
  });
  return res.connection;
}

export async function createIMConnection(input: CreateIMConnectionInput): Promise<IMConnection> {
  const res = await lightFetch<{ connection: IMConnection }>(base(), {
    method: "POST",
    authenticated: true,
    body: JSON.stringify(input),
  });
  return res.connection;
}

export async function updateIMConnection(
  id: number,
  input: UpdateIMConnectionInput
): Promise<IMConnection> {
  const res = await lightFetch<{ connection: IMConnection }>(`${base()}/${id}`, {
    method: "PATCH",
    authenticated: true,
    body: JSON.stringify(input),
  });
  return res.connection;
}

export async function deleteIMConnection(id: number): Promise<void> {
  await lightFetch(`${base()}/${id}`, {
    method: "DELETE",
    authenticated: true,
  });
}

export interface WeixinQRStartResponse {
  session_id: string;
  status: string;
  qrcode_url?: string;
  qrcode?: string;
  expires_at?: number;
  poll_interval_ms?: number;
  connection_id: number;
}

export interface WeixinQRStatusResponse {
  session_id: string;
  status: string;
  message?: string;
  qrcode_url?: string;
  qrcode?: string;
  expires_at?: number;
  connection_id?: number;
  account_id?: string;
}

export async function startWeixinQRLogin(connectionId: number): Promise<WeixinQRStartResponse> {
  return lightFetch<WeixinQRStartResponse>(`${base()}/weixin/qr/start`, {
    method: "POST",
    authenticated: true,
    body: JSON.stringify({ connection_id: connectionId }),
  });
}

export async function pollWeixinQRLogin(sessionId: string): Promise<WeixinQRStatusResponse> {
  return lightFetch<WeixinQRStatusResponse>(`${base()}/weixin/qr/${sessionId}/status`, {
    authenticated: true,
  });
}

export function weixinQRImageUrl(sessionId: string): string {
  return `${base()}/weixin/qr/${sessionId}/image`;
}

export const IM_CONFIG_EXAMPLES: Record<IMProviderType, Record<string, unknown>> = {
  feishu: {
    app_id: "",
    app_secret: "",
    verification_token: "",
    encrypt_key: "",
    default_chat_id: "",
  },
  dingtalk: {
    app_key: "",
    app_secret: "",
    signing_secret: "",
    webhook_url: "",
  },
  wecom: {
    corp_id: "",
    corp_secret: "",
    token: "",
    encoding_aes_key: "",
    agent_id: 0,
  },
  slack: {
    bot_token: "",
    signing_secret: "",
    default_channel: "",
  },
  weixin: {},
  wechat: {},
};
