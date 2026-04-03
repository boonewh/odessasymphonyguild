import { createClient } from "@supabase/supabase-js";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * AES-256-GCM encryption for QB token storage.
 * Meets Intuit's requirement to encrypt refresh tokens and realm ID at rest.
 */

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const keyHex = process.env.QB_TOKEN_ENCRYPTION_KEY;
  if (!keyHex) throw new Error("QB_TOKEN_ENCRYPTION_KEY is not set");
  return Buffer.from(keyHex, "hex");
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Store as iv:authTag:ciphertext (all hex)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(stored: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encryptedHex] = stored.split(":");

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
}

// ── Token storage ─────────────────────────────────────────────────────────────

function getServiceSupabase() {
  // Use service role key for token storage — never exposed to client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;
  return createClient(url, key);
}

export interface QBTokenSet {
  realmId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
}

export async function saveTokens(tokens: QBTokenSet): Promise<void> {
  const supabase = getServiceSupabase();

  const { error } = await supabase.from("qb_tokens").upsert(
    {
      realm_id:           encrypt(tokens.realmId),
      access_token:       encrypt(tokens.accessToken),
      refresh_token:      encrypt(tokens.refreshToken),
      expires_at:         tokens.expiresAt.toISOString(),
      refresh_expires_at: tokens.refreshExpiresAt.toISOString(),
      updated_at:         new Date().toISOString(),
    },
    { onConflict: "realm_id" }
  );

  if (error) throw new Error(`Failed to save QB tokens: ${error.message}`);
}

export async function loadTokens(): Promise<QBTokenSet | null> {
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from("qb_tokens")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  return {
    realmId:          decrypt(data.realm_id),
    accessToken:      decrypt(data.access_token),
    refreshToken:     decrypt(data.refresh_token),
    expiresAt:        new Date(data.expires_at),
    refreshExpiresAt: new Date(data.refresh_expires_at),
  };
}
