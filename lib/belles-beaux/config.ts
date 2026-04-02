import { MembershipType } from '@/types/student';

/**
 * Belles & Beaux Program Configuration
 *
 * Prices are stored here as defaults.
 * TODO: Pull these from Supabase `settings` table so the treasurer
 * can update them from the admin panel without a code change.
 */

export const BELLES_BEAUX_CONFIG = {
  schoolYear: '2026-2027',
  programName: "Belles & Beaux",
  lateFeeDeadline: '2026-06-30',
};

/**
 * Dues amounts per membership type.
 * TODO: Replace with live DB fetch from admin-managed settings table.
 */
export const DUES: Record<MembershipType, number> = {
  freshman:      300,  // New freshman — base rate
  returning:     300,  // Returning Soph / Junior / Senior — base rate
  new_sophomore: 400,  // First-time Sophomore (buy-in + base)
  new_junior:    575,  // First-time Junior (buy-in + base)
  new_senior:    895,  // First-time Senior (buy-in + base)
};

export const LATE_FEE = 100; // Added after lateFeeDeadline

export function calculateDues(membershipType: MembershipType): number {
  return DUES[membershipType];
}

// ── Form select options ────────────────────────────────────────────────────────

export const GRADE_OPTIONS = [
  { value: '9',  label: '9th Grade' },
  { value: '10', label: '10th Grade' },
  { value: '11', label: '11th Grade' },
  { value: '12', label: '12th Grade' },
];

export const GENDER_OPTIONS = [
  { value: 'Female',           label: 'Female' },
  { value: 'Male',             label: 'Male' },
  { value: 'Non-binary',       label: 'Non-binary' },
  { value: 'Prefer not to say', label: 'Prefer not to say' },
];

export const TSHIRT_SIZE_OPTIONS = [
  { value: 'YS',  label: 'Youth Small (YS)' },
  { value: 'YM',  label: 'Youth Medium (YM)' },
  { value: 'YL',  label: 'Youth Large (YL)' },
  { value: 'S',   label: 'Adult Small (S)' },
  { value: 'M',   label: 'Adult Medium (M)' },
  { value: 'L',   label: 'Adult Large (L)' },
  { value: 'XL',  label: 'Adult XL' },
  { value: 'XXL', label: 'Adult XXL' },
];

/**
 * Membership type options shown based on grade.
 * Grade 9 (freshman) has no choice — they're always $300.
 */
export function getMembershipOptions(grade: string) {
  if (grade === '9') return null; // Auto-set to 'freshman', no dropdown

  const gradeLabel: Record<string, string> = {
    '10': 'Sophomore',
    '11': 'Junior',
    '12': 'Senior',
  };

  // No grade selected yet — nothing to show
  if (!gradeLabel[grade]) return null;

  const newType = `new_${gradeLabel[grade].toLowerCase()}` as MembershipType;

  return [
    {
      value: 'returning',
      label: `Returning Member — $${DUES.returning.toLocaleString()}`,
    },
    {
      value: newType,
      label: `First-Time ${gradeLabel[grade]} (New Member) — $${DUES[newType].toLocaleString()}`,
    },
  ];
}
