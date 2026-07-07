import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SECURE_HEADERS } from "@/lib/api-headers";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
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
