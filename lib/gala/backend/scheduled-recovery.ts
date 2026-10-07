import { boardReviewAllowed } from "../board-review";
import { equalSecret } from "./auth";

export function authorizeScheduledRecovery(request: Request, env: NodeJS.ProcessEnv) {
  if (!boardReviewAllowed(env)) return false;
  const secret = env.GALA_RECOVERY_SECRET || "";
  if (!/^[a-f0-9]{64}$/.test(secret) || secret === env.GALA_DEVELOPMENT_TOKEN || secret === env.GALA_BOARD_ACCESS_CODE) return false;
  return equalSecret(request.headers.get("authorization") || "", `Bearer ${secret}`);
}
