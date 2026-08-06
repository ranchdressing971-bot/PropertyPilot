import { redirect } from "next/navigation";

/** Properties list is now under Communities. Detail routes stay at /properties/[id]. */
export default function PropertiesPage() {
  redirect("/dashboard/communities");
}
