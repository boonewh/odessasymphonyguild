import { SECURE_HEADERS } from "@/lib/api-headers";
export const runtime = "nodejs";
// Retire contact-only signup, including forms still open from an older release.
export async function POST() {
  return Response.json({ error: "Please refresh the Patron page to continue to secure Stripe checkout." }, { status: 410, headers: SECURE_HEADERS });
}
