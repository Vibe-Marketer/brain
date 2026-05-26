import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConnectorCredentialForm,
  ConnectorReadonlyUrlField,
  ConnectorSecretField,
  ConnectorWebhookVerification,
} from "../";

const toastError = vi.fn();
const toastSuccess = vi.fn();
const writeText = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

describe("connector setup primitives", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    writeText.mockResolvedValue(undefined);
  });

  it("copies readonly URL values", async () => {
    render(
      <ConnectorReadonlyUrlField value="https://example.test/webhook" />,
    );

    fireEvent.click(screen.getByRole("button", { name: /copy url/i }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("https://example.test/webhook"),
    );
    expect(toastSuccess).toHaveBeenCalledWith("Webhook URL copied");
  });

  it("reveals and copies secret values", async () => {
    render(
      <ConnectorSecretField
        id="api-key"
        label="API key"
        value="secret-value"
        onChange={vi.fn()}
        showCopyButton
        copySuccessMessage="API key copied"
      />,
    );

    expect(screen.getByLabelText("API key")).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: /show api key/i }));
    expect(screen.getByLabelText("API key")).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByRole("button", { name: /^copy$/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("secret-value"));
    expect(toastSuccess).toHaveBeenCalledWith("API key copied");
  });

  it("keeps secret values masked when reveal is disabled", () => {
    render(
      <ConnectorSecretField
        id="webhook-secret"
        label="Webhook secret"
        value="whsec_secret"
        onChange={vi.fn()}
        showRevealButton={false}
      />,
    );

    expect(screen.getByLabelText("Webhook secret")).toHaveAttribute(
      "type",
      "password",
    );
    expect(
      screen.queryByRole("button", { name: /show webhook secret/i }),
    ).not.toBeInTheDocument();
  });

  it("renders webhook URL above signing secret in credential forms", () => {
    render(
      <ConnectorCredentialForm
        title="Connect provider"
        fields={[
          {
            id: "provider-api-key",
            label: "API key",
            value: "key",
            onChange: vi.fn(),
            type: "secret",
            required: true,
          },
        ]}
        webhook={{
          webhookUrl: "https://example.test/webhook",
          signingSecret: "whsec_test",
          onSigningSecretChange: vi.fn(),
        }}
        onSubmit={vi.fn()}
      />,
    );

    const apiKey = screen.getByText("API key");
    const webhookUrl = screen.getByText("Webhook URL");
    const signingSecret = screen.getByText("Webhook signing secret");

    expect(
      apiKey.compareDocumentPosition(webhookUrl) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      webhookUrl.compareDocumentPosition(signingSecret) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("disables form fields and submit button while saving", () => {
    render(
      <ConnectorCredentialForm
        fields={[
          {
            id: "account-email",
            label: "Account email",
            value: "user@example.test",
            onChange: vi.fn(),
            type: "email",
          },
        ]}
        onSubmit={vi.fn()}
        saving
      />,
    );

    expect(screen.getByLabelText("Account email")).toBeDisabled();
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
  });

  it("uses StatusBadge for webhook verification states", () => {
    render(
      <ConnectorWebhookVerification
        status="verified"
        lastReceivedAt="2026-05-25T12:00:00Z"
      />,
    );

    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText(/last received:/i)).toBeInTheDocument();
  });
});
