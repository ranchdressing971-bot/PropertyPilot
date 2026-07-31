"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useCompanyRole } from "@/hooks/useCompanyRole";
import { Loader2, Copy, UserPlus, Trash2 } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";

interface Member {
  user_id: string;
  role: string;
  status: string;
  email: string | null;
  fullName: string | null;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  token: string;
}

export function TeamCard() {
  const { isAdmin, loading: roleLoading, companyName, role } = useCompanyRole();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"inspector" | "admin">("inspector");
  const [submitting, setSubmitting] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/company/members", { credentials: "include" });
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setMembers(data.members ?? []);
    setInvites(data.invites ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (roleLoading) return;
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [roleLoading, isAdmin, refresh]);

  if (roleLoading || loading) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-sm text-ink-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading team…
        </div>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <h3 className="font-semibold text-ink-900">Team</h3>
        <p className="mt-1 text-sm text-ink-500">
          You’re signed in as <span className="font-medium text-ink-700">{role}</span>
          {companyName ? ` on ${companyName}` : ""}. Ask an admin to change roles or invites.
        </p>
      </Card>
    );
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setLastInviteUrl(null);
    try {
      const res = await fetch("/api/company/invites", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invite failed");
      setLastInviteUrl(data.inviteUrl);
      setEmail("");
      toast("Invite created — copy the link to send");
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function changeRole(userId: string, nextRole: "admin" | "inspector") {
    const res = await fetch(`/api/company/members/${userId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: nextRole }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error ?? "Could not update role");
      return;
    }
    toast("Role updated");
    await refresh();
  }

  async function removeMember(userId: string) {
    if (!confirm("Remove this person from the company?")) return;
    const res = await fetch(`/api/company/members/${userId}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error ?? "Could not remove member");
      return;
    }
    toast("Member removed");
    await refresh();
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink-900">Team</h3>
          <p className="mt-1 text-sm text-ink-500">
            Invite inspectors to upload and run inspections on{" "}
            {companyName ?? "your HOA"} without billing access.
          </p>
        </div>
        <UserPlus className="h-5 w-5 shrink-0 text-ink-400" />
      </div>

      <form onSubmit={sendInvite} className="mt-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="inspector@email.com"
            className="h-11 flex-1 rounded-xl border border-ink-200 px-4 text-sm focus:border-accent-300 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as "inspector" | "admin")}
            className="h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm"
          >
            <option value="inspector">Inspector</option>
            <option value="admin">Admin</option>
          </select>
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Invite"}
          </Button>
        </div>
      </form>

      {lastInviteUrl && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50/60 px-3 py-2">
          <p className="min-w-0 flex-1 truncate text-xs text-ink-700">{lastInviteUrl}</p>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-800 hover:bg-brand-100"
            onClick={async () => {
              await navigator.clipboard.writeText(lastInviteUrl);
              toast("Invite link copied");
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </button>
        </div>
      )}

      <div className="mt-5 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
          Members
        </p>
        {members.map((m) => (
          <div
            key={m.user_id}
            className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink-900">
                {m.fullName || m.email || m.user_id.slice(0, 8)}
              </p>
              <p className="truncate text-xs text-ink-500">{m.email}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {m.role === "owner" ? (
                <span className="rounded-lg bg-ink-100 px-2 py-1 text-xs font-medium text-ink-700">
                  Owner
                </span>
              ) : (
                <>
                  <select
                    value={m.role}
                    onChange={(e) =>
                      changeRole(m.user_id, e.target.value as "admin" | "inspector")
                    }
                    className="h-8 rounded-lg border border-ink-200 bg-white px-2 text-xs"
                  >
                    <option value="admin">Admin</option>
                    <option value="inspector">Inspector</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeMember(m.user_id)}
                    className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove member"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {invites.length > 0 && (
        <div className="mt-5 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            Pending invites
          </p>
          {invites.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-ink-200 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink-800">{inv.email}</p>
                <p className="text-xs text-ink-500 capitalize">{inv.role}</p>
              </div>
              <button
                type="button"
                className="text-xs font-medium text-brand-700 hover:underline"
                onClick={async () => {
                  const origin = window.location.origin;
                  const url = `${origin}/invite/${inv.token}`;
                  await navigator.clipboard.writeText(url);
                  toast("Invite link copied");
                }}
              >
                Copy link
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
