import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SECURE_HEADERS } from "@/lib/api-headers";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET /api/admin/settings
 * Returns all settings as a key/value object.
 */
export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("settings").select("key, value");

  if (error) {
    return NextResponse.json({ error: "Failed to load settings." }, { status: 500, headers: SECURE_HEADERS });
  }

  const settings = Object.fromEntries(data.map((r) => [r.key, r.value]));
  return NextResponse.json(settings, { headers: SECURE_HEADERS });
}

/**
 * POST /api/admin/settings
 * Body: { key: string, value: string }
 * Upserts a single setting.
 */
export async function POST(request: NextRequest) {
  const { key, value } = await request.json();

  const allowedKeys = [
    "dues_freshman",
    "dues_returning",
    "dues_new_sophomore",
    "dues_new_junior",
    "dues_new_senior",
    "late_fee",
  ];

  if (!allowedKeys.includes(key)) {
    return NextResponse.json({ error: "Invalid setting key." }, { status: 400, headers: SECURE_HEADERS });
  }

  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 0) {
    return NextResponse.json({ error: "Value must be a positive number." }, { status: 400, headers: SECURE_HEADERS });
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("settings")
    .upsert({ key, value: String(parsed), updated_at: new Date().toISOString() });

  if (error) {
    return NextResponse.json({ error: "Failed to save setting." }, { status: 500, headers: SECURE_HEADERS });
  }

  return NextResponse.json({ success: true }, { headers: SECURE_HEADERS });
}
