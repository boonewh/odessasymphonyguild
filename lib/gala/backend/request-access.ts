import "server-only";
import { readBackendConfig } from "./config";
import { AccessStore } from "./access-store";
import { cookieValue, STAFF_COOKIE, staffAccess, customerAccess } from "./access";

export async function authorizeStaff(request: Request, accounting = false): Promise<string | undefined> {
  const config = readBackendConfig(process.env);
  return staffAccess(request, config, accounting, (hash, permission) => new AccessStore(config.url, config.dbKey).staff(hash, permission));
}
export function authorizeCustomer(request: Request): string | undefined {
  const config = readBackendConfig(process.env);
  return customerAccess(request, config);
}
// Staff may investigate existing orders. Customer creation always requires customer ownership.
export async function authorizeOrder(request: Request) {
  const config = readBackendConfig(process.env);
  if (config.accessMode === "individual" && cookieValue(request, STAFF_COOKIE)) {
    await authorizeStaff(request); return undefined;
  }
  return authorizeCustomer(request);
}
