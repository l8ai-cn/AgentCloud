import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import type { McpMarketItem } from "@/lib/api";
import enConnections from "@/messages/en/connections.json";
import { ConnectionInstallDialog } from "../ConnectionInstallDialog";

vi.mock("@/stores/auth", () => ({
  useCurrentOrg: () => ({ slug: "acme", id: 1 }),
}));

vi.mock("@/lib/api/facade/repoMcpExtension", () => ({
  installMcpFromMarket: vi.fn(),
}));

vi.mock("@/components/common/RepositorySelect", () => ({
  RepositorySelect: () => <div>repository-select</div>,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const item: McpMarketItem = {
  id: 7,
  slug: "github",
  name: "GitHub",
  description: "GitHub connector",
  icon: "",
  transport_type: "stdio",
  command: "npx",
  category: "devtools",
  source: "registry",
  env_var_schema: [
    {
      name: "GITHUB_TOKEN",
      label: "GitHub Token",
      required: true,
      sensitive: true,
      placeholder: "ghp_...",
    },
    {
      name: "GITHUB_HOST",
      label: "GitHub Host",
      required: false,
      sensitive: false,
      placeholder: "github.com",
    },
  ],
};

describe("ConnectionInstallDialog", () => {
  it("renders env var fields from env_var_schema", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enConnections}>
        <ConnectionInstallDialog item={item} open onOpenChange={vi.fn()} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByLabelText(/GitHub Token/)).toBeInTheDocument();
    expect(screen.getByLabelText(/GitHub Host/)).toBeInTheDocument();
    expect(screen.getByLabelText(/GitHub Token/)).toHaveAttribute("type", "password");
    expect(screen.getByLabelText(/GitHub Host/)).toHaveAttribute("type", "text");
    expect(screen.getByPlaceholderText("ghp_...")).toBeInTheDocument();
  });
});
