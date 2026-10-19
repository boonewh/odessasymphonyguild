import "server-only";
import { readBackendConfig } from "../gala/backend/config";
import { sharedAdminTestEnabled } from "./test-access";
import { adminCookie, validAdminSession } from "./test-session";

export function sharedAdminConfig() {
  if (!sharedAdminTestEnabled(process.env)) throw new Error("Test administration is unavailable.");
  const config = readBackendConfig(process.env);
  return { ...config, password: process.env.GALA_BOARD_ACCESS_CODE || config.accessCode };
}
export function authorizeSharedAdmin(request: Request) {
  const config = sharedAdminConfig();
  if (!validAdminSession(adminCookie(request), config.token, config.password)) throw new Error("Admin sign-in required.");
  if (!["GET", "HEAD"].includes(request.method) && request.headers.get("origin") !== config.origin)
    throw new Error("Same-origin request required.");
}
