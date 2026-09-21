import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Server-only. Prefers the repo's SUPABASE_SECRET_KEY, then SUPABASE_SERVICE_ROLE_KEY. */
export function createServiceSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
