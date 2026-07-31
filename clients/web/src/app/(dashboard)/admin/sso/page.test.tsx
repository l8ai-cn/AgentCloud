import { fireEvent, render, screen, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listSSOConfigs = vi.fn();
const createSSOConfig = vi.fn();
const updateSSOConfig = vi.fn();
const deleteSSOConfig = vi.fn();
const testSSOConnection = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@/lib/api/admin/sso", () => ({
  listSSOConfigs: (...args: unknown[]) => listSSOConfigs(...args),
  createSSOConfig: (...args: unknown[]) => createSSOConfig(...args),
  updateSSOConfig: (...args: unknown[]) => updateSSOConfig(...args),
  deleteSSOConfig: (...args: unknown[]) => deleteSSOConfig(...args),
  enableSSOConfig: vi.fn(),
  disableSSOConfig: vi.fn(),
  testSSOConnection: (...args: unknown[]) => testSSOConnection(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import AdminSSOPage from "./page";

const config = {
  id: 7,
  domain: "example.com",
  name: "Example SSO",
  protocol: "oidc" as const,
  is_enabled: true,
  enforce_sso: false,
  default_organization_id: 9,
  oidc_issuer_url: "https://id.example.com",
  oidc_client_id: "client-id",
  oidc_scopes: "openid profile email",
  created_at: "2026-07-30T00:00:00Z",
  updated_at: "2026-07-30T01:00:00Z",
};

const response = {
  data: [config],
  total: 1,
  page: 1,
  page_size: 20,
  total_pages: 1,
};

describe("AdminSSOPage", () => {
  beforeEach(() => {
    listSSOConfigs.mockReset();
    createSSOConfig.mockReset();
    updateSSOConfig.mockReset();
    deleteSSOConfig.mockReset();
    testSSOConnection.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    listSSOConfigs.mockResolvedValue(response);
    createSSOConfig.mockResolvedValue(config);
    updateSSOConfig.mockResolvedValue(config);
    deleteSSOConfig.mockResolvedValue(undefined);
    testSSOConnection.mockResolvedValue({ success: true, message: "Connected" });
  });

  it("renders the list and debounces search", async () => {
    render(<AdminSSOPage />);

    expect(await screen.findByText("Example SSO")).toBeInTheDocument();
    expect(screen.getByText("1 configurations")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search SSO configurations"), {
      target: { value: "example" },
    });

    await waitFor(() => {
      expect(listSSOConfigs).toHaveBeenLastCalledWith({
        search: "example",
        protocol: undefined,
        page: 1,
        page_size: 20,
      });
    });
  });

  it("shows load errors instead of an empty result", async () => {
    listSSOConfigs.mockRejectedValue(new Error("database unavailable"));

    render(<AdminSSOPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("database unavailable");
  });

  it("creates an OIDC configuration", async () => {
    render(<AdminSSOPage />);
    await screen.findByText("Example SSO");

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    const domain = await screen.findByLabelText(/^Domain/);
    fireEvent.change(domain, { target: { value: "new.example.com" } });
    fireEvent.change(screen.getByLabelText(/^Display name/), { target: { value: "New SSO" } });
    fireEvent.change(screen.getByLabelText(/^Issuer URL/), {
      target: { value: "https://id.new.example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^Client ID/), { target: { value: "new-client" } });
    fireEvent.click(screen.getByRole("button", { name: "Create configuration" }));

    await waitFor(() => {
      expect(createSSOConfig).toHaveBeenCalledWith(expect.objectContaining({
        domain: "new.example.com",
        name: "New SSO",
        protocol: "oidc",
        oidc_client_id: "new-client",
      }));
    });
  });

  it("edits without making domain or protocol mutable", async () => {
    render(<AdminSSOPage />);
    await screen.findByText("Example SSO");

    fireEvent.click(screen.getByLabelText("Edit Example SSO"));
    expect(await screen.findByLabelText(/^Domain/)).toBeDisabled();
    expect(screen.getByLabelText("SSO protocol")).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^Display name/), {
      target: { value: "Renamed SSO" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updateSSOConfig).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          name: "Renamed SSO",
          oidc_client_secret: undefined,
        }),
      );
    });
  });

  it("requires confirmation before deletion", async () => {
    render(<AdminSSOPage />);
    await screen.findByText("Example SSO");

    fireEvent.click(screen.getByLabelText("Delete Example SSO"));
    expect(deleteSSOConfig).not.toHaveBeenCalled();
    expect(screen.getByText("Delete this SSO configuration?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteSSOConfig).toHaveBeenCalledWith(7));
  });

  it("prevents duplicate connection tests and shows the successful row result", async () => {
    let resolveTest: (result: { success: boolean; message: string }) => void = () => {};
    testSSOConnection.mockImplementation(() => new Promise((resolve) => {
      resolveTest = resolve;
    }));
    render(<AdminSSOPage />);
    await screen.findByText("Example SSO");

    const testButton = screen.getByLabelText("Test Example SSO");
    fireEvent.click(testButton);
    fireEvent.click(testButton);

    expect(testSSOConnection).toHaveBeenCalledTimes(1);
    expect(testButton).toBeDisabled();
    expect(testButton).toHaveTextContent("Testing");

    resolveTest({ success: true, message: "Connected" });

    expect(await screen.findByRole("status")).toHaveTextContent("Connected");
    expect(testButton).toHaveTextContent("Passed");
    expect(toastSuccess).toHaveBeenCalledWith("Connected");
  });

  it("surfaces a failed connection test in the affected row", async () => {
    testSSOConnection.mockResolvedValue({
      success: false,
      error: "TLS handshake failed",
    });
    render(<AdminSSOPage />);
    await screen.findByText("Example SSO");

    fireEvent.click(screen.getByLabelText("Test Example SSO"));

    expect(await screen.findByRole("alert")).toHaveTextContent("TLS handshake failed");
    expect(screen.getByLabelText("Test Example SSO")).toHaveTextContent("Failed");
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("TLS handshake failed"));
  });

  it("shows transport errors without leaving an unhandled test mutation", async () => {
    testSSOConnection.mockRejectedValue(new Error("request timed out"));
    render(<AdminSSOPage />);
    await screen.findByText("Example SSO");

    const testButton = screen.getByLabelText("Test Example SSO");
    fireEvent.click(testButton);

    expect(await screen.findByRole("alert")).toHaveTextContent("request timed out");
    expect(testButton).toBeEnabled();
    expect(testButton).toHaveTextContent("Failed");
  });
});
