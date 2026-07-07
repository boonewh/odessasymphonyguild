import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getLivePricing } from "@/lib/belles-beaux/pricing";
import { setInvoiceLateFee } from "@/lib/quickbooks/invoice-service";
import { SECURE_HEADERS } from "@/lib/api-headers";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * POST /api/admin/students/[id]/late-fee
 * Body: { apply: boolean }
 *
 * Manually applies (or removes) the late fee for an unpaid student. Adjusts
 * dues_amount and, when a QuickBooks invoice exists, adds/removes a late-fee
 * line so the online payment amount matches. Applied by an admin — never
 * automatically at the deadline. Protected by middleware.ts.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { apply } = await request.json();

  if (typeof apply !== "boolean") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: SECURE_HEADERS });
  }

  const supabase = getSupabase();

  const { data: student, error: fetchError } = await supabase
    .from("students")
    .select("id, paid, dues_amount, late_fee_applied, late_fee_amount, qb_invoice_id")
    .eq("id", id)
    .single();

  if (fetchError || !student) {
    return NextResponse.json({ error: "Student not found." }, { status: 404, headers: SECURE_HEADERS });
  }

  if (student.paid) {
    return NextResponse.json(
      { error: "Dues are already paid — the late fee can no longer be changed." },
      { status: 400, headers: SECURE_HEADERS }
    );
  }
  if (apply && student.late_fee_applied) {
    return NextResponse.json({ error: "Late fee is already applied." }, { status: 400, headers: SECURE_HEADERS });
  }
  if (!apply && !student.late_fee_applied) {
    return NextResponse.json({ error: "No late fee to remove." }, { status: 400, headers: SECURE_HEADERS });
  }

  // Apply the current admin-set fee; remove exactly what was added back then
  const { lateFee } = await getLivePricing();
  const feeAmount = apply ? lateFee : (student.late_fee_amount ?? lateFee);
  const newDues = apply
    ? student.dues_amount + feeAmount
    : student.dues_amount - feeAmount;

  // Keep the QB invoice in sync so the parent pays the right amount online
  let invoiceWarning: string | null = null;
  if (student.qb_invoice_id && process.env.ENABLE_QUICKBOOKS_SYNC === "true") {
    try {
      await setInvoiceLateFee(student.qb_invoice_id, feeAmount, apply);
    } catch (qbError) {
      console.error("[Late Fee] QB invoice update failed:", qbError);
      invoiceWarning =
        "The roster was updated, but the QuickBooks invoice could not be changed. Please adjust the invoice in QuickBooks manually.";
    }
  }

  const { error: updateError } = await supabase
    .from("students")
    .update({
      dues_amount:      newDues,
      late_fee_applied: apply,
      late_fee_amount:  apply ? feeAmount : null,
    })
    .eq("id", id);

  if (updateError) {
    console.error("[Late Fee] Supabase error:", updateError);
    return NextResponse.json({ error: "Failed to update student." }, { status: 500, headers: SECURE_HEADERS });
  }

  return NextResponse.json(
    {
      success: true,
      duesAmount:     newDues,
      lateFeeApplied: apply,
      lateFeeAmount:  apply ? feeAmount : null,
      invoiceWarning,
    },
    { headers: SECURE_HEADERS }
  );
}
