import { describe, expect, it } from "vitest";
import type { EffectiveResource, ProviderDefinition } from "@/lib/api/facade/aiResource";
import {
  compatibleModelResources,
  compatibleToolModelResources,
} from "../workerModelResources";

const geminiProvider: ProviderDefinition = {
  key: "gemini",
  displayName: "Gemini",
  modalities: ["chat"],
  credentialFields: [],
  defaultBaseUrl: "https://generativelanguage.googleapis.com",
  protocolAdapter: "gemini",
  supportsCustomEndpoint: false,
  supportsModelDiscovery: false,
};

const geminiResource: EffectiveResource = {
  selectable: true,
  blockingReason: "",
  connection: {
    id: 1,
    ownerScope: "user",
    identifier: "gemini-main",
    providerKey: "gemini",
    name: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    configuredFields: ["api_key"],
    status: "valid",
    isEnabled: true,
    validationError: "",
    canManage: true,
    resources: [],
  },
  resource: {
    id: 42,
    providerConnectionId: 1,
    identifier: "gemini-pro",
    modelId: "gemini-pro",
    displayName: "Gemini Pro",
    modalities: ["chat"],
    capabilities: ["text-generation"],
    defaultModalities: ["chat"],
    status: "valid",
    isEnabled: true,
    validationError: "",
  },
};

const minimaxProvider: ProviderDefinition = {
  ...geminiProvider,
  key: "minimax",
  displayName: "MiniMax",
  protocolAdapter: "minimax",
};

