import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Null when unconfigured — the app then runs in local-only mode so dev
// without creds still works.
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export function isCloudEnabled(): boolean {
  return supabase !== null;
}
