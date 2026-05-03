import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { UserProfile } from "./forager-types";
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
