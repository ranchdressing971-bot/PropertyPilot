/** Persist a corrected address on an inspection result (live mode). */
export async function confirmInspectionAddress(
  inspectionId: string,
  propertyId: string,
  address: string
): Promise<{ address: string; source?: "roster" | "map" }> {
  const trimmed = address.trim();
  const res = await fetch(`/api/inspection/${inspectionId}/confirm-address`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ propertyId, address: trimmed }),
  });
  const data = (await res.json()) as {
    error?: string;
    address?: string;
    source?: "roster" | "map";
  };
  if (!res.ok) {
    throw new Error(data.error ?? "Could not save address");
  }
  return {
    address: data.address ?? trimmed,
    source: data.source,
  };
}
