import { boardReviewAllowed } from "../board-review";
import { liveSiteEnabled } from "../live-release";
import { equalSecret } from "./auth";

export function scheduledRecoveryEnabled(env: NodeJS.ProcessEnv) {
  return liveSiteEnabled(env) || boardReviewAllowed(env);
}

export function authorizeScheduledRecovery(request: Request, env: NodeJS.ProcessEnv) {
  if (request.method !== "POST" || !scheduledRecoveryEnabled(env)) return false;
  const live = liveSiteEnabled(env);
  const secret = (live ? env.GALA_LIVE_RECOVERY_SECRET : env.GALA_RECOVERY_SECRET) || "";
  // A scheduler credential cannot double as a browser login/session credential,
  // and the live worker must never accept the Preview scheduler's credential.
  const otherSecrets = [
    env.GALA_DEVELOPMENT_TOKEN, env.GALA_BOARD_ACCESS_CODE, env.GALA_LIVE_SESSION_SECRET,
    env.ADMIN_PASSWORD, live ? env.GALA_RECOVERY_SECRET : env.GALA_LIVE_RECOVERY_SECRET,
  ];
  if (!/^[a-f0-9]{64}$/.test(secret) || otherSecrets.some(value => value === secret)) return false;
  return equalSecret(request.headers.get("authorization") || "", `Bearer ${secret}`);
}
