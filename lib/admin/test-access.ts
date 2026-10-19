import { boardReviewAllowed } from "../gala/board-review";

// This entrance is intentionally unavailable on production and other previews.
export function sharedAdminTestEnabled(env: NodeJS.ProcessEnv) {
  return boardReviewAllowed(env) || (env.NODE_ENV === "development" && !env.VERCEL && !env.VERCEL_ENV
    && env.GALA_BACKEND_ENABLED === "true" && env.GALA_ACCESS_MODE !== "individual"
    && env.GALA_CLIENT_REVIEW !== "true" && env.GALA_BOARD_REVIEW !== "true");
}
export const SHARED_ADMIN_COOKIE = "osg_test_admin_session";
export const ADMIN_SECONDS = 8 * 3600;
export function adminDestination(value: unknown) {
  return value === "/admin/gala" || value === "/admin/dues" ? value : "/admin";
}
