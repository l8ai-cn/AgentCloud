import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpMarketItem } from "@/lib/api";
import enConnections from "@/messages/en/connections.json";
import { ConnectionMarketPanel } from "../ConnectionMarketPanel";

const listMarket = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/facade/marketExtension", () => ({
  listMarketMcpServers: listMarket,
}));

vi.mock("@/stores/auth", () => ({
  useCurrentOrg: () => ({ slug: "acme", id: 1 }),
}));

vi.mock("@/components/common/RepositorySelect", () => ({
  RepositorySelect: () => <div>repository-select</div>,
}));

function marketItem(overrides: Partial<McpMarketItem> = {}): McpMarketItem {
  return {
    id: 1,
    slug: "github",
    name: "GitHub",
    description: "GitHub connector",
    icon: "",
    transport_type: "stdio",
    command: "npx",
    category: "devtools",
    source: "registry",
    env_var_schema: [],
    ...overrides,
  };
}

function renderPanel() {
  return render(
    <NextIntlClientProvider locale="en" messages={enConnections}>
      <ConnectionMarketPanel />
    </NextIntlClientProvider>,
  );
}

describe("ConnectionMarketPanel", () => {
  beforeEach(() => {
    listMarket.mockReset();
    listMarket.mockResolvedValue({
      items: [
        marketItem(),
        marketItem({ id: 2, slug: "slack", name: "Slack", category: "chat" }),
      ],
      total: 2,
      limit: 50,
      offset: 0,
    });
  });

  it("renders market connector cards from the catalog", async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.getByText("GitHub")).toBeInTheDocument();
    });
    expect(screen.getByText("Slack")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Install" })).toHaveLength(2);
    expect(listMarket).toHaveBeenCalledWith("acme", expect.objectContaining({
      limit: 50,
      offset: 0,
    }));
  });

  it("filters the catalog by category", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText("GitHub")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "devtools" }));

    await waitFor(() => {
      expect(listMarket).toHaveBeenCalledWith("acme", expect.objectContaining({
        category: "devtools",
      }));
    });
  });
});
