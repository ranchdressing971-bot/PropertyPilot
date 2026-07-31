/** Client-safe pre-upload / pre-record instruction copy. */

export function communityDriveInstruction(communityName: string): {
  title: string;
  body: string;
  bullets: string[];
} {
  const name = communityName.trim() || "your community";
  return {
    title: `You’re inspecting ${name}`,
    body: `Please drive the main streets of this community only and try to cover as much of it as practical. Record only the whole community you selected — not neighboring subdivisions.`,
    bullets: [
      `Stay inside ${name} for this video`,
      "Cover main streets as thoroughly as practical",
      "Avoid driving into a different community on the same recording",
    ],
  };
}
