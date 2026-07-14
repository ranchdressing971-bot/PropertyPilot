import type Stripe from "stripe";
import { getCheckoutDisplayName } from "./stripe";

/** Match RideBy canvas, ink buttons, and rounded cards. */
export function buildCheckoutBranding(
  appUrl: string,
  options?: { embedded?: boolean }
): Stripe.Checkout.SessionCreateParams.BrandingSettings {
  const branding: Stripe.Checkout.SessionCreateParams.BrandingSettings = {
    display_name: getCheckoutDisplayName(),
    background_color: "#fafafa",
    button_color: "#18181b",
    border_style: "rounded",
    font_family: "inter",
  };

  // embedded_page disallows logo/icon — your app shell shows the logo instead.
  if (options?.embedded) {
    return branding;
  }

  const base = appUrl.replace(/\/$/, "");
  if (base.startsWith("https://")) {
    const logoUrl = `${base}/logo.png`;
    branding.logo = { type: "url", url: logoUrl };
    branding.icon = { type: "url", url: logoUrl };
  }

  return branding;
}
