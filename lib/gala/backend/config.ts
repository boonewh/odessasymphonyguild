import { boardReviewAllowed, BOARD_ORIGIN } from "../board-review";
export const DEVELOPMENT_STRIPE_ACCOUNT = "acct_1UMExUDSZ6A0MvjE";
export const DEVELOPMENT_SUPABASE_URL = "https://rhjwjfyjjdsfahlegqvd.supabase.co";
export function backendEnabled(env: NodeJS.ProcessEnv) {
  return boardReviewAllowed(env) || (env.NODE_ENV === "development" && !env.VERCEL_ENV && !env.VERCEL
    && env.GALA_BACKEND_ENABLED === "true" && env.GALA_CLIENT_REVIEW !== "true" && env.GALA_BOARD_REVIEW !== "true");
}
export function readBackendConfig(env: NodeJS.ProcessEnv) {
  if (!backendEnabled(env)) throw new Error("Gala backend is restricted to explicitly enabled test environments.");
  const hosted = boardReviewAllowed(env);
  const accessMode = env.GALA_ACCESS_MODE || "development";
  if (accessMode !== "development" && accessMode !== "individual") throw new Error("Unknown Gala access mode.");
  // The board rehearsal intentionally permits every tester to inspect fictional orders.
  // Named staff/customer isolation remains a separate, locally tested workflow.
  if (hosted && accessMode !== "development") throw new Error("Board review requires shared test access.");
  const key = env.GALA_STRIPE_SECRET_KEY || "";
  const url = env.GALA_SUPABASE_URL || "";
  const dbKey = env.GALA_SUPABASE_SECRET_KEY || "";
  const webhookSecret = env.GALA_STRIPE_WEBHOOK_SECRET || "";
  const token = env.GALA_DEVELOPMENT_TOKEN || "";
  const origin = hosted ? BOARD_ORIGIN : env.GALA_LOCAL_ORIGIN || "http://localhost:3000";
  const accessCode = hosted ? env.GALA_BOARD_ACCESS_CODE || "" : token;
  if (hosted && (!/^[A-Za-z0-9_-]{8,128}$/.test(accessCode) || accessCode === token))
    throw new Error("A separate board test access code is required.");
  if (hosted && env.GALA_QB_SYNC_ENABLED === "true") throw new Error("Board review cannot send accounting entries.");
  if (!/^(sk|rk)_test_\S+$/.test(key)) throw new Error("A Stripe sandbox key is required.");
  if (url !== DEVELOPMENT_SUPABASE_URL || !dbKey.startsWith("sb_secret_"))
    throw new Error("Development Supabase credentials are required.");
  if (!webhookSecret.startsWith("whsec_") || !/^[a-f0-9]{64}$/.test(token))
    throw new Error("Webhook signing secret and local development token are required.");
  if (!hosted && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) throw new Error("A loopback return URL is required.");
  return { key, url, dbKey, webhookSecret, token, origin, accessMode, hosted, accessCode };
}
