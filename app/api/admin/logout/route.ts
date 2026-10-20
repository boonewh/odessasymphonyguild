import { NextResponse } from "next/server";
import { liveSiteEnabled } from "@/lib/gala/live-release";
import { DELETE as sharedLogout } from "../session/route";

export async function POST(request: Request) {
  if (liveSiteEnabled(process.env)) return sharedLogout(request);
  const response = NextResponse.json({ success: true });
  response.cookies.set("admin_session", "", { maxAge: 0, path: "/" });
  return response;
}
