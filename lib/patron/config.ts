import { liveSiteEnabled } from "../gala/live-release";
import { sharedAdminTestEnabled } from "../admin/test-access";
import { readBackendConfig } from "../gala/backend/config";
import { liveAdminConfig } from "../admin/live-config";

export function patronEnabled(env: NodeJS.ProcessEnv = process.env) {
  if (liveSiteEnabled(env)) return env.PATRON_ENABLED === "true";
  return env.NODE_ENV === "development" && !env.VERCEL && !env.VERCEL_ENV
    && sharedAdminTestEnabled(env) && env.PATRON_ENABLED !== "false";
}
export function patronConfig() {
  if (!patronEnabled()) throw new Error("Patron registration is unavailable.");
  if (liveSiteEnabled(process.env)) {
    const config = liveAdminConfig();
    return { ...config, local: false };
  }
  const config = readBackendConfig(process.env);
  return { origin: config.origin, key: config.token, local: true, url: "", dbKey: "" };
}