describe("workerModelResources", () => {
  it("allows selectable Gemini resources when exact model injection is supported", () => {
    expect(compatibleModelResources(
      [geminiResource],
      [geminiProvider],
      { required: true, protocolAdapters: ["gemini"] },
    )).toEqual([
      geminiResource,
    ]);
  });

  it("allows OpenAI-compatible resources for video-studio", () => {
    const openAIProvider: ProviderDefinition = {
      ...geminiProvider,
      key: "openai",
      protocolAdapter: "openai-compatible",
    };
    const openAIResource: EffectiveResource = {
      ...geminiResource,
      connection: {
        ...geminiResource.connection!,
        providerKey: "openai",
      },
    };

    expect(
      compatibleModelResources(
        [openAIResource],
        [openAIProvider],
        { required: true, protocolAdapters: ["openai-compatible"] },
      ),
    ).toEqual([openAIResource]);
  });

  it("uses Definition protocol adapters when they are provided", () => {
    const providers: ProviderDefinition[] = [
      { ...geminiProvider, key: "openai", protocolAdapter: "openai-compatible" },
      { ...geminiProvider, key: "anthropic", protocolAdapter: "anthropic" },
    ];
    const resources = providers.map((provider, index) => ({
      ...geminiResource,
      connection: {
        ...geminiResource.connection!,
        id: index + 1,
        providerKey: provider.key,
      },
      resource: {
        ...geminiResource.resource!,
        id: index + 10,
        providerConnectionId: index + 1,
      },
    }));
    expect(
      compatibleModelResources(
        resources,
        providers,
        { required: true, protocolAdapters: ["anthropic"] },
      ),
    ).toEqual([resources[1]]);
  });

  it("only accepts the declared OpenAI-compatible resource", () => {
    const providers: ProviderDefinition[] = [
      { ...geminiProvider, key: "openai", protocolAdapter: "openai-compatible" },
      { ...geminiProvider, key: "anthropic", protocolAdapter: "anthropic" },
      geminiProvider,
    ];
    const resources: EffectiveResource[] = providers.map((provider, index) => ({
      ...geminiResource,
      connection: {
        ...geminiResource.connection!,
        id: index + 1,
        providerKey: provider.key,
      },
      resource: {
        ...geminiResource.resource!,
        id: index + 10,
        providerConnectionId: index + 1,
      },
    }));

    expect(compatibleModelResources(
      resources,
      providers,
      { required: true, protocolAdapters: ["openai-compatible"] },
    )).toEqual([resources[0]]);
  });

  it("excludes MiniMax when the Definition only allows OpenAI-compatible and Anthropic models",
    () => {
      const providers: ProviderDefinition[] = [
        { ...geminiProvider, key: "openai", protocolAdapter: "openai-compatible" },
        { ...geminiProvider, key: "anthropic", protocolAdapter: "anthropic" },
        minimaxProvider,
      ];
      const resources = providers.map((provider, index) => ({
        ...geminiResource,
        connection: {
          ...geminiResource.connection!,
          id: index + 1,
          providerKey: provider.key,
        },
        resource: {
          ...geminiResource.resource!,
          id: index + 10,
          providerConnectionId: index + 1,
        },
      }));

      expect(compatibleModelResources(
        resources,
        providers,
        {
          required: true,
          protocolAdapters: ["openai-compatible", "anthropic"],
        },
      )).toEqual([resources[0], resources[1]]);
    },
  );

  it("allows selectable MiniMax resources for MiniMax CLI", () => {
    const minimaxResource: EffectiveResource = {
      ...geminiResource,
      connection: {
        ...geminiResource.connection!,
        providerKey: "minimax",
      },
    };

    expect(compatibleModelResources(
      [minimaxResource],
      [minimaxProvider],
      { required: true, protocolAdapters: ["minimax"] },
    )).toEqual([
      minimaxResource,
    ]);
  });

  it("does not offer MiniMax chat resources to a worker that excludes the minimax adapter", () => {
    const minimaxResource: EffectiveResource = {
      ...geminiResource,
      connection: {
        ...geminiResource.connection!,
        providerKey: "minimax",
      },
    };

    expect(
      compatibleModelResources(
        [minimaxResource],
        [minimaxProvider],
        { required: true, protocolAdapters: ["openai-compatible", "anthropic"] },
      ),
    ).toEqual([]);
  });

  it("returns nothing when the worker does not require a model resource", () => {
    expect(
      compatibleModelResources(
        [geminiResource],
        [geminiProvider],
        { required: false, protocolAdapters: ["gemini"] },
      ),
    ).toEqual([]);
  });

  it("allows declared Doubao and Sub2API Seedance video resources", () => {
    const video = {
      ...geminiResource,
      connection: {
        ...geminiResource.connection!,
        providerKey: "doubao",
      },
      resource: {
        ...geminiResource.resource!,
        id: 77,
        modelId: "doubao-seedance-2-0-260128",
        modalities: ["video"],
        capabilities: ["video-generation"],
      },
    };
    const languageModelMarkedAsVideo = {
      ...video,
      resource: {
        ...video.resource!,
        id: 78,
        modelId: "doubao-seed-1-8-251228",
      },
    };
    const sub2apiVideo = {
      ...video,
      connection: {
        ...video.connection!,
        id: 2,
        providerKey: "sub2api-seedance",
        name: "Sub2API Seedance",
      },
      resource: {
        ...video.resource!,
        id: 79,
        providerConnectionId: 2,
        modelId: "doubao-seedance-2-0-260128",
      },
    };
    const sub2apiInvalidModelID = {
      ...sub2apiVideo,
      resource: {
        ...sub2apiVideo.resource!,
        id: 80,
        modelId: "doubao-seedance-2-0-260128-preview",
      },
    };

    expect(compatibleToolModelResources({
      role: "seedance-video",
      provider_keys: ["doubao", "sub2api-seedance"],
      protocol_adapters: ["openai-compatible", "ark-seedance"],
      modality: "video",
      capability: "video-generation",
    }, [
      geminiResource,
      languageModelMarkedAsVideo,
      video,
      sub2apiVideo,
      sub2apiInvalidModelID,
    ])).toEqual([
      video,
      sub2apiVideo,
    ]);
  });
});
