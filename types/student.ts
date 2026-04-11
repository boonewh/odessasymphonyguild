export type GuardianRelationship =
  | 'Mother'
  | 'Father'
  | 'Grandmother'
  | 'Grandfather'
  | 'Guardian'
  | 'Other';

export interface GuardianInfo {
  relationship: GuardianRelationship;
  name?: string;
  mailingAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  cellNumber?: string;
  email?: string;
  formalName?: string;
}

export type MembershipType =
  | 'freshman'      // Grade 9 — always $300
  | 'returning'     // Soph/Junior/Senior returning — $300
  | 'new_sophomore' // First-time Sophomore — $400
  | 'new_junior'    // First-time Junior — $575
  | 'new_senior';   // First-time Senior — $895

export interface StudentFormData {
  // Student Information
  firstName: string;
  middleName?: string;
  lastName: string;
  nickname?: string;
  cellNumber: string;
  school: string;
  grade: '9' | '10' | '11' | '12';
  gender: string;
  tshirtSize: string;

  // Guardians — 1 to 4, at least one email required
  guardians: GuardianInfo[];

  // Membership
  membershipType: MembershipType;
}

export interface StudentRecord extends StudentFormData {
  id: string;
  schoolYear: string;
  submittedAt: string;
  duesAmount: number;
  paid: boolean;
  paidAt?: string;
  qbCustomerId?: string;
  qbInvoiceId?: string;
  qbPaymentLink?: string;
}
