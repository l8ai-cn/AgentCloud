import { lightFetch } from "@/lib/light-auth/api-fetch";
import { imChannelsBasePath } from "@/lib/api/imChannelApiBase";

function base(): string {
  return imChannelsBasePath();
}

export interface IMIdentityBinding {
  id: number;
  connection_id: number;
  external_user_id: string;
  external_name?: string | null;
  user_id?: number | null;
  status: string;
  pairing_code?: string | null;
  pairing_expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface IMRouteBinding {
  id: number;
  connection_id: number;
  peer_kind: string;
  peer_id?: string | null;
  target_kind: string;
  target_ref: string;
  require_mention: boolean;
  priority: number;
  created_at: string;
}

export interface CreateIMRouteBindingInput {
  peer_kind?: string;
  peer_id?: string;
  target_kind?: string;
  target_ref: string;
  require_mention?: boolean;
  priority?: number;
}

export async function pairIMIdentity(code: string): Promise<IMIdentityBinding> {
  const res = await lightFetch<{ binding: IMIdentityBinding }>(`${base()}/pair`, {
    method: "POST",
    authenticated: true,
    body: JSON.stringify({ code }),
  });
  return res.binding;
}

export async function listIMIdentityBindings(
  connectionId: number
): Promise<IMIdentityBinding[]> {
  const res = await lightFetch<{ bindings: IMIdentityBinding[] }>(
    `${base()}/${connectionId}/bindings`,
    { authenticated: true }
  );
  return res.bindings ?? [];
}

export async function listIMRouteBindings(connectionId: number): Promise<IMRouteBinding[]> {
  const res = await lightFetch<{ routes: IMRouteBinding[] }>(
    `${base()}/${connectionId}/routes`,
    { authenticated: true }
  );
  return res.routes ?? [];
}

export async function createIMRouteBinding(
  connectionId: number,
  input: CreateIMRouteBindingInput
): Promise<IMRouteBinding> {
  const res = await lightFetch<{ route: IMRouteBinding }>(
    `${base()}/${connectionId}/routes`,
    {
      method: "POST",
      authenticated: true,
      body: JSON.stringify(input),
    }
  );
  return res.route;
}

export async function deleteIMRouteBinding(
  connectionId: number,
  routeId: number
): Promise<void> {
  await lightFetch(`${base()}/${connectionId}/routes/${routeId}`, {
    method: "DELETE",
    authenticated: true,
  });
}
