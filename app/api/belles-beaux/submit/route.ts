import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { studentFormSchema } from "@/lib/validation/student";
import { BELLES_BEAUX_CONFIG } from "@/lib/belles-beaux/config";
import { getLivePricing } from "@/lib/belles-beaux/pricing";
import { SECURE_HEADERS } from "@/lib/api-headers";
import { createStudentInvoice } from "@/lib/quickbooks/invoice-service";

// Server-side Supabase client (bypasses RLS for trusted server operations)
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

// Strip formatting so "(432) 555-1234" and "432-555-1234" compare equal
function phoneDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "").slice(-10);
}

function normEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
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
    // Set by the form when the parent confirms "yes, this is a different
    // student" after the shared-contact warning below
    const confirmedDifferentStudent = body.confirmedDifferentStudent === true;

    const supabase = getSupabase();

    // ── Duplicate checks ───────────────────────────────────────────────────────
    // Run BEFORE reCAPTCHA verification: siteverify consumes the token, and a
    // blocked/warned submission must leave it valid for the confirm-resubmit.
    //
    // Hard check: same student name this school year → always blocked.
    // Soft check: same guardian contact info but a different student name →
    // warn and let the parent confirm (twins/siblings are legitimate).
    const { data: yearRows, error: dupError } = await supabase
      .from("students")
      .select(
        "id, first_name, last_name, paid, qb_payment_link, cell_number, guardian_1_email, guardian_2_email, guardian_3_email, guardian_4_email, guardian_1_cell, guardian_2_cell, guardian_3_cell, guardian_4_cell"
      )
      .eq("school_year", BELLES_BEAUX_CONFIG.schoolYear);

    if (dupError || !yearRows) {
      console.error("[B&B Submit] Duplicate check error:", dupError);
      throw new Error("Failed to save your application. Please try again.");
    }

    const normName = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
    const newEmails = new Set(
      formData.guardians.map((g) => normEmail(g.email)).filter(Boolean)
    );
    const newPhones = new Set(
      [phoneDigits(formData.cellNumber), ...formData.guardians.map((g) => phoneDigits(g.cellNumber))]
        .filter(Boolean)
    );
    const contactsOverlap = (row: (typeof yearRows)[number]) => {
      const emails = [row.guardian_1_email, row.guardian_2_email, row.guardian_3_email, row.guardian_4_email]
        .map(normEmail).filter(Boolean);
      const phones = [row.cell_number, row.guardian_1_cell, row.guardian_2_cell, row.guardian_3_cell, row.guardian_4_cell]
        .map(phoneDigits).filter(Boolean);
      return emails.some((e) => newEmails.has(e)) || phones.some((p) => newPhones.has(p));
    };

    const studentName = `${formData.firstName} ${formData.lastName}`;
    const sameNameRows = yearRows.filter(
      (r) =>
        normName(r.first_name) === normName(formData.firstName) &&
        normName(r.last_name) === normName(formData.lastName)
    );

    if (sameNameRows.length > 0) {
      const contactMatch = sameNameRows.find(contactsOverlap);
      console.warn("[B&B Submit] Duplicate submission blocked:", studentName, {
        contactMatch: Boolean(contactMatch),
      });

      if (contactMatch?.paid) {
        return NextResponse.json(
          {
            duplicate: true,
            error: `${studentName} is already registered for the ${BELLES_BEAUX_CONFIG.schoolYear} season and dues have been paid. No further action is needed.`,
          },
          { status: 409, headers: SECURE_HEADERS }
        );
      }

      if (contactMatch) {
        return NextResponse.json(
          {
            duplicate: true,
            error: `${studentName} is already registered for the ${BELLES_BEAUX_CONFIG.schoolYear} season. An invoice was created with your original application — please pay that invoice instead of registering again.`,
            paymentLink: contactMatch.qb_payment_link ?? null,
          },
          { status: 409, headers: SECURE_HEADERS }
        );
      }

      return NextResponse.json(
        {
          duplicate: true,
          error: `A student named ${studentName} is already registered for the ${BELLES_BEAUX_CONFIG.schoolYear} season. If you previously submitted this application, please use the invoice emailed to you. If this is a different student with the same name, please contact the Odessa Symphony Guild for assistance.`,
        },
        { status: 409, headers: SECURE_HEADERS }
      );
    }

    // Soft check — same contact info, different student name (possible typo or
    // nickname re-registration; also matches siblings, hence confirmable)
    if (!confirmedDifferentStudent) {
      const contactMatches = yearRows.filter(contactsOverlap);
      if (contactMatches.length > 0) {
        const names = [...new Set(contactMatches.map((r) => `${r.first_name} ${r.last_name}`))];
        const nameList = names.join(" and ");
        const unpaidMatch = contactMatches.find((r) => !r.paid && r.qb_payment_link);
        console.warn("[B&B Submit] Soft duplicate warning:", studentName, { existing: names });

        return NextResponse.json(
          {
            softDuplicate: true,
            existingStudents: names,
            paymentLink: unpaidMatch?.qb_payment_link ?? null,
            error: `Your contact information is already registered for ${nameList} this season. If ${studentName} is a different student (such as a sibling or twin), you can continue below. If you meant to pay dues for ${nameList}, please use the existing invoice instead of registering again.`,
          },
          { status: 409, headers: SECURE_HEADERS }
        );
      }
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

    const { dues } = await getLivePricing();
    const duesAmount = dues[formData.membershipType];

    // Collect guardian emails for invoice delivery
    const invoiceEmails: string[] = formData.guardians
      .map((g) => g.email?.trim())
      .filter((e): e is string => Boolean(e));

    // ── Save to Supabase ───────────────────────────────────────────────────────

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
        school_year:              BELLES_BEAUX_CONFIG.schoolYear,
        first_name:               formData.firstName,
        middle_name:              formData.middleName || null,
        last_name:                formData.lastName,
        nickname:                 formData.nickname || null,
        cell_number:              formData.cellNumber,
        school:                   formData.school,
        grade:                    formData.grade,
        gender:                   formData.gender,
        tshirt_size:              formData.tshirtSize,
        membership_type:          formData.membershipType,
        dues_amount:              duesAmount,
        media_release_consent:    formData.mediaReleaseConsent,
        social_media_opt_out:     formData.socialMediaOptOut,
        media_release_signature:  formData.mediaReleaseSignature,
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
