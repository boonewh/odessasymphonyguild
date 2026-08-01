import { z } from "zod";

const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/;

export const interestFormSchema = z.object({
  studentName: z.string().trim().min(2, "Student name is required").max(120),
  parentName: z.string().trim().min(2, "Parent or guardian name is required").max(120),
  school: z.string().trim().min(2, "School is required").max(120),
  parentEmail: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
  parentPhone: z.string().regex(phoneRegex, "Enter a valid phone number"),
  website: z.string().max(0).optional().or(z.literal("")),
});

export type InterestFormData = z.infer<typeof interestFormSchema>;
