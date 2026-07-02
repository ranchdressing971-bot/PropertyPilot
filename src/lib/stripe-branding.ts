import type Stripe from "stripe";
import { getCheckoutDisplayName } from "./stripe";

/** Match Property Pilot canvas, ink buttons, and rounded cards. */
export function buildCheckoutBranding(appUrl: string): Stripe.Checkout.SessionCreateParams.BrandingSettings {
  const logoUrl = `${appUrl.replace(/\/$/, "")}/logo.png`;

  return {
    display_name: getCheckoutDisplayName(),
    background_color: "#fafafa",
    button_color: "#18181b",
    border_style: "rounded",
    font_family: "inter",
    logo: { type: "url", url: logoUrl },
    icon: { type: "url", url: logoUrl },
  };
}
