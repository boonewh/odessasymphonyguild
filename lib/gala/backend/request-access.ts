import "server-only";
import { readBackendConfig } from "./config";
import { AccessStore } from "./access-store";
import { cookieValue, STAFF_COOKIE, staffAccess, customerAccess } from "./access";
import { authorizeSharedAdmin } from "../../admin/test-server";
import { SHARED_ADMIN_COOKIE } from "../../admin/test-access";
import { LIVE_ADMIN_COOKIE } from "../../admin/live-session";
import { authorizeLiveCustomer } from "./live-customer";

export async function authorizeStaff(request: Request, accounting = false): Promise<string | undefined> {
  const config = readBackendConfig(process.env);
  if (config.hosted || cookieValue(request, SHARED_ADMIN_COOKIE)) {
    authorizeSharedAdmin(request); return undefined;
  }
  return staffAccess(request, config, accounting, (hash, permission) => new AccessStore(config.url, config.dbKey).staff(hash, permission));
}
export function authorizeCustomer(request: Request): string | undefined {
  const config = readBackendConfig(process.env);
  if (config.paymentMode === "live") return authorizeLiveCustomer(request, { key: config.token, origin: config.origin });
  if (cookieValue(request, SHARED_ADMIN_COOKIE)) {
    try { authorizeSharedAdmin(request); return undefined; } catch { /* Try the separate buyer session. */ }
  }
  return customerAccess(request, config);
}
// Staff may investigate existing orders. Customer creation always requires customer ownership.
export async function authorizeOrder(request: Request) {
  const config = readBackendConfig(process.env);
  if (config.paymentMode === "live" && cookieValue(request, LIVE_ADMIN_COOKIE)) {
    try { authorizeSharedAdmin(request); return undefined; } catch { /* A buyer may also have an expired admin cookie. */ }
  }
  if (config.accessMode === "individual" && cookieValue(request, STAFF_COOKIE)) {
    await authorizeStaff(request); return undefined;
  }
  return authorizeCustomer(request);
}
