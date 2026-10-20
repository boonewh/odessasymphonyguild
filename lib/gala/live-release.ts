// Change only in the explicitly approved release commit, after configuration
// and hosted acceptance. Environment variables cannot open production today.
const LIVE_RELEASE_APPROVED: boolean = false;
export function liveSiteEnabled(env: NodeJS.ProcessEnv) {
  return LIVE_RELEASE_APPROVED && env.NODE_ENV === "production" && env.VERCEL_ENV === "production"
    && env.GALA_LIVE_ENABLED === "true" && env.GALA_BOARD_REVIEW !== "true" && env.GALA_CLIENT_REVIEW !== "true";
}
