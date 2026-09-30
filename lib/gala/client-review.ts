// Explicit opt-in on Vercel Preview only; never opens production sales.
export function clientReviewAllowed(vercelEnv?: string, reviewFlag?: string) {
  return vercelEnv === "preview" && reviewFlag === "true";
}

export function clientReviewRequest(pathname: string, method: string) {
  if (method !== "GET" && method !== "HEAD") return "blocked";
  if (pathname === "/") return "redirect";
  if (["/gala/tables", "/gala/gifts", "/gala/invitations"].includes(pathname)) return "allowed";
  if (pathname.startsWith("/_next/static/") || pathname === "/_next/image" || pathname.startsWith("/images/") || pathname === "/favicon.ico") return "allowed";
  return "blocked";
}
