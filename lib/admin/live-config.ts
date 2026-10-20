import { liveSiteEnabled } from "../gala/live-release";
import { readLiveConfig } from "../gala/backend/live-config";
export function liveAdminConfig(env: NodeJS.ProcessEnv = process.env) {
  if (!liveSiteEnabled(env)) throw new Error("Live administration is unavailable.");
  const config = readLiveConfig(env);
  const password = env.ADMIN_PASSWORD || "";
  if (!password || password.length > 256) throw new Error("Admin password is not configured.");
  return { key: config.token, password, origin: config.origin, url: config.url, dbKey: config.dbKey };
}
