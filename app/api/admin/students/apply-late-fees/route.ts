import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { BELLES_BEAUX_CONFIG } from "@/lib/belles-beaux/config";
import { getLivePricing } from "@/lib/belles-beaux/pricing";
import { setInvoiceLateFee } from "@/lib/quickbooks/invoice-service";
import { SECURE_HEADERS } from "@/lib/api-headers";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * POST /api/admin/students/apply-late-fees
 *
 * Bulk-applies the current late fee to every unpaid student in the current
 * school year who doesn't already have one. Safe to run repeatedly — students
 * already carrying a fee are skipped, so a re-run only catches newcomers.
 * QuickBooks invoices are updated to match; failures there don't stop the
 * roster update but are reported back. Protected by middleware.ts.
 */
export async function POST() {
  try {
    const supabase = getSupabase();
    const { lateFee } = await getLivePricing();

    const { data: students, error } = await supabase
      .from("students")
      .select("id, first_name, last_name, dues_amount, qb_invoice_id")
      .eq("school_year", BELLES_BEAUX_CONFIG.schoolYear)
      .eq("paid", false)
      .eq("late_fee_applied", false);

    if (error || !students) {
      console.error("[Bulk Late Fee] Supabase error:", error);
      return NextResponse.json({ error: "Failed to load students." }, { status: 500, headers: SECURE_HEADERS });
    }

    const qbEnabled = process.env.ENABLE_QUICKBOOKS_SYNC === "true";
    let applied = 0;
    const qbFailures: string[] = [];
    const dbFailures: string[] = [];

    // Sequential on purpose — avoids hammering the QB API
    for (const s of students) {
      const name = `${s.first_name} ${s.last_name}`;

      if (s.qb_invoice_id && qbEnabled) {
        try {
          await setInvoiceLateFee(s.qb_invoice_id, lateFee, true);
        } catch (qbError) {
          console.error("[Bulk Late Fee] QB update failed for", name, qbError);
          qbFailures.push(name);
        }
      }

      const { error: updateError } = await supabase
        .from("students")
        .update({
          dues_amount:      s.dues_amount + lateFee,
          late_fee_applied: true,
          late_fee_amount:  lateFee,
        })
        .eq("id", s.id);

      if (updateError) {
        console.error("[Bulk Late Fee] DB update failed for", name, updateError);
        dbFailures.push(name);
      } else {
        applied++;
      }
    }

    console.log("[Bulk Late Fee] Done:", { eligible: students.length, applied, qbFailures, dbFailures });

    return NextResponse.json(
      {
        success: true,
        lateFee,
        eligible: students.length,
        applied,
        qbEnabled,
        qbFailures,
        dbFailures,
      },
      { headers: SECURE_HEADERS }
    );
  } catch (error) {
    console.error("[Bulk Late Fee] Error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500, headers: SECURE_HEADERS }
    );
  }
}
