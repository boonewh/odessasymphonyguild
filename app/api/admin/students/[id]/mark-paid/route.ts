import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SECURE_HEADERS } from "@/lib/api-headers";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * POST /api/admin/students/[id]/mark-paid
 * Body: { paid: boolean }
 *
 * Toggles a student's paid status. Protected by the admin session cookie
 * verified in middleware.ts.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { paid } = await request.json();

  if (typeof paid !== "boolean") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: SECURE_HEADERS });
  }

  const supabase = getSupabase();

  const { error } = await supabase
    .from("students")
    .update({
      paid,
      paid_at: paid ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) {
    console.error("[Mark Paid] Supabase error:", error);
    return NextResponse.json({ error: "Failed to update student." }, { status: 500, headers: SECURE_HEADERS });
  }

  return NextResponse.json({ success: true, paid }, { headers: SECURE_HEADERS });
}
