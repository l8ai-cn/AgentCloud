import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/test-utils";
import { createWorkerTemplateDraft } from "./worker-template-draft";
import { WorkerTemplateIdentityPanel } from "./WorkerTemplateIdentityPanel";

vi.mock("./WorkerTemplateModelBindingField", () => ({
  WorkerTemplateModelBindingField: () => (
    <div data-testid="model-binding-field" />
  ),
}));

describe("WorkerTemplateIdentityPanel", () => {
  it("marks model binding as required for Worker types that need a model", () => {
    const { container } = render(
      <WorkerTemplateIdentityPanel
        draft={createWorkerTemplateDraft("acme")}
        catalog={{
          loading: false,
          error: null,
          errorsByKind: {},
          byKind: {},
        }}
        orgSlug="acme"
        modelRequired
        protocolAdapters={["openai-compatible"]}
        onCatalogInvalidate={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    expect(container.querySelector("#resource-name")).toBeTruthy();
    expect(
      container.querySelector('[data-testid="model-binding-field"]'),
    ).toBeTruthy();
  });
});
