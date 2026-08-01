import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { BELLES_BEAUX_CONFIG } from "@/lib/belles-beaux/config";
import { SECURE_HEADERS } from "@/lib/api-headers";
import { interestFormSchema } from "@/lib/validation/interest";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Quietly accept bot-filled honeypot submissions without storing them.
    if (body && typeof body === "object" && typeof body.website === "string" && body.website.length > 0) {
      return NextResponse.json({ success: true }, { headers: SECURE_HEADERS });
    }

    const parsed = interestFormSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please check the form and try again.", details: parsed.error.flatten() },
        { status: 400, headers: SECURE_HEADERS }
      );
    }

    const { studentName, parentName, school, parentEmail, parentPhone } = parsed.data;
    const { error } = await getSupabase().from("belles_beaux_interests").insert({
      interest_year: BELLES_BEAUX_CONFIG.nextSchoolYear,
      student_name: studentName,
      parent_name: parentName,
      school,
      parent_email: parentEmail,
      parent_phone: parentPhone,
    });

    if (error?.code === "23505") {
      return NextResponse.json({ success: true, alreadySubmitted: true }, { headers: SECURE_HEADERS });
    }
    if (error) {
      console.error("[B&B Interest] Supabase error:", error);
      return NextResponse.json(
        { error: "We could not save your information. Please try again." },
        { status: 500, headers: SECURE_HEADERS }
      );
    }

    return NextResponse.json({ success: true }, { status: 201, headers: SECURE_HEADERS });
  } catch (error) {
    console.error("[B&B Interest] Unexpected error:", error);
    return NextResponse.json(
      { error: "We could not save your information. Please try again." },
      { status: 500, headers: SECURE_HEADERS }
    );
  }
}
