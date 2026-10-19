import LegacyAdminLogin from "@/components/admin/LegacyAdminLogin";
import SharedAdminLogin from "@/components/admin/SharedAdminLogin";
import { sharedAdminTestEnabled, adminDestination } from "@/lib/admin/test-access";
export const dynamic = "force-dynamic";
export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!sharedAdminTestEnabled(process.env)) return <LegacyAdminLogin />;
  return <SharedAdminLogin destination={adminDestination((await searchParams).next)} />;
}
