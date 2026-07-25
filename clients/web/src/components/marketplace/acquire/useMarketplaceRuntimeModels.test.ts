import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  listMarketplaceModelResources,
  marketplaceWorkerRequiresModelResource,
} from "@/lib/marketplace-model-resources";
import { useMarketplaceRuntimeModels } from "./useMarketplaceRuntimeModels";

vi.mock("@/lib/marketplace-model-resources", () => ({
  listMarketplaceModelResources: vi.fn(),
  marketplaceWorkerRequiresModelResource: vi.fn(() => true),
}));

const listModels = vi.mocked(listMarketplaceModelResources);
const requiresModel = vi.mocked(marketplaceWorkerRequiresModelResource);

describe("useMarketplaceRuntimeModels", () => {
  beforeEach(() => {
    listModels.mockReset();
    requiresModel.mockReset();
    requiresModel.mockReturnValue(true);
  });

  it("clears resources and selection when the organization changes", async () => {
    listModels.mockResolvedValueOnce([{ id: 1, label: "Model A" }]);
    const { result, rerender } = renderHook(
      ({ organization }) =>
        useMarketplaceRuntimeModels(organization, "video-studio"),
      { initialProps: { organization: "org-a" } },
    );

    await waitFor(() => expect(result.current.loadingModels).toBe(false));
    act(() => result.current.setModelResourceID("1"));
    expect(result.current.modelResourceID).toBe("1");

    listModels.mockResolvedValueOnce([{ id: 2, label: "Model B" }]);
    rerender({ organization: "org-b" });

    expect(result.current.modelResourceID).toBe("");
    expect(result.current.modelResources).toEqual([]);
    expect(result.current.loadingModels).toBe(true);
    await waitFor(() => {
      expect(result.current.modelResources).toEqual([{ id: 2, label: "Model B" }]);
    });
  });

  it("ignores a response from the previous organization", async () => {
    let resolveOld: (items: Array<{ id: number; label: string }>) => void = () => {};
    listModels.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveOld = resolve;
      }),
    );
    const { result, rerender } = renderHook(
      ({ organization }) =>
        useMarketplaceRuntimeModels(organization, "video-studio"),
      { initialProps: { organization: "org-a" } },
    );

    listModels.mockResolvedValueOnce([{ id: 2, label: "Model B" }]);
    rerender({ organization: "org-b" });
    await waitFor(() => expect(result.current.loadingModels).toBe(false));

    await act(async () => {
      resolveOld([{ id: 1, label: "Model A" }]);
      await Promise.resolve();
    });
    expect(result.current.modelResources).toEqual([{ id: 2, label: "Model B" }]);
  });

  it("surfaces a catalog miss without throwing or loading models", () => {
    requiresModel.mockReturnValue(null);
    const { result } = renderHook(() =>
      useMarketplaceRuntimeModels("acme", "ghost-worker"),
    );
    expect(result.current.loadingModels).toBe(false);
    expect(result.current.modelError).toBe(true);
    expect(result.current.missingCompatibleResource).toBe(true);
    expect(listModels).not.toHaveBeenCalled();
  });
});
