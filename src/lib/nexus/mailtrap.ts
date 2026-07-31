/**
 * Mailtrap delivery client for Nexus cold outreach.
 *
 * Sandbox mode posts into a Mailtrap testing inbox (no real HOA mailboxes).
 * Live mode uses the transactional Sending API once a domain is verified.
 */

export function isMailtrapConfigured(): boolean {
  return Boolean(process.env.MAILTRAP_API_TOKEN?.trim());
}

export function isMailtrapSandbox(): boolean {
  const flag = (process.env.MAILTRAP_SANDBOX ?? "true").trim().toLowerCase();
  return flag !== "false" && flag !== "0" && flag !== "off";
}

export function mailtrapFrom(): { email: string; name: string } {
  const email =
    process.env.MAILTRAP_FROM_EMAIL?.trim() || "outreach@example.com";
  const name = process.env.MAILTRAP_FROM_NAME?.trim() || "Isaac at RideBy";
  return { email, name };
}

export interface MailtrapSendInput {
  to: string;
  subject: string;
  text: string;
  /** Optional HTML; plain text is enough for cold outreach. */
  html?: string;
}

export interface MailtrapSendResult {
  ok: true;
  messageIds: string[];
  sandbox: boolean;
}

export async function sendViaMailtrap(
  input: MailtrapSendInput
): Promise<MailtrapSendResult> {
  const token = process.env.MAILTRAP_API_TOKEN?.trim();
  if (!token) {
    throw new Error("MAILTRAP_API_TOKEN is not configured");
  }

  const from = mailtrapFrom();
  const sandbox = isMailtrapSandbox();
  const inboxId = process.env.MAILTRAP_INBOX_ID?.trim();

  if (sandbox && !inboxId) {
    throw new Error(
      "MAILTRAP_SANDBOX is on — set MAILTRAP_INBOX_ID (Mailtrap Email Testing inbox id)"
    );
  }

  const url = sandbox
    ? `https://sandbox.api.mailtrap.io/api/send/${inboxId}`
    : "https://send.api.mailtrap.io/api/send";

  const body: Record<string, unknown> = {
    from,
    to: [{ email: input.to }],
    subject: input.subject,
    text: input.text,
  };
  if (input.html) body.html = input.html;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Api-Token": token,
      "Content-Type": "application/json",
      "User-Agent": "RideBy-Nexus/1.0",
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(
      `Mailtrap send failed (${response.status}): ${raw.slice(0, 400)}`
    );
  }

  let messageIds: string[] = [];
  try {
    const parsed = JSON.parse(raw) as {
      message_ids?: string[];
      success?: boolean;
    };
    messageIds = parsed.message_ids ?? [];
  } catch {
    messageIds = [];
  }

  return { ok: true, messageIds, sandbox };
}
