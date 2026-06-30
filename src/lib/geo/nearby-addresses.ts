import type { Property } from "../mock-data";
import type { UploadGeoContext } from "./types";
import { reverseGeocode } from "./reverse-geocode";

export interface AddressCandidateContext {
  /** Short list of addresses OpenAI should match against */
  candidates: string[];
  /** Extra context for the vision prompt */
  promptContext: string;
  /** Roster property id by normalized address */
  rosterByAddress: Map<string, string>;
}

function norm(addr: string): string {
  return addr.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Build candidate address list from property roster + GPS reverse geocode.
 * Video frame → GPS context → possible addresses nearby → OpenAI picks best.
 */
export async function buildAddressCandidates(opts: {
  roster: Property[];
  geo?: UploadGeoContext | null;
  neighborhood: string;
}): Promise<AddressCandidateContext> {
  const rosterByAddress = new Map<string, string>();
  const candidateSet = new Set<string>();

  for (const p of opts.roster) {
    candidateSet.add(p.address);
    rosterByAddress.set(norm(p.address), p.id);
  }

  const contextParts: string[] = [
    `Neighborhood / HOA: ${opts.neighborhood}.`,
  ];

  if (opts.geo) {
    const place = await reverseGeocode(opts.geo.lat, opts.geo.lng);
    if (place) {
      contextParts.push(`GPS places this drive-through near: ${place.label}.`);
      if (place.road) {
        contextParts.push(`Likely street: ${place.road}.`);
      }
    } else {
      contextParts.push(
        `GPS: ${opts.geo.lat.toFixed(5)}, ${opts.geo.lng.toFixed(5)}.`
      );
    }

    if (opts.geo.heading != null && Number.isFinite(opts.geo.heading)) {
      const dir = headingLabel(opts.geo.heading);
      contextParts.push(
        `Camera heading ~${Math.round(opts.geo.heading)}° (${dir}) — prefer addresses along that side of the street.`
      );
    }
  }

  if (candidateSet.size === 0) {
    contextParts.push(
      "No property roster loaded — read visible mailbox/curb numbers and street signs only."
    );
  }

  return {
    candidates: Array.from(candidateSet).slice(0, 50),
    promptContext: contextParts.join(" "),
    rosterByAddress,
  };
}

function headingLabel(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(deg / 45) % 8;
  return dirs[idx];
}
