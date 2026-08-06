import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
export type CompanyRole = "owner" | "admin" | "inspector";

export interface CompanyContext {
  userId: string;
  companyId: string;
  role: CompanyRole;
  companyName: string | null;
  hoaName: string | null;
}

export function isAdminRole(role: CompanyRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function canManageBilling(role: CompanyRole | null | undefined): boolean {
  return isAdminRole(role);
}

export function canManageTeam(role: CompanyRole | null | undefined): boolean {
  return isAdminRole(role);
}

/** Nav items inspectors should not see as primary destinations. */
export function inspectorBlockedPaths(): string[] {
  return ["/dashboard/reports"];
}

function newInviteToken(): string {
  return randomBytes(24).toString("hex");
}

/**
 * Resolve the signed-in user's active company + role.
 * Returns null if unauthenticated. Creates a company when the user has a
 * company name (profiles.hoa_name) but no workspace yet (idempotent).
 */
export async function getActiveCompanyContext(): Promise<CompanyContext | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const client = admin ?? supabase;

  const { data: profile } = await client
    .from("profiles")
    .select("active_company_id, hoa_name, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  let companyId = profile?.active_company_id as string | null | undefined;

  if (!companyId) {
    const { data: membership } = await client
      .from("company_members")
      .select("company_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (membership?.company_id) {
      companyId = membership.company_id;
      await client
        .from("profiles")
        .upsert({ id: user.id, active_company_id: companyId });
    }
  }

  if (!companyId) {
    const companyName =
      (profile?.hoa_name as string | undefined)?.trim() ||
      String(user.user_metadata?.hoa_name ?? "").trim();
    if (companyName) {
      const ensured = await ensureCompanyForUser(user.id, companyName);
      if (ensured) companyId = ensured.companyId;
    }
  }

  if (!companyId) return null;

  const { data: member } = await client
    .from("company_members")
    .select("role, status")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member || member.status !== "active") return null;

  const { data: company } = await client
    .from("companies")
    .select("name, hoa_name")
    .eq("id", companyId)
    .maybeSingle();

  return {
    userId: user.id,
    companyId,
    role: member.role as CompanyRole,
    companyName: company?.name ?? null,
    hoaName: company?.hoa_name ?? profile?.hoa_name ?? null,
  };
}

/**
 * Create a company + owner membership for a user (or attach to existing).
 * Used on signup / profile setup / backfill. Does not create a community row;
 * communities are added later from the Communities page (or inspection assign).
 */
export async function ensureCompanyForUser(
  userId: string,
  companyName: string
): Promise<{ companyId: string; created: boolean } | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const trimmed = companyName.trim();
  if (!trimmed) return null;

  const { data: existingMember } = await admin
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingMember?.company_id) {
    await admin
      .from("profiles")
      .upsert({
        id: userId,
        active_company_id: existingMember.company_id,
        hoa_name: trimmed,
      });
    await admin
      .from("companies")
      .update({
        name: trimmed,
        hoa_name: trimmed,
      })
      .eq("id", existingMember.company_id);
    return { companyId: existingMember.company_id, created: false };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("active_company_id, stripe_customer_id, subscription_status, plan")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.active_company_id) {
    return { companyId: profile.active_company_id, created: false };
  }

  const { data: company, error: companyError } = await admin
    .from("companies")
    .insert({
      name: trimmed,
      hoa_name: trimmed,
      created_by: userId,
      stripe_customer_id: profile?.stripe_customer_id ?? null,
      subscription_status: profile?.subscription_status ?? "none",
      plan: profile?.plan ?? "starter",
    })
    .select("id")
    .single();

  if (companyError || !company) {
    console.error("ensureCompanyForUser insert company:", companyError?.message);
    return null;
  }

  const { error: memberError } = await admin.from("company_members").insert({
    company_id: company.id,
    user_id: userId,
    role: "owner",
    status: "active",
  });

  if (memberError) {
    console.error("ensureCompanyForUser insert member:", memberError.message);
  }

  await admin.from("profiles").upsert({
    id: userId,
    active_company_id: company.id,
    hoa_name: trimmed,
  });

  // Attach any orphaned personal rows
  await admin
    .from("properties")
    .update({ company_id: company.id, created_by: userId })
    .eq("user_id", userId)
    .is("company_id", null);

  await admin
    .from("inspections")
    .update({ company_id: company.id, created_by: userId })
    .eq("user_id", userId)
    .is("company_id", null);

  return { companyId: company.id, created: true };
}

export async function createCompanyInvite(opts: {
  companyId: string;
  email: string;
  role: "admin" | "inspector";
  invitedBy: string;
  expiresInDays?: number;
}): Promise<{ token: string; id: string } | { error: string }> {
  const admin = createAdminClient();
  if (!admin) return { error: "Database not configured" };

  const email = opts.email.trim().toLowerCase();
  if (!email.includes("@")) return { error: "Enter a valid email" };

  const token = newInviteToken();
  const expires = new Date();
  expires.setDate(expires.getDate() + (opts.expiresInDays ?? 14));

  const { data, error } = await admin
    .from("company_invites")
    .insert({
      company_id: opts.companyId,
      email,
      role: opts.role,
      token,
      invited_by: opts.invitedBy,
      expires_at: expires.toISOString(),
    })
    .select("id, token")
    .single();

  if (error || !data) {
    console.error("createCompanyInvite:", error?.message);
    return { error: "Could not create invite" };
  }

  return { id: data.id, token: data.token };
}

export async function acceptCompanyInvite(opts: {
  token: string;
  userId: string;
  userEmail: string | null | undefined;
}): Promise<{ companyId: string } | { error: string; code?: string }> {
  const admin = createAdminClient();
  if (!admin) return { error: "Database not configured", code: "NO_DB" };

  const { data: invite, error } = await admin
    .from("company_invites")
    .select("*")
    .eq("token", opts.token)
    .maybeSingle();

  if (error || !invite) {
    return { error: "Invite not found", code: "NOT_FOUND" };
  }
  if (invite.accepted_at) {
    return { error: "Invite already used", code: "USED" };
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return { error: "Invite expired", code: "EXPIRED" };
  }

  const inviteEmail = String(invite.email).toLowerCase();
  const userEmail = (opts.userEmail ?? "").toLowerCase();
  if (userEmail && inviteEmail && userEmail !== inviteEmail) {
    return {
      error: `Sign in as ${invite.email} to accept this invite.`,
      code: "EMAIL_MISMATCH",
    };
  }

  const { error: memberError } = await admin.from("company_members").upsert(
    {
      company_id: invite.company_id,
      user_id: opts.userId,
      role: invite.role,
      status: "active",
    },
    { onConflict: "company_id,user_id" }
  );

  if (memberError) {
    console.error("acceptCompanyInvite member:", memberError.message);
    return { error: "Could not join company", code: "JOIN_FAILED" };
  }

  await admin
    .from("company_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  await admin.from("profiles").upsert({
    id: opts.userId,
    email: opts.userEmail ?? undefined,
    active_company_id: invite.company_id,
  });

  return { companyId: invite.company_id };
}
