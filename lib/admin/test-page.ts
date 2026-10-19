import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { adminDestination, sharedAdminTestEnabled, SHARED_ADMIN_COOKIE } from "./test-access";
import { validAdminSession } from "./test-session";
import { sharedAdminConfig } from "./test-server";
export async function requireSharedAdmin(destination = "/admin") {
  if (!sharedAdminTestEnabled(process.env)) notFound();
  const config = sharedAdminConfig();
  if (!validAdminSession((await cookies()).get(SHARED_ADMIN_COOKIE)?.value || "", config.token, config.password))
    redirect(`/admin/login?next=${encodeURIComponent(adminDestination(destination))}`);
}
