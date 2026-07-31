/** Client-safe pre-upload / pre-record instruction copy. */

export function communityDriveInstruction(communityName: string): {
  title: string;
  body: string;
  bullets: string[];
} {
  const name = communityName.trim() || "your community";
  return {
    title: `You’re inspecting ${name}`,
    body: `For the clearest report, drive the main streets of ${name} and cover as much of it as practical. One community per video keeps your results tidy.`,
    bullets: [
      `Focus on ${name} for this video`,
      "Cover main streets as thoroughly as practical",
      "If you need a neighboring community, record that as a separate drive",
    ],
  };
}
