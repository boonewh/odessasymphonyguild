import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { BELLES_BEAUX_CONFIG } from "@/lib/belles-beaux/config";
import { SECURE_HEADERS } from "@/lib/api-headers";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * GET /api/admin/students
 *
 * Returns the full roster for the current school year. The students table
 * has no anon RLS policies, so this server route (service role key) is the
 * only read path. Protected by the admin session cookie in middleware.ts.
 */
export async function GET() {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("school_year", BELLES_BEAUX_CONFIG.schoolYear)
    .order("last_name", { ascending: true });

  if (error) {
    console.error("[Admin Students] Supabase error:", error);
    return NextResponse.json({ error: "Failed to load students." }, { status: 500, headers: SECURE_HEADERS });
  }

  return NextResponse.json({ students: data }, { headers: SECURE_HEADERS });
}
