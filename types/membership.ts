export interface MembershipTier {
  id: string;
  name: string;
  price: number;
  description: string;
  benefits: string[];
  popular?: boolean;
}

export interface MembershipFormData {
  // Tier Selection
  tierId: string;

  // Personal Information
  firstName: string;
  lastName: string;
  email: string;
  phone: string;

  // Address (optional)
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };

  // Preferences
  newsletterOptIn?: boolean;

  // Payment (will be handled by payment processor)
  // Payment details not stored in form data for PCI compliance
}

export interface MembershipSubmission extends MembershipFormData {
  id: string;
  submittedAt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  quickbooksCustomerId?: string;
  quickbooksInvoiceId?: string;
}

export type FormStep = 'tier' | 'info' | 'payment' | 'confirmation';
