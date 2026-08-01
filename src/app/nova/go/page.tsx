import { redirect } from "next/navigation";

/** Short deep link for Siri Shortcuts / Bluetooth glasses → auto-listen Nova. */
export default function NovaGoPage() {
  redirect("/nova?listen=1");
}
