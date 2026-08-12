import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import enConnections from "@/messages/en/connections.json";
import { ConnectionsPage } from "../ConnectionsPage";

const mockReplace = vi.fn();
let mockSearch = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useParams: () => ({ org: "acme" }),
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

vi.mock("../ConnectionMarketPanel", () => ({
  ConnectionMarketPanel: () => <div>market-panel</div>,
}));

vi.mock("../MyConnectionsPanel", () => ({
  MyConnectionsPanel: () => <div>mine-panel</div>,
}));

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={enConnections}>
      <ConnectionsPage />
    </NextIntlClientProvider>,
  );
}

describe("ConnectionsPage", () => {
  beforeEach(() => {
    mockSearch = "";
    mockReplace.mockReset();
  });

  it("shows the market view by default", () => {
    renderPage();
    expect(screen.getByText("market-panel")).toBeInTheDocument();
    expect(screen.queryByText("mine-panel")).not.toBeInTheDocument();
  });

  it("switches to my connections when view=mine", () => {
    mockSearch = "view=mine";
    renderPage();
    expect(screen.getByText("mine-panel")).toBeInTheDocument();
    expect(screen.queryByText("market-panel")).not.toBeInTheDocument();
  });

  it("writes view=mine to the query when the mine tab is clicked", () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "My Connections" }));
    expect(mockReplace).toHaveBeenCalledWith("/acme/connections?view=mine");
  });
});
