import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";

import { OrganizationStep } from "./MarketplaceAcquireOrganizationStep";
import { SuccessState } from "./MarketplaceAcquireStates";

describe("MarketplaceAcquireStates", () => {
  it("sends a successful acquisition to the partner detail", () => {
    render(
      <SuccessState
        organization={{ id: 9, slug: "dev-org", name: "研发组织" }}
        expertSlug="delivery-agent"
      />,
    );

    expect(screen.getByRole("link", { name: "Open the partner and start the first task" }))
      .toHaveAttribute("href", "/dev-org/experts/delivery-agent");
  });

  it("falls back to the partner list when the expert slug is unknown", () => {
    render(
      <SuccessState organization={{ id: 9, slug: "dev-org", name: "研发组织" }} />,
    );

    expect(screen.getByRole("link", { name: "Open the partner and start the first task" }))
      .toHaveAttribute("href", "/dev-org/experts");
  });

  it("requires a compatible model before checking installation conditions", async () => {
    const user = userEvent.setup();
    const onModelChange = vi.fn();
    const { rerender } = render(
      <OrganizationStep
        organizations={[{ id: 9, slug: "dev-org", name: "研发组织" }]}
        loadingOrganizations={false}
        value="9"
        onChange={vi.fn()}
        onContinue={vi.fn()}
        modelResources={[{ id: 301, label: "OpenAI · GPT-5" }]}
        modelResourceID=""
        onModelChange={onModelChange}
        loadingModels={false}
        modelError={false}
        incompatibleListing={false}
        onReloadModels={vi.fn()}
        settingsHref="/dev-org/settings?tab=ai-resources"
      />,
    );

    expect(screen.getByRole("button", { name: "Review enablement conditions" })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Select a runtime model"), "301");
    expect(onModelChange).toHaveBeenCalledWith("301");

    rerender(
      <OrganizationStep
        organizations={[{ id: 9, slug: "dev-org", name: "研发组织" }]}
        loadingOrganizations={false}
        value="9"
        onChange={vi.fn()}
        onContinue={vi.fn()}
        modelResources={[{ id: 301, label: "OpenAI · GPT-5" }]}
        modelResourceID="301"
        onModelChange={onModelChange}
        loadingModels={false}
        modelError={false}
        incompatibleListing={false}
        onReloadModels={vi.fn()}
        settingsHref="/dev-org/settings?tab=ai-resources"
      />,
    );
    expect(screen.getByRole("button", { name: "Review enablement conditions" })).toBeEnabled();
  });

  it("keeps the organization loading state distinct from an empty account", () => {
    render(
      <OrganizationStep
        organizations={[]}
        loadingOrganizations
        value=""
        onChange={vi.fn()}
        onContinue={vi.fn()}
        modelResources={[]}
        modelResourceID=""
        onModelChange={vi.fn()}
        loadingModels={false}
        modelError={false}
        incompatibleListing={false}
        onReloadModels={vi.fn()}
        settingsHref=""
      />,
    );

    expect(screen.getByText("Loading organizations")).toBeInTheDocument();
    expect(screen.queryByText("This account has no available organization yet. Create one first."))
      .not.toBeInTheDocument();
  });

  it("reports an invalid expert version instead of model configuration", () => {
    render(
      <OrganizationStep
        organizations={[{ id: 9, slug: "dev-org", name: "研发组织" }]}
        loadingOrganizations={false}
        value="9"
        onChange={vi.fn()}
        onContinue={vi.fn()}
        modelResources={[]}
        modelResourceID=""
        onModelChange={vi.fn()}
        loadingModels={false}
        modelError={false}
        incompatibleListing
        onReloadModels={vi.fn()}
        settingsHref="/dev-org/settings?tab=ai-resources"
      />,
    );

    expect(screen.getByText(
      "This partner version is missing a compatible Agent. Ask the publisher to fix it and republish.",
    )).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Configure a compatible model" }))
      .not.toBeInTheDocument();
  });
});
