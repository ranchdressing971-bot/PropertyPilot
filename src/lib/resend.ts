import { Resend } from "resend";

let resend: Resend | null = null;

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function getResend(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export function getEmailFrom(): string {
  return process.env.RESEND_FROM_EMAIL ?? "Property Pilot <onboarding@resend.dev>";
}
