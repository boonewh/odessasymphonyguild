import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { adminStudentSchema } from "@/lib/validation/student";
import { getLivePricing } from "@/lib/belles-beaux/pricing";
import { SECURE_HEADERS } from "@/lib/api-headers";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * GET /api/admin/students/[id]
 *
 * Returns a single student record for the edit page.
 * Protected by the admin session cookie verified in middleware.ts.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabase();

  const { data: student, error } = await supabase
    .from("students")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !student) {
    return NextResponse.json({ error: "Student not found." }, { status: 404, headers: SECURE_HEADERS });
  }

  return NextResponse.json({ student }, { headers: SECURE_HEADERS });
}

/**
 * PUT /api/admin/students/[id]
 * Body: adminStudentSchema fields
 *
 * Updates a student's info from the admin edit page. Recomputes dues only
 * when the membership type changes (preserving any applied late fee) —
 * the QuickBooks invoice is NOT auto-adjusted, so a warning is returned
 * when that happens. Protected by middleware.ts.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const parseResult = adminStudentSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid form data", details: parseResult.error.flatten() },
        { status: 400, headers: SECURE_HEADERS }
      );
    }

    const formData = parseResult.data;
    const supabase = getSupabase();

    const { data: existing, error: fetchError } = await supabase
      .from("students")
      .select("id, membership_type, dues_amount, late_fee_applied, late_fee_amount, qb_invoice_id")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Student not found." }, { status: 404, headers: SECURE_HEADERS });
    }

    let duesAmount = existing.dues_amount;
    let invoiceWarning: string | null = null;

    if (formData.membershipType !== existing.membership_type) {
      const { dues } = await getLivePricing();
      duesAmount =
        dues[formData.membershipType] +
        (existing.late_fee_applied ? existing.late_fee_amount ?? 0 : 0);
      if (existing.qb_invoice_id) {
        invoiceWarning =
          "The membership type changed, so the dues amount was updated on the roster — but the QuickBooks invoice was NOT changed. Please adjust the invoice in QuickBooks manually.";
      }
    }

    // Build guardian columns (all 4 written, so removed guardians are cleared)
    const guardianFields: Record<string, string | null> = {};
    for (let i = 0; i < 4; i++) {
      const g = formData.guardians[i];
      const n = i + 1;
      guardianFields[`guardian_${n}_relationship`] = g?.relationship || null;
      guardianFields[`guardian_${n}_name`]         = g?.name || null;
      guardianFields[`guardian_${n}_address`]      = g?.mailingAddress || null;
      guardianFields[`guardian_${n}_city`]         = g?.city || null;
      guardianFields[`guardian_${n}_state`]        = g?.state || null;
      guardianFields[`guardian_${n}_zip`]          = g?.zipCode || null;
      guardianFields[`guardian_${n}_cell`]         = g?.cellNumber || null;
      guardianFields[`guardian_${n}_email`]        = g?.email || null;
      guardianFields[`guardian_${n}_formal_name`]  = g?.formalName || null;
    }

    const { error: updateError } = await supabase
      .from("students")
      .update({
        first_name:      formData.firstName,
        middle_name:     formData.middleName || null,
        last_name:       formData.lastName,
        nickname:        formData.nickname || null,
        cell_number:     formData.cellNumber,
        school:          formData.school,
        grade:           formData.grade,
        gender:          formData.gender,
        tshirt_size:     formData.tshirtSize,
        membership_type: formData.membershipType,
        dues_amount:     duesAmount,
        ...guardianFields,
      })
      .eq("id", id);

    if (updateError) {
      console.error("[Edit Student] Supabase error:", updateError);
      return NextResponse.json({ error: "Failed to save changes." }, { status: 500, headers: SECURE_HEADERS });
    }

    return NextResponse.json({ success: true, duesAmount, invoiceWarning }, { headers: SECURE_HEADERS });
  } catch (error) {
    console.error("[Edit Student] Error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500, headers: SECURE_HEADERS }
    );
  }
}

/**
 * DELETE /api/admin/students/[id]
 *
 * Permanently removes a student record (duplicate entries, withdrawals).
 * Protected by the admin session cookie verified in middleware.ts.
 * Note: does NOT void any QuickBooks invoice — that must be done in QB.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = getSupabase();

  const { error } = await supabase.from("students").delete().eq("id", id);

  if (error) {
    console.error("[Delete Student] Supabase error:", error);
    return NextResponse.json({ error: "Failed to delete student." }, { status: 500, headers: SECURE_HEADERS });
  }

  return NextResponse.json({ success: true }, { headers: SECURE_HEADERS });
}
