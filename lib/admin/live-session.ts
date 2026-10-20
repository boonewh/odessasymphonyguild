// Mounted behind the closed release gate; distinct from buyer and test sessions.
import { createAdminSession, validAdminSession } from "./test-session";
import { ADMIN_SECONDS } from "./test-access";
import { cookieValue, sameOrigin } from "../gala/backend/access";

export const LIVE_ADMIN_COOKIE = "__Host-osg_admin_session";
export const liveAdminCookieOptions = Object.freeze({
  httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: ADMIN_SECONDS,
});
export type LiveAdminConfig = { key: string; password: string; origin: string };
function validate(config: LiveAdminConfig) {
  const origin = new URL(config.origin);
  if (config.key.length < 32 || !config.password || origin.protocol !== "https:"
    || config.origin !== origin.origin || origin.username || origin.password)
    throw new Error("Live administration is not configured.");
}
export function createLiveAdminSession(config: LiveAdminConfig, now = Date.now()) {
  validate(config);
  return createAdminSession(config.key, config.password, now, "live");
}
export function authorizeLiveAdmin(request: Request, config: LiveAdminConfig, now = Date.now()) {
  validate(config);
  sameOrigin(request, config.origin);
  if (!validAdminSession(cookieValue(request, LIVE_ADMIN_COOKIE), config.key, config.password, now, "live"))
    throw new Error("Admin sign-in required.");
}
