import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { TokenUsageSummary, UserProfile } from "./forager-types";
import { profileToRow, rowToProfile, type ProfileRow } from "./forager-mappings";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null;

export const supabaseAvailable = Boolean(supabase);

export async function loadProfile(authUserId: string): Promise<UserProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) {
    console.warn("[forager] loadProfile failed", error);
    return null;
  }
  if (!data) return null;
  return rowToProfile(data as ProfileRow);
}

export async function saveProfileRemote(profile: UserProfile): Promise<boolean> {
  if (!supabase) return false;
  if (profile.profileMode === "guest") return false;
  if (!profile.authUserId) return false;
  const row = profileToRow(profile);
  const { error } = await supabase
    .from("profiles")
    .upsert(row, { onConflict: "auth_user_id" });
  if (error) {
    console.warn("[forager] profile upsert failed", error);
    return false;
  }
  return true;
}

export async function signInWithGoogle(redirectPath = "/onboarding"): Promise<{ ok: boolean; reason?: string }> {
  if (!supabase) return { ok: false, reason: "Sign-in not configured for this build." };
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}${redirectPath}`
      : redirectPath;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) {
    console.warn("[forager] OAuth error", error);
    return { ok: false, reason: error.message };
  }
  return { ok: true };
}

export async function getAuthUser(): Promise<{
  id: string;
  email?: string | null;
  displayName?: string | null;
} | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  if (!u) return null;
  return {
    id: u.id,
    email: u.email ?? null,
    displayName:
      (u.user_metadata?.full_name as string | undefined) ??
      (u.user_metadata?.name as string | undefined) ??
      null,
  };
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export type TokenUsageLogRow = {
  id?: string;
  auth_user_id?: string | null;
  route: string;
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  call_count: number;
  usage_json: TokenUsageSummary;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
};

/**
 * Optional persistence for Nemotron token usage.
 *
 * Create a Supabase table named `token_usage_logs` before calling this:
 *
 * create table token_usage_logs (
 *   id uuid primary key default gen_random_uuid(),
 *   auth_user_id uuid null,
 *   route text not null,
 *   provider text not null,
 *   model text not null,
 *   prompt_tokens integer not null default 0,
 *   completion_tokens integer not null default 0,
 *   total_tokens integer not null default 0,
 *   call_count integer not null default 0,
 *   usage_json jsonb not null,
 *   metadata jsonb,
 *   created_at timestamptz not null default now()
 * );
 */
export async function saveTokenUsageRemote(args: {
  authUserId?: string | null;
  route: string;
  tokenUsage?: TokenUsageSummary;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  if (!supabase) return false;
  if (!args.tokenUsage) return false;

  const totals = args.tokenUsage.totals;
  const row: TokenUsageLogRow = {
    auth_user_id: args.authUserId ?? null,
    route: args.route,
    provider: args.tokenUsage.provider,
    model: args.tokenUsage.model,
    prompt_tokens: totals.prompt_tokens,
    completion_tokens: totals.completion_tokens,
    total_tokens: totals.total_tokens,
    call_count: totals.call_count,
    usage_json: args.tokenUsage,
    metadata: args.metadata ?? null,
  };

  const { error } = await supabase.from("token_usage_logs").insert(row);
  if (error) {
    console.warn("[forager] token usage insert failed", error);
    return false;
  }
  return true;
}
