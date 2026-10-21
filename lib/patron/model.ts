import { z } from "zod";

export const PATRON_PERIOD = "2026–2027";
const name = z.string().trim().min(2, "Please enter a name.").max(120)
  .refine(value => !/[\u0000-\u001f\u007f<>]/.test(value), "Please enter a name without markup.");
const email = z.string().trim().toLowerCase().pipe(z.union([z.email().max(254), z.literal("")]));
const phone = z.string().trim().max(40).refine(value => !value || /^[+\d() .-]{7,40}$/.test(value), "Please check the phone number.");
export const contactSchema = z.object({ name, email, phone });
export const signupSchema = contactSchema.extend({
  email: z.string().trim().toLowerCase().pipe(z.email("Please enter a valid email address.").max(254)),
  requestId: z.uuid(), consent: z.literal(true), company: z.string().max(200),
}).strict();
export const checkPatronSchema = contactSchema.extend({ requestId: z.uuid(), published: z.boolean() }).strict();
export const editPatronSchema = contactSchema.extend({ id: z.uuid(), published: z.boolean() }).strict();
export type PatronContact = z.infer<typeof contactSchema>;
export type Patron = PatronContact & {
  id: string; period: string; source: "online" | "check"; published: boolean; approved_at: string | null; created_at: string;
};
export type PatronSubmission = PatronContact & {
  requestId: string; period: string; source: Patron["source"]; published: boolean; clientHash: string;
};
export interface PatronStore {
  names(period: string): Promise<string[]>;
  list(period: string): Promise<Patron[]>;
  add(input: PatronSubmission): Promise<void>;
  edit(input: z.infer<typeof editPatronSchema>, period: string): Promise<boolean>;
}
