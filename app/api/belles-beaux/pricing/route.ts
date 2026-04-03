import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DUES, LATE_FEE } from "@/lib/belles-beaux/config";
import { SECURE_HEADERS } from "@/lib/api-headers";

/**
 * GET /api/belles-beaux/pricing
 *
 * Returns current dues amounts from the settings table.
 * Falls back to hardcoded config values if the table is unavailable.
 * Public — no auth required.
 */
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
    );

    const { data, error } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", [
        "dues_freshman",
        "dues_returning",
        "dues_new_sophomore",
        "dues_new_junior",
        "dues_new_senior",
        "late_fee",
      ]);

    if (error || !data?.length) {
      // Fall back to hardcoded config
      return NextResponse.json({ dues: DUES, lateFee: LATE_FEE }, { headers: SECURE_HEADERS });
    }

    const map = Object.fromEntries(data.map((r) => [r.key, parseInt(r.value, 10)]));

    return NextResponse.json(
      {
        dues: {
          freshman:      map.dues_freshman      ?? DUES.freshman,
          returning:     map.dues_returning     ?? DUES.returning,
          new_sophomore: map.dues_new_sophomore ?? DUES.new_sophomore,
          new_junior:    map.dues_new_junior    ?? DUES.new_junior,
          new_senior:    map.dues_new_senior    ?? DUES.new_senior,
        },
        lateFee: map.late_fee ?? LATE_FEE,
      },
      { headers: SECURE_HEADERS }
    );
  } catch {
    return NextResponse.json({ dues: DUES, lateFee: LATE_FEE }, { headers: SECURE_HEADERS });
  }
}
