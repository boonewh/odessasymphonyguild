// Separate names prevent Preview credentials from becoming live credentials.
export function readLiveConfig(env: NodeJS.ProcessEnv) {
  const origin = env.GALA_LIVE_ORIGIN || "";
  const url = env.GALA_LIVE_SUPABASE_URL || "";
  const key = env.GALA_LIVE_STRIPE_SECRET_KEY || "";
  const dbKey = env.GALA_LIVE_SUPABASE_SECRET_KEY || "";
  const webhookSecret = env.GALA_LIVE_STRIPE_WEBHOOK_SECRET || "";
  const token = env.GALA_LIVE_SESSION_SECRET || "";
  if (!/^https:\/\/[a-z0-9.-]+$/.test(origin) || new URL(origin).origin !== origin
    || origin.endsWith(".vercel.app") || origin === "https://localhost") throw new Error("Approved live HTTPS origin required.");
  if (!/^https:\/\/[a-z]{20}\.supabase\.co$/.test(url)
    || url === "https://rhjwjfyjjdsfahlegqvd.supabase.co" || !dbKey.startsWith("sb_secret_"))
    throw new Error("Approved production database with the live Gala schema required.");
  if (!/^(sk|rk)_live_\S+$/.test(key) || !webhookSecret.startsWith("whsec_") || !/^[a-f0-9]{64}$/.test(token))
    throw new Error("Live payment and session configuration required.");
  return { key, url, dbKey, webhookSecret, token, origin, accessMode: "live", hosted: true,
    accessCode: "", paymentMode: "live" as const };
}
