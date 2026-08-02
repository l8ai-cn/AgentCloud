import initWasm, {
  WasmApiClient,
  type WasmPodService,
} from "agent-cloud-wasm";
import { getMobileAuthManager, mobileAuthBaseUrl } from "./mobile-auth-manager";
import type { MobileAcpManager } from "./mobile-acp-session";
import { createInMemoryMobileAcpManager } from "./mobile-in-memory-acp-manager";

let apiClientPromise: Promise<WasmApiClient> | undefined;
let podServicePromise: Promise<WasmPodService> | undefined;
let acpManagerPromise: Promise<MobileAcpManager> | undefined;

export function getMobileApiClient(): Promise<WasmApiClient> {
  if (!apiClientPromise) {
    apiClientPromise = (async () => {
      await initWasm();
      return new WasmApiClient(mobileAuthBaseUrl(), await getMobileAuthManager());
    })();
  }
  return apiClientPromise;
}

export function getMobilePodService(): Promise<WasmPodService> {
  if (!podServicePromise) {
    podServicePromise = getMobileApiClient().then((client) => client.create_pod_service());
  }
  return podServicePromise;
}

/** Local ACP view cache — Wasm ACP manager was removed with the V1 stack. */
export function getMobileAcpManager(): Promise<MobileAcpManager> {
  if (!acpManagerPromise) {
    acpManagerPromise = Promise.resolve(createInMemoryMobileAcpManager());
  }
  return acpManagerPromise;
}
