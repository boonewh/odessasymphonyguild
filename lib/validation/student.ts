import { z } from 'zod';

const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/;

const parentSchema = z.object({
  name: z.string().max(100).optional().or(z.literal('')),
  mailingAddress: z.string().max(200).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  state: z.string().max(2).optional().or(z.literal('')),
  zipCode: z.string().max(10).optional().or(z.literal('')),
  cellNumber: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === '' || phoneRegex.test(val),
      { message: 'Please enter a valid phone number (xxx) xxx-xxxx' }
    ),
  email: z.string().email('Please enter a valid email address').optional().or(z.literal('')),
  formalName: z.string().max(200).optional().or(z.literal('')),
});

export const studentFormSchema = z
  .object({
    // Student
    firstName: z.string().min(2, 'First name is required').max(50),
    middleName: z.string().max(50).optional().or(z.literal('')),
    lastName: z.string().min(2, 'Last name is required').max(50),
    nickname: z.string().max(50).optional().or(z.literal('')),
    cellNumber: z
      .string()
      .regex(phoneRegex, 'Please enter a valid phone number (xxx) xxx-xxxx'),
    school: z.string().min(2, 'School is required').max(100),
    grade: z.enum(['9', '10', '11', '12'], { message: 'Please select a grade' }),
    gender: z.string().min(1, 'Please select a gender'),
    tshirtSize: z.string().min(1, 'Please select a t-shirt size'),

    // Parents
    mom: parentSchema.optional(),
    dad: parentSchema.optional(),

    // Membership type drives invoice amount
    membershipType: z.enum(
      ['freshman', 'returning', 'new_sophomore', 'new_junior', 'new_senior'],
      { message: 'Please select a membership type' }
    ),
  })
  .superRefine((data, ctx) => {
    const momEmail = data.mom?.email?.trim();
    const dadEmail = data.dad?.email?.trim();

    if (!momEmail && !dadEmail) {
      // Flag both email fields so the user sees the error wherever they are
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one parent email is required for invoice delivery.',
        path: ['mom', 'email'],
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one parent email is required for invoice delivery.',
        path: ['dad', 'email'],
      });
    }
  });

export type StudentFormSchema = z.infer<typeof studentFormSchema>;

export function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
