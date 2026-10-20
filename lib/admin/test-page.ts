import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { adminDestination, sharedAdminTestEnabled, SHARED_ADMIN_COOKIE } from "./test-access";
import { validAdminSession } from "./test-session";
import { sharedAdminConfig } from "./test-server";
import { liveSiteEnabled } from "../gala/live-release";
import { liveAdminConfig } from "./live-config";
import { LIVE_ADMIN_COOKIE } from "./live-session";
export async function requireSharedAdmin(destination = "/admin") {
  if (liveSiteEnabled(process.env)) {
    const config = liveAdminConfig();
    if (!validAdminSession((await cookies()).get(LIVE_ADMIN_COOKIE)?.value || "", config.key, config.password, Date.now(), "live"))
      redirect(`/admin/login?next=${encodeURIComponent(adminDestination(destination))}`);
    return;
  }
  if (!sharedAdminTestEnabled(process.env)) notFound();
  const config = sharedAdminConfig();
  if (!validAdminSession((await cookies()).get(SHARED_ADMIN_COOKIE)?.value || "", config.token, config.password))
    redirect(`/admin/login?next=${encodeURIComponent(adminDestination(destination))}`);
}
