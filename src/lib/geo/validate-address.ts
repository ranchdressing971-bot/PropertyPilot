import {
  extractHouseNumber,
  formatAddressTitle,
  streetCore,
} from "../address-normalize";

export interface AddressValidationResult {
  ok: boolean;
  /** Cleaned address to store (may be OSM-normalized) */
  address: string;
  /** Human-readable reason when ok is false */
  error?: string;
  /** True when Nominatim confirmed a real place */
  verified?: boolean;
  /** Full OSM display name when available */
  displayName?: string;
}

function looksLikeStreetAddress(address: string): boolean {
  const trimmed = address.trim();
  if (trimmed.length < 5) return false;
  if (!extractHouseNumber(trimmed)) return false;
  // Need at least a street name after the number
  const afterNumber = trimmed.replace(/^\d+[a-z]?\s*/i, "").trim();
  if (afterNumber.length < 2) return false;
  // Reject pure placeholders
  if (/^home at|^property at|^unknown/i.test(trimmed)) return false;
  return true;
}

/**
 * Forward-geocode via OpenStreetMap Nominatim to confirm an address exists.
 * No API key required. Soft-fails open if the service is unreachable.
 */
export async function validateStreetAddress(
  raw: string,
  opts?: { neighborhood?: string; allowUnverified?: boolean }
): Promise<AddressValidationResult> {
  const trimmed = raw.trim();
  if (!looksLikeStreetAddress(trimmed)) {
    return {
      ok: false,
      address: trimmed,
      error:
        "Enter a real street address with house number and street (e.g. 456 Oak Lane).",
    };
  }

  const formatted = formatAddressTitle(trimmed);
  const query = opts?.neighborhood
    ? `${formatted}, ${opts.neighborhood}`
    : formatted;

  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      addressdetails: "1",
      limit: "3",
    });

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          "User-Agent": "PropertyPilot/1.0 (hoa-inspection-app)",
          Accept: "application/json",
        },
        // Don't cache failed lookups forever
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) {
      if (opts?.allowUnverified !== false) {
        return {
          ok: true,
          address: formatted,
          verified: false,
        };
      }
      return {
        ok: false,
        address: formatted,
        error: "Could not reach address verification. Try again in a moment.",
      };
    }

    const results = (await res.json()) as Array<{
      display_name?: string;
      address?: {
        house_number?: string;
        road?: string;
        residential?: string;
        suburb?: string;
        city?: string;
        town?: string;
        village?: string;
        state?: string;
      };
      type?: string;
      class?: string;
    }>;

    if (!Array.isArray(results) || results.length === 0) {
      // Retry without neighborhood in case HOA name confuses search
      if (opts?.neighborhood) {
        return validateStreetAddress(formatted, {
          allowUnverified: opts.allowUnverified,
        });
      }
      return {
        ok: false,
        address: formatted,
        error:
          "That address wasn't found. Check the house number and street spelling.",
      };
    }

    const inputNum = extractHouseNumber(formatted);
    const inputStreet = streetCore(formatted);

    // Prefer a hit whose house number matches what the user typed
    const best =
      results.find((r) => {
        const num = r.address?.house_number?.toLowerCase();
        return inputNum && num && num === inputNum;
      }) ?? results[0];

    const osmNum = best.address?.house_number;
    const osmRoad =
      best.address?.road ||
      best.address?.residential ||
      undefined;

    // If OSM returned a different house number, reject — don't silently swap
    if (
      inputNum &&
      osmNum &&
      osmNum.toLowerCase() !== inputNum &&
      !results.some(
        (r) => r.address?.house_number?.toLowerCase() === inputNum
      )
    ) {
      return {
        ok: false,
        address: formatted,
        error: `No match for house #${inputNum} on that street. Double-check the number.`,
      };
    }

    // Prefer keeping the user's street wording if OSM street is close
    let canonical = formatted;
    if (osmNum && osmRoad) {
      const osmStreetCore = streetCore(`${osmNum} ${osmRoad}`);
      if (
        !inputStreet ||
        osmStreetCore === inputStreet ||
        osmStreetCore.includes(inputStreet) ||
        inputStreet.includes(osmStreetCore)
      ) {
        canonical = formatAddressTitle(`${osmNum} ${osmRoad}`);
      }
    }

    return {
      ok: true,
      address: canonical,
      verified: true,
      displayName: best.display_name,
    };
  } catch {
    // Network / timeout — don't block managers if OSM is down
    if (opts?.allowUnverified !== false) {
      return { ok: true, address: formatted, verified: false };
    }
    return {
      ok: false,
      address: formatted,
      error: "Address verification timed out. Try again.",
    };
  }
}
