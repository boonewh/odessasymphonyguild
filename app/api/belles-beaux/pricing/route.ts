import { NextResponse } from "next/server";
import { getLivePricing } from "@/lib/belles-beaux/pricing";
import { SECURE_HEADERS } from "@/lib/api-headers";

/**
 * GET /api/belles-beaux/pricing
 *
 * Returns current dues amounts from the settings table.
 * Falls back to hardcoded config values if the table is unavailable.
 * Public — no auth required.
 */
export async function GET() {
  const { dues, lateFee } = await getLivePricing();
  return NextResponse.json({ dues, lateFee }, { headers: SECURE_HEADERS });
}
