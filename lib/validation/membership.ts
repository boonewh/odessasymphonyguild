import { z } from 'zod';

/**
 * Validation schemas for membership forms using Zod
 */

// Phone number validation (US format)
const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;

export const membershipFormSchema = z.object({
  // Tier Selection
  tierId: z.string().min(1, 'Please select a membership tier'),

  // Personal Information
  firstName: z.string().min(2, 'First name must be at least 2 characters').max(50, 'First name is too long'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').max(50, 'Last name is too long'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().regex(phoneRegex, 'Please enter a valid phone number'),

  // Address (optional)
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().length(2, 'State must be 2 letters (e.g., TX)').optional(),
    zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code').optional()
  }).optional(),

  // Preferences
  newsletterOptIn: z.boolean().default(false)
});

export type MembershipFormSchema = z.infer<typeof membershipFormSchema>;

/**
 * Helper function to format phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
}

/**
 * Helper function to validate just email (for async validation)
 */
export const emailSchema = z.string().email();

/**
 * Helper to parse form data with validation
 */
export function validateMembershipForm(data: unknown) {
  return membershipFormSchema.safeParse(data);
}
