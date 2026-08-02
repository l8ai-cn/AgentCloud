import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkerCreateOptions } from "@/lib/api/facade/podConnect";
import {
  loadWorkerCreateOptions,
  useWorkerCreateOptions,
} from "./useWorkerCreateOptions";

const listWorkerCreateOptions = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/facade/podConnect", () => ({
  listWorkerCreateOptions,
}));

describe("useWorkerCreateOptions", () => {
  beforeEach(() => {
    listWorkerCreateOptions.mockReset();
    listWorkerCreateOptions.mockImplementation(async (orgSlug: string) =>
      options(orgSlug)
    );
  });

  it("isolates loaded options by organization", async () => {
    const selection = {
      workerTypeSlug: "",
      computeTargetId: 0,
      deploymentMode: "",
    };
    const { result, rerender } = renderHook(
      ({ orgSlug }) => useWorkerCreateOptions(true, orgSlug, selection),
      { initialProps: { orgSlug: "acme" } },
    );

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    expect(result.current.status === "ready" && result.current.data.revision)
      .toBe("acme-revision");

    rerender({ orgSlug: "globex" });
    expect(result.current.status).toBe("loading");
    await waitFor(() => {
      expect(result.current.status === "ready" && result.current.data.revision)
        .toBe("globex-revision");
    });
    expect(listWorkerCreateOptions.mock.calls.map(([orgSlug]) => orgSlug))
      .toEqual(["acme", "globex"]);
  });

  it("keeps the full runtime image list after a worker-type filter", async () => {
    const base = options("acme");
    base.runtime_images = [
      runtimeImage(1, "Codex", "codex-cli"),
      runtimeImage(16, "E2E Echo", "e2e-echo"),
    ];
    const filtered = options("acme");
    filtered.runtime_images = [base.runtime_images[0]];
    filtered.deployment_modes = [
      { value: "pooled", name: "Shared", selectable: true, blocking_reason: "" },
    ];
    listWorkerCreateOptions
      .mockResolvedValueOnce(base)
      .mockResolvedValueOnce(filtered);

    const merged = await loadWorkerCreateOptions("acme", {
      workerTypeSlug: "codex-cli",
      computeTargetId: 0,
      deploymentMode: "",
    });

    expect(merged.runtime_images).toHaveLength(2);
    expect(merged.runtime_images.map((image) => image.id)).toEqual([1, 16]);
    expect(merged.deployment_modes).toEqual(filtered.deployment_modes);
  });
});

function options(orgSlug: string): WorkerCreateOptions {
  return {
    revision: `${orgSlug}-revision`,
    worker_types: [],
    runtime_images: [],
    compute_targets: [],
    deployment_modes: [],
    resource_profiles: [],
  };
}

function runtimeImage(
  id: number,
  name: string,
  workerType: string,
): WorkerCreateOptions["runtime_images"][number] {
  return {
    id,
    slug: `${workerType}-local`,
    name,
    reference: `docker://${workerType}`,
    digest: `sha256:${id}`,
    worker_type_slugs: [workerType],
    selectable: true,
    blocking_reason: "",
  };
}
