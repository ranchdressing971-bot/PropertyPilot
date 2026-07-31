import type { SupabaseClient } from "@supabase/supabase-js";
import { getNexusDb } from "@/lib/nexus/jobs";

export interface NovaMessageRow {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_name: string | null;
  tool_payload: Record<string, unknown>;
  created_at: string;
}

export interface NovaMemoryRow {
  id: string;
  kind: "note" | "trial" | "preference" | "fact";
  key: string | null;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

function dbOrThrow(): SupabaseClient {
  const db = getNexusDb();
  if (!db) throw new Error("Supabase service role not configured");
  return db;
}

export async function saveNovaMessage(input: {
  role: NovaMessageRow["role"];
  content: string;
  toolName?: string;
  toolPayload?: Record<string, unknown>;
}): Promise<void> {
  const db = dbOrThrow();
  await db.from("nova_messages").insert({
    role: input.role,
    content: input.content,
    tool_name: input.toolName ?? null,
    tool_payload: input.toolPayload ?? {},
  });
}

export async function loadRecentNovaMessages(
  limit = 40
): Promise<NovaMessageRow[]> {
  const db = dbOrThrow();
  const { data, error } = await db
    .from("nova_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (error.message?.includes("does not exist")) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as NovaMessageRow[]).reverse();
}

export async function loadNovaMemories(limit = 30): Promise<NovaMemoryRow[]> {
  const db = dbOrThrow();
  const { data, error } = await db
    .from("nova_memory")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (error.message?.includes("does not exist")) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as NovaMemoryRow[];
}

export async function upsertNovaMemory(input: {
  kind: NovaMemoryRow["kind"];
  content: string;
  key?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const db = dbOrThrow();
  const now = new Date().toISOString();
  if (input.key) {
    const { data: existing } = await db
      .from("nova_memory")
      .select("id")
      .eq("key", input.key)
      .maybeSingle();
    if (existing?.id) {
      await db
        .from("nova_memory")
        .update({
          kind: input.kind,
          content: input.content,
          metadata: input.metadata ?? {},
          updated_at: now,
        })
        .eq("id", existing.id);
      return;
    }
  }
  await db.from("nova_memory").insert({
    kind: input.kind,
    key: input.key ?? null,
    content: input.content,
    metadata: input.metadata ?? {},
  });
}
