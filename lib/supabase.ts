/**
 * Lazy Supabase client. `createClient` throws synchronously if the URL/key
 * are missing or empty, so it must never run at module scope — that would
 * crash every page's JS bundle when NEXT_PUBLIC_SUPABASE_URL/PUBLISHABLE_KEY
 * are unset (e.g. local dev without .env.local). Constructing it only inside
 * this getter, called only from the QOTD submit/fetch functions, keeps the
 * throw scoped to those calls instead of the whole app.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY missing)"
      );
    }
    client = createClient(url, key);
  }
  return client;
}
