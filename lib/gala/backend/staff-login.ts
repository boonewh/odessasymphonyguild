import { createHmac } from "node:crypto";
import { z } from "zod";

const credentials = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(1).max(256),
}).strict();
export type LoginAdmission = { allowed: boolean; retryAfter: number };
export function loginBucket(email: string, key: string) {
  return createHmac("sha256", key).update(`gala-staff-login:${email.trim().toLowerCase()}`).digest("hex");
}
export class LoginBodyTooLarge extends Error {}
export async function readLoginBody(request: Request) {
  // Check actual streamed bytes, not just an optional/untrusted Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing credentials.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) { await reader.cancel(); throw new LoginBodyTooLarge(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
export async function authenticateStaff(
  raw: unknown, key: string,
  consume: (bucket: string) => Promise<LoginAdmission>,
  authenticate: (email: string, password: string) => Promise<string>,
): Promise<{ status: 200; userId: string } | { status: 401 } | { status: 429 | 503; retryAfter: number }> {
  const parsed = credentials.safeParse(raw);
  if (!parsed.success) return { status: 401 };
  let admission: LoginAdmission;
  try { admission = await consume(loginBucket(parsed.data.email, key)); }
  catch { return { status: 503, retryAfter: 60 }; }
  if (!admission.allowed) return { status: 429, retryAfter: admission.retryAfter };
  try { return { status: 200, userId: await authenticate(parsed.data.email, parsed.data.password) }; }
  catch { return { status: 401 }; }
}
