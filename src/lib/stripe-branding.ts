import type Stripe from "stripe";
import { getCheckoutDisplayName } from "./stripe";

/** Match Property Pilot canvas, ink buttons, and rounded cards. */
export function buildCheckoutBranding(
  appUrl: string
): Stripe.Checkout.SessionCreateParams.BrandingSettings {
  const branding: Stripe.Checkout.SessionCreateParams.BrandingSettings = {
    display_name: getCheckoutDisplayName(),
    background_color: "#fafafa",
    button_color: "#18181b",
    border_style: "rounded",
    font_family: "inter",
  };

  // Stripe must fetch logo over public HTTPS — skip on localhost or bad URLs.
  const base = appUrl.replace(/\/$/, "");
  if (base.startsWith("https://")) {
    const logoUrl = `${base}/logo.png`;
    branding.logo = { type: "url", url: logoUrl };
    branding.icon = { type: "url", url: logoUrl };
  }

  return branding;
}
