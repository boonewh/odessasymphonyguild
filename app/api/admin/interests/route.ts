import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { BELLES_BEAUX_CONFIG } from "@/lib/belles-beaux/config";
import { SECURE_HEADERS } from "@/lib/api-headers";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const { data, error } = await getSupabase()
    .from("belles_beaux_interests")
    .select("id, submitted_at, interest_year, student_name, parent_name, school, parent_email, parent_phone")
    .eq("interest_year", BELLES_BEAUX_CONFIG.nextSchoolYear)
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("[Admin Interests] Supabase error:", error);
    return NextResponse.json(
      { error: "Failed to load the interest list." },
      { status: 500, headers: SECURE_HEADERS }
    );
  }

  return NextResponse.json({ interests: data }, { headers: SECURE_HEADERS });
}
