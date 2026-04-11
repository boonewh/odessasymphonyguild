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

    // Verify reCAPTCHA token
    const recaptchaToken = body.recaptchaToken;
    if (!recaptchaToken) {
      return NextResponse.json({ error: "Please complete the reCAPTCHA." }, { status: 400, headers: SECURE_HEADERS });
    }
    const recaptchaRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`,
    });
    const recaptchaData = await recaptchaRes.json();
    if (!recaptchaData.success) {
      console.warn("[B&B Submit] reCAPTCHA failed:", recaptchaData["error-codes"]);
      return NextResponse.json({ error: "reCAPTCHA verification failed. Please try again." }, { status: 400, headers: SECURE_HEADERS });
    }

    const formData = parseResult.data;
    const duesAmount = calculateDues(formData.membershipType);

    // Collect guardian emails for invoice delivery
    const invoiceEmails: string[] = formData.guardians
      .map((g) => g.email?.trim())
      .filter((e): e is string => Boolean(e));

    // ── Save to Supabase ───────────────────────────────────────────────────────
    const supabase = getSupabase();

    // Build guardian columns dynamically (up to 4)
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
        ...guardianFields,
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
        // Use first available guardian name + primary email for the QB customer
        const parentName =
          formData.guardians.find((g) => g.name?.trim())?.name?.trim() ||
          `Guardian of ${formData.firstName} ${formData.lastName}`;
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
