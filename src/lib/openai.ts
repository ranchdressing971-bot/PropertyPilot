import OpenAI from "openai";
import { getOpenAIApiKey } from "./openai-env";

let client: OpenAI | null = null;

export { getOpenAIApiKey } from "./openai-env";

export function getOpenAI(): OpenAI {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  if (!client) {
    client = new OpenAI({ apiKey });
  }
  return client;
}
