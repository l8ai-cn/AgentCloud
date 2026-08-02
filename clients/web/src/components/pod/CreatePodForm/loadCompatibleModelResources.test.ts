import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getCatalog: vi.fn(),
  listOrganizationEffectiveResources: vi.fn(),
  listPersonalEffectiveResources: vi.fn(),
}));

vi.mock("@/lib/api/facade/aiResourceConnect", () => api);

import { loadCompatibleModelResources } from "./loadCompatibleModelResources";

describe("loadCompatibleModelResources", () => {
  beforeEach(() => {
    Object.values(api).forEach((method) => method.mockReset());
    api.getCatalog.mockResolvedValue([
      { key: "openai", protocolAdapter: "openai-compatible" },
      { key: "anthropic", protocolAdapter: "anthropic" },
    ]);
  });

  it("filters org models by protocol adapters when required", async () => {
    api.listOrganizationEffectiveResources.mockResolvedValue([
      selectable("openai", 1),
      selectable("anthropic", 2),
    ]);

    const resources = await loadCompatibleModelResources({
      orgSlug: "acme",
      requirement: {
        required: true,
        protocolAdapters: ["openai-compatible"],
      },
    });

    expect(resources.map((item) => item.resource?.id)).toEqual([1]);
  });

  it("returns selectable chat models when adapters are empty", async () => {
    api.listOrganizationEffectiveResources.mockResolvedValue([
      selectable("openai", 1),
    ]);

    const resources = await loadCompatibleModelResources({
      orgSlug: "acme",
      requirement: { required: true, protocolAdapters: [] },
    });

    expect(resources).toHaveLength(1);
  });
});

function selectable(providerKey: string, id: number) {
  return {
    selectable: true,
    blockingReason: "",
    connection: {
      providerKey,
      isEnabled: true,
      name: "conn",
    },
    resource: {
      id,
      isEnabled: true,
      modalities: ["chat"],
      capabilities: ["text-generation"],
      displayName: `model-${id}`,
      modelId: `model-${id}`,
    },
  };
}
