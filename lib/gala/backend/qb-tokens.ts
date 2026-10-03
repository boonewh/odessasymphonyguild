import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";

const tokenSchema = z.object({ realmId: z.string().regex(/^\d+$/), accessToken: z.string().min(1), refreshToken: z.string().min(1),
  expiresAt: z.number().finite(), refreshExpiresAt: z.number().finite() });
export type SandboxTokens = z.infer<typeof tokenSchema>;
export function sealTokens(tokens: SandboxTokens, key: string) {
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("Encryption key required.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  cipher.setAAD(Buffer.from("osg-gala-qb-sandbox-v1"));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(tokenSchema.parse(tokens)), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(b => b.toString("hex")).join(":");
}
export function openTokens(sealed: string, key: string, realmId: string): SandboxTokens {
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("Encryption key required.");
  const [iv, tag, ciphertext] = sealed.split(":").map(v => Buffer.from(v, "hex"));
  const cipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  cipher.setAAD(Buffer.from("osg-gala-qb-sandbox-v1")); cipher.setAuthTag(tag);
  const tokens = tokenSchema.parse(JSON.parse(Buffer.concat([cipher.update(ciphertext), cipher.final()]).toString("utf8")));
  if (tokens.realmId !== realmId) throw new Error("Sandbox company mismatch.");
  return tokens;
}
