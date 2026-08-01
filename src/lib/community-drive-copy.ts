/** Client-safe pre-upload / pre-record instruction copy. */

export function communityDriveInstruction(communityName?: string | null): {
  title: string;
  body: string;
  bullets: string[];
} {
  const named = Boolean(communityName?.trim());
  const name = communityName?.trim() || "one community";

  if (named) {
    return {
      title: `You're inspecting ${name}`,
      body: `For the clearest report, drive the main streets of ${name} and cover as much of it as practical. One community per video keeps your results tidy.`,
      bullets: [
        `Focus on ${name} for this video`,
        "Cover main streets as thoroughly as practical",
        "If you need a neighboring community, record that as a separate drive",
      ],
    };
  }

  return {
    title: "One community per drive",
    body: "For the clearest report, stay on the main streets of a single community and cover as much of it as practical. After analysis you'll choose which community these homes belong to.",
    bullets: [
      "Stay inside one community for this video",
      "Cover main streets as thoroughly as practical",
      "Assign homes to a community on the results screen",
    ],
  };
}
