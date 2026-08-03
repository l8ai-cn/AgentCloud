import { describe, it, expect, beforeEach, vi } from "vitest";
import { act } from "@testing-library/react";
import { create, toBinary } from "@bufbuild/protobuf";
import { UpdatePodPerpetualResponseSchema } from "@proto/pod/v1/pod_pb";
import { usePodStore } from "../pod";
import { getPodService } from "@/lib/wasm-core";
import {
  mockPod,
  resetPodStore,
  podStateMock,
  lastPatchPodPerpetual,
} from "./pod-test-utils";

interface MockService {
  update_pod_perpetual_connect: ReturnType<typeof vi.fn>;
}

function svc(): MockService {
  return getPodService() as unknown as MockService;
}

const okBytes = () =>
  toBinary(
    UpdatePodPerpetualResponseSchema,
    create(UpdatePodPerpetualResponseSchema, { message: "ok" }),
  );

beforeEach(async () => {
  await resetPodStore();
  vi.mocked(svc().update_pod_perpetual_connect).mockResolvedValue(okBytes());
});

describe("Pod Store — updatePodPerpetual", () => {
  it("calls Connect adapter and patches perpetual on the cache", async () => {
    await act(async () => {
      await usePodStore.getState().updatePodPerpetual(mockPod.pod_key, true);
    });

    expect(svc().update_pod_perpetual_connect).toHaveBeenCalledTimes(1);
    expect(podStateMock().patch_pod_perpetual).toHaveBeenCalledTimes(1);
    const patch = lastPatchPodPerpetual();
    expect(patch?.pod_key).toBe(mockPod.pod_key);
    expect(patch?.perpetual).toBe(true);
  });

  it("flips perpetual to false", async () => {
    await act(async () => {
      await usePodStore.getState().updatePodPerpetual(mockPod.pod_key, false);
    });

    const patch = lastPatchPodPerpetual();
    expect(patch?.perpetual).toBe(false);
  });

  it("records the error and rethrows when the API call fails", async () => {
    svc().update_pod_perpetual_connect.mockRejectedValue(new Error("Server error"));

    await act(async () => {
      await expect(
        usePodStore.getState().updatePodPerpetual(mockPod.pod_key, true),
      ).rejects.toThrow("Server error");
    });

    // Cache must not be patched when the network call fails.
    expect(podStateMock().patch_pod_perpetual).not.toHaveBeenCalled();
    expect(usePodStore.getState().error).toContain("Server error");
  });

  it("still patches the cache even when the pod is not in WASM state", async () => {
    // Production updatePodPerpetual doesn't consult get_pod_json — it
    // simply hands the patch to the wasm side. The bridge is responsible
    // for ignoring patches against unknown pod_keys; the store doesn't
    // short-circuit. This matches the wasm-side `patch_pod_perpetual`
    // contract (no-op on missing key) and keeps the store mutator pure.
    await act(async () => {
      await usePodStore.getState().updatePodPerpetual("missing-pod", true);
    });

    expect(svc().update_pod_perpetual_connect).toHaveBeenCalledTimes(1);
    expect(podStateMock().patch_pod_perpetual).toHaveBeenCalledTimes(1);
    expect(lastPatchPodPerpetual()?.pod_key).toBe("missing-pod");
  });
});
