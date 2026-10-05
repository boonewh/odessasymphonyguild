import { NextRequest } from "next/server";
import { membershipOAuth } from "@/lib/quickbooks/membership-oauth";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  return membershipOAuth.callback(request);
}
