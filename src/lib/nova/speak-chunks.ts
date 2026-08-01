/**
 * Split assistant text into speakable chunks for overlapping TTS.
 * Prefers sentence boundaries; falls back to clause/length cuts for long runs.
 */

const SENTENCE_END = /[.!?]+(?:["')\]]+)?(?=\s|$)/g;
const MIN_CHUNK = 12;
const MAX_CHUNK = 220;

/** Normalize whitespace; strip markdown-ish noise that sounds bad spoken. */
export function prepareSpeakText(text: string): string {
  return text
    .replace(/\*\*|__/g, "")
    .replace(/`+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Return complete sentences ready to speak from a growing buffer.
 * Remainder is incomplete (no terminal punctuation yet).
 */
export function pullCompleteSentences(buffer: string): {
  sentences: string[];
  rest: string;
} {
  const prepared = prepareSpeakText(buffer);
  if (!prepared) return { sentences: [], rest: "" };

  const sentences: string[] = [];
  let lastIndex = 0;
  SENTENCE_END.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SENTENCE_END.exec(prepared)) !== null) {
    const end = match.index + match[0].length;
    const piece = prepared.slice(lastIndex, end).trim();
    if (piece) sentences.push(piece);
    lastIndex = end;
  }

  // Also split on hard newlines that look like paragraph breaks.
  const rest = prepared.slice(lastIndex).trim();
  if (rest.includes("\n")) {
    const lines = rest.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1) {
      sentences.push(...lines.slice(0, -1));
      return { sentences, rest: lines[lines.length - 1] ?? "" };
    }
  }

  return { sentences, rest };
}

/** Force-split a long unfinished buffer so TTS can start before stream ends. */
export function forceSplitLongRest(rest: string): {
  sentences: string[];
  rest: string;
} {
  const text = prepareSpeakText(rest);
  if (text.length < MAX_CHUNK) return { sentences: [], rest: text };

  // Prefer comma / semicolon / dash clause breaks near the limit.
  const window = text.slice(0, MAX_CHUNK);
  const clauseBreak = Math.max(
    window.lastIndexOf("; "),
    window.lastIndexOf(", "),
    window.lastIndexOf(" - "),
    window.lastIndexOf(": ")
  );
  const cut =
    clauseBreak >= MIN_CHUNK ? clauseBreak + 1 : window.lastIndexOf(" ");
  const at = cut >= MIN_CHUNK ? cut : MAX_CHUNK;
  const head = text.slice(0, at).trim();
  const tail = text.slice(at).trim();
  return {
    sentences: head ? [head] : [],
    rest: tail,
  };
}

/** Split a finished reply into ordered TTS chunks. */
export function splitIntoSpeakChunks(text: string): string[] {
  const prepared = prepareSpeakText(text);
  if (!prepared) return [];

  const { sentences, rest } = pullCompleteSentences(prepared);
  const chunks = [...sentences];
  let leftover = rest;

  while (leftover.length > MAX_CHUNK) {
    const forced = forceSplitLongRest(leftover);
    chunks.push(...forced.sentences);
    leftover = forced.rest;
    if (forced.sentences.length === 0) break;
  }
  if (leftover) chunks.push(leftover);

  // Merge tiny trailing fragments into the previous chunk.
  const merged: string[] = [];
  for (const chunk of chunks) {
    if (
      merged.length > 0 &&
      chunk.length < MIN_CHUNK &&
      merged[merged.length - 1]!.length + chunk.length < MAX_CHUNK
    ) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${chunk}`;
    } else {
      merged.push(chunk);
    }
  }
  return merged.filter(Boolean);
}
