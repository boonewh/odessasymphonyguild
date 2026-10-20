import { liveSiteEnabled } from "@/lib/gala/live-release";
import { requireSharedAdmin } from "@/lib/admin/test-page";
import SharedAdminNav from "./SharedAdminNav";
import { SharedDuesProvider } from "./DuesHeader";

// Reuse the existing roster, edits and pricing without copying membership data.
export default async function DuesAdminFrame({ children }: { children: React.ReactNode }) {
  if (!liveSiteEnabled(process.env)) return children;
  await requireSharedAdmin("/admin/dues");
  return <><div className="print:hidden"><SharedAdminNav current="dues" live /></div><SharedDuesProvider>{children}</SharedDuesProvider></>;
}
