import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { studentFormSchema } from "@/lib/validation/student";
import { BELLES_BEAUX_CONFIG, calculateDues } from "@/lib/belles-beaux/config";
import { SECURE_HEADERS } from "@/lib/api-headers";
import { createStudentInvoice } from "@/lib/quickbooks/invoice-service";

// Server-side Supabase client (bypasses RLS for trusted server operations)
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;
  return createClient(url, key);
}

/**
 * POST /api/belles-beaux/submit
 *
 * 1. Validates form data (including cross-field parent email check)
 * 2. Calculates dues based on grade + membership type
 * 3. Saves student record to Supabase
 * 4. TODO: Creates QuickBooks customer + invoice, returns payment link
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate — includes cross-field parent email requirement
    const parseResult = studentFormSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid form data", details: parseResult.error.flatten() },
        { status: 400, headers: SECURE_HEADERS }
      );
    }

    const formData = parseResult.data;
    const duesAmount = calculateDues(formData.membershipType);

    // Collect parent emails for invoice delivery
    const invoiceEmails: string[] = [];
    if (formData.mom?.email?.trim()) invoiceEmails.push(formData.mom.email.trim());
    if (formData.dad?.email?.trim()) invoiceEmails.push(formData.dad.email.trim());

    // ── Save to Supabase ───────────────────────────────────────────────────────
    const supabase = getSupabase();

    const { data: student, error: dbError } = await supabase
      .from("students")
      .insert({
        school_year:     BELLES_BEAUX_CONFIG.schoolYear,
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
        mom_name:        formData.mom?.name || null,
        mom_address:     formData.mom?.mailingAddress || null,
        mom_city:        formData.mom?.city || null,
        mom_state:       formData.mom?.state || null,
        mom_zip:         formData.mom?.zipCode || null,
        mom_cell:        formData.mom?.cellNumber || null,
        mom_email:       formData.mom?.email || null,
        mom_formal_name: formData.mom?.formalName || null,
        dad_name:        formData.dad?.name || null,
        dad_address:     formData.dad?.mailingAddress || null,
        dad_city:        formData.dad?.city || null,
        dad_state:       formData.dad?.state || null,
        dad_zip:         formData.dad?.zipCode || null,
        dad_cell:        formData.dad?.cellNumber || null,
        dad_email:       formData.dad?.email || null,
        dad_formal_name: formData.dad?.formalName || null,
      })
      .select()
      .single();

    if (dbError) {
      console.error("[B&B Submit] Database error:", dbError);
      throw new Error("Failed to save your application. Please try again.");
    }

    console.log("[B&B Submit] Saved student:", student.id, {
      name: `${formData.firstName} ${formData.lastName}`,
      membershipType: formData.membershipType,
      duesAmount,
      invoiceEmails,
    });

    // ── QuickBooks Invoice ─────────────────────────────────────────────────────
    let paymentLink: string | null = null;

    if (process.env.ENABLE_QUICKBOOKS_SYNC === "true" || process.env.MOCK_PAYMENT_MODE === "true") {
      try {
        // Use first available parent name + primary email for the QB customer
        const parentName =
          formData.mom?.name || formData.dad?.name ||
          `Parent of ${formData.firstName} ${formData.lastName}`;
        const primaryEmail = invoiceEmails[0];
        const additionalEmails = invoiceEmails.slice(1);

        const { customerId, invoiceId, paymentLink: qbLink } = await createStudentInvoice({
          studentName:     `${formData.firstName} ${formData.lastName}`,
          parentName,
          primaryEmail,
          additionalEmails,
          amount:          duesAmount,
        });

        paymentLink = qbLink;

        await supabase
          .from("students")
          .update({
            qb_customer_id:  customerId,
            qb_invoice_id:   invoiceId,
            qb_payment_link: paymentLink,
          })
          .eq("id", student.id);

        console.log("[B&B Submit] QB invoice created:", invoiceId);
      } catch (qbError) {
        // Log but don't fail the submission — student is already saved
        console.error("[B&B Submit] QB invoice creation failed:", qbError);
      }
    }
    // ──────────────────────────────────────────────────────────────────────────

    return NextResponse.json({
      success: true,
      studentId: student.id,
      duesAmount,
      invoiceEmails,
      paymentLink,
    }, { headers: SECURE_HEADERS });
  } catch (error) {
    console.error("[B&B Submit] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred." },
      { status: 500, headers: SECURE_HEADERS }
    );
  }
}
