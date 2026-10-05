import { createClient } from "@supabase/supabase-js";
import type { OAuthStateStore } from "./oauth-flow";

export function oauthStateStore(): OAuthStateStore {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("OAuth state storage is not configured.");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  async function rpc(name: string, state: string, binding: string, context: string) {
    const { data, error } = await client.rpc(name, { p_state: state, p_binding: binding, p_context: context });
    if (error) throw new Error("OAuth state storage failed.");
    return data;
  }
  return {
    issue: async (...args) => { await rpc("qb_oauth_issue", ...args); },
    consume: async (...args) => (await rpc("qb_oauth_consume", ...args)) === true,
  };
}
