// Supabase Edge Functions - Server-Side Privileged Client
// Release 3: Secure Backend Foundation
//
// IMPORTANT:
// This file is used EXCLUSIVELY inside Supabase Edge Functions / Server environment.
// It relies on Deno.env and SUPABASE_SERVICE_ROLE_KEY.
// It is NEVER bundled or imported in the React frontend.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

let serverClientInstance: SupabaseClient | null = null;

export function getServerSupabaseClient(): SupabaseClient {
  if (serverClientInstance) {
    return serverClientInstance;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing server-side Supabase credentials: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in Edge environment."
    );
  }

  serverClientInstance = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return serverClientInstance;
}
