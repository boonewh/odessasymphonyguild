import { createClient } from "@supabase/supabase-js";
import { DUES, LATE_FEE } from "./config";
import { MembershipType } from "@/types/student";

export interface LivePricing {
  dues: Record<MembershipType, number>;
  lateFee: number;
}

/**
 * Current dues from the admin-managed `settings` table (edited at
 * /admin/pricing). Falls back to the hardcoded config defaults if the
 * table is unavailable. Single source of truth for BOTH the prices
 * displayed on forms and the amounts billed on invoices.
 */
export async function getLivePricing(): Promise<LivePricing> {
  const fallback: LivePricing = { dues: DUES, lateFee: LATE_FEE };

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

    if (error || !data?.length) return fallback;

    // Ignore rows that don't parse to a valid number
    const map: Record<string, number> = {};
    for (const row of data) {
      const n = parseInt(row.value, 10);
      if (Number.isFinite(n)) map[row.key] = n;
    }

    return {
      dues: {
        freshman:      map.dues_freshman      ?? DUES.freshman,
        returning:     map.dues_returning     ?? DUES.returning,
        new_sophomore: map.dues_new_sophomore ?? DUES.new_sophomore,
        new_junior:    map.dues_new_junior    ?? DUES.new_junior,
        new_senior:    map.dues_new_senior    ?? DUES.new_senior,
      },
      lateFee: map.late_fee ?? LATE_FEE,
    };
  } catch {
    return fallback;
  }
}
