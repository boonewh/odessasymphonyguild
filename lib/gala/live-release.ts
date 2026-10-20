// October 20: production deployment authorized with submissions still closed.
// This enables routing only. Database operating flags independently gate new
// sales/invitations; webhook and recovery must work while those flags are closed.
const LIVE_RELEASE_APPROVED: boolean = true;
export function liveSiteEnabled(env: NodeJS.ProcessEnv) {
  return LIVE_RELEASE_APPROVED && env.NODE_ENV === "production" && env.VERCEL_ENV === "production"
    && env.GALA_LIVE_ENABLED === "true" && env.GALA_BOARD_REVIEW !== "true" && env.GALA_CLIENT_REVIEW !== "true";
}
