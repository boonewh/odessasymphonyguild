// Deliberately pinned to this feature branch and its existing Preview alias.
// No production environment, custom domain or arbitrary redirect is accepted.
export const BOARD_BRANCH = "codex/gala-2027-planning";
export const BOARD_PROJECT = "prj_cwIGWVxKZvupGLxJGyXdnKE3Fiha";
export const BOARD_ORIGIN = "https://odessasymphonyguild-git-codex-gala-202-a1c1b0-boonewhs-projects.vercel.app";

export function boardReviewAllowed(env: NodeJS.ProcessEnv) {
  return env.VERCEL_ENV === "preview" && env.VERCEL === "1"
    && env.VERCEL_PROJECT_ID === BOARD_PROJECT && env.VERCEL_GIT_COMMIT_REF === BOARD_BRANCH
    && env.GALA_BOARD_REVIEW === "true" && env.GALA_CLIENT_REVIEW !== "true"
    && env.GALA_BACKEND_ENABLED === "true" && env.GALA_BOARD_ORIGIN === BOARD_ORIGIN;
}

const apiMethods: Record<string, readonly string[]> = {
  "/api/gala/session": ["GET", "POST", "DELETE"],
  "/api/gala/orders": ["GET"],
  "/api/gala/order": ["GET"],
  "/api/gala/checkout": ["POST"],
  "/api/gala/assignments": ["GET", "POST"],
  "/api/gala/gifts": ["GET", "POST"],
  "/api/gala/invitations": ["GET", "POST", "PATCH"],
  "/api/gala/expire": ["POST"],
  "/api/gala/reconcile": ["POST"],
  "/api/gala/recovery": ["GET", "POST"],
  "/api/gala/quickbooks/status": ["GET"],
  "/api/gala/webhook": ["POST"],
  "/api/gala/recovery/run": ["POST"],
};
export function boardReviewRequest(pathname: string, method: string) {
  if (apiMethods[pathname]?.includes(method)) return "allowed";
  if (method !== "GET" && method !== "HEAD") return "blocked";
  if (pathname === "/") return "redirect";
  if (["/gala/tables", "/gala/gifts", "/gala/invitations", "/gala/preview/admin", "/gala/preview/payment"].includes(pathname)) return "allowed";
  if (pathname.startsWith("/_next/static/") || pathname === "/_next/image" || pathname.startsWith("/images/") || pathname === "/favicon.ico") return "allowed";
  return "blocked";
}
