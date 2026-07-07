import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { adminStudentSchema } from "@/lib/validation/student";
import { BELLES_BEAUX_CONFIG } from "@/lib/belles-beaux/config";
import { getLivePricing } from "@/lib/belles-beaux/pricing";
import { SECURE_HEADERS } from "@/lib/api-headers";
import { createStudentInvoice } from "@/lib/quickbooks/invoice-service";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * POST /api/admin/students/add
 * Body: adminStudentSchema fields + { createInvoice: boolean }
 *
 * Manually adds a student from the admin roster. Skips the public form's
 * duplicate check (this is the escape hatch for same-name students), media
 * release, and reCAPTCHA. When createInvoice is true, creates the QB
 * customer + invoice and emails the payment link to every guardian email.
 * Protected by the admin session cookie verified in middleware.ts.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const createInvoice = body.createInvoice === true;

    const parseResult = adminStudentSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid form data", details: parseResult.error.flatten() },
        { status: 400, headers: SECURE_HEADERS }
      );
    }

    const formData = parseResult.data;
    const { dues } = await getLivePricing();
    const duesAmount = dues[formData.membershipType];

    const invoiceEmails: string[] = formData.guardians
      .map((g) => g.email?.trim())
      .filter((e): e is string => Boolean(e));

    if (createInvoice && invoiceEmails.length === 0) {
      return NextResponse.json(
        { error: "A guardian email is required to send an invoice." },
        { status: 400, headers: SECURE_HEADERS }
      );
    }

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
      console.error("[Admin Add] Database error:", dbError);
      throw new Error("Failed to save the student. Please try again.");
    }

    console.log("[Admin Add] Saved student:", student.id, {
      name: `${formData.firstName} ${formData.lastName}`,
      createInvoice,
    });

    // ── QuickBooks Invoice ─────────────────────────────────────────────────────
    let paymentLink: string | null = null;
    let invoiceError: string | null = null;

    if (createInvoice) {
      if (process.env.ENABLE_QUICKBOOKS_SYNC === "true" || process.env.MOCK_PAYMENT_MODE === "true") {
        try {
          const parentName =
            formData.guardians.find((g) => g.name?.trim())?.name?.trim() ||
            `Guardian of ${formData.firstName} ${formData.lastName}`;

          // Pass every email as an "additional" recipient so QB emails the
          // payment link to all of them, including the primary — the admin
          // flow has no browser redirect, so the email IS the delivery.
          const { customerId, invoiceId, paymentLink: qbLink } = await createStudentInvoice({
            studentName:      `${formData.firstName} ${formData.lastName}`,
            parentName,
            primaryEmail:     invoiceEmails[0],
            additionalEmails: invoiceEmails,
            amount:           duesAmount,
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

          console.log("[Admin Add] QB invoice created:", invoiceId);
        } catch (qbError) {
          // Student is already saved — report the invoice failure to the admin
          console.error("[Admin Add] QB invoice creation failed:", qbError);
          invoiceError =
            "The student was added, but the QuickBooks invoice could not be created. Please create it in QuickBooks manually.";
        }
      } else {
        invoiceError =
          "The student was added, but QuickBooks sync is not enabled, so no invoice was created.";
      }
    }

    return NextResponse.json(
      {
        success: true,
        studentId: student.id,
        duesAmount,
        invoiceEmails,
        paymentLink,
        invoiceError,
      },
      { headers: SECURE_HEADERS }
    );
  } catch (error) {
    console.error("[Admin Add] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred." },
      { status: 500, headers: SECURE_HEADERS }
    );
  }
}
