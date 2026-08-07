import { createClient } from "@supabase/supabase-js";

declare global {
  // eslint-disable-next-line no-var
  var _supabaseClient: ReturnType<typeof createClient> | undefined;
}

function getSupabase() {
  if (!globalThis._supabaseClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required.");
    }
    globalThis._supabaseClient = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return globalThis._supabaseClient;
}

export function supabase() {
  return getSupabase();
}
