import { redirect } from "next/navigation";

/**
 * Short deep link → auto-listen Nova.
 * Prefer the glasses Shortcut with Speak Text + DictateText +
 * /nova?listen=1&q=… so the first command does not need an in-page tap.
 */
export default function NovaGoPage() {
  redirect("/nova?listen=1");
}
