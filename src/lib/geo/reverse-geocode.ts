/** Reverse geocode via OpenStreetMap Nominatim (no API key). */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<{ label: string; road?: string } | null> {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: "json",
      zoom: "18",
      addressdetails: "1",
    });

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params}`,
      {
        headers: {
          "User-Agent": "RideBy/1.0 (hoa-inspection-app)",
          Accept: "application/json",
        },
        next: { revalidate: 86400 },
      }
    );

    if (!res.ok) return null;

    const data = (await res.json()) as {
      display_name?: string;
      address?: { road?: string; house_number?: string };
    };

    if (!data.display_name) return null;

    return {
      label: data.display_name,
      road: data.address?.road,
    };
  } catch {
    return null;
  }
}
