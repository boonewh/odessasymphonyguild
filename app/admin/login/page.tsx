import LegacyAdminLogin from "@/components/admin/LegacyAdminLogin";
import SharedAdminLogin from "@/components/admin/SharedAdminLogin";
import { sharedAdminTestEnabled, adminDestination } from "@/lib/admin/test-access";
import { liveSiteEnabled } from "@/lib/gala/live-release";
export const dynamic = "force-dynamic";
export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const live = liveSiteEnabled(process.env);
  if (!live && !sharedAdminTestEnabled(process.env)) return <LegacyAdminLogin />;
  return <SharedAdminLogin live={live} destination={adminDestination((await searchParams).next)} />;
}
