import { MembershipTier } from '@/types/membership';

/**
 * Membership Tier Configuration
 *
 * This file contains all membership tier definitions.
 * To update pricing or benefits, simply modify the values below.
 *
 * Note: These are placeholder values for demonstration.
 * Update with actual OSG membership tiers when available.
 */

export const MEMBERSHIP_TIERS: MembershipTier[] = [
  {
    id: 'individual',
    name: 'Individual Member',
    price: 75,
    description: 'Perfect for music lovers who want to support the Guild and enjoy member benefits.',
    benefits: [
      'Guild membership card',
      'Quarterly newsletter subscription',
      'Invitations to exclusive member events',
      'Recognition in annual program',
      'Volunteer opportunities',
      'Member-only pre-sale access to select events'
    ]
  },
  {
    id: 'family',
    name: 'Family Membership',
    price: 150,
    description: 'Ideal for families who want to share their love of music and support together.',
    benefits: [
      'All Individual Member benefits',
      'Membership for up to 4 family members',
      'Family name recognition in annual program',
      'Priority registration for Belles & Beaux program',
      'Complimentary tickets to select rehearsals',
      'Exclusive family event invitations'
    ],
    popular: true // Mark as most popular
  },
  {
    id: 'patron',
    name: 'Patron',
    price: 300,
    description: 'For dedicated supporters who want to make a significant impact on the arts.',
    benefits: [
      'All Family Membership benefits',
      'Special recognition in all programs',
      'Invitations to patron appreciation events',
      'Behind-the-scenes access to rehearsals',
      'Meet-and-greet opportunities with musicians',
      'Commemorative Guild patron pin',
      'Complimentary tickets to Symphony SoundBites events'
    ]
  },
  {
    id: 'benefactor',
    name: 'Benefactor',
    price: 500,
    description: 'Our highest tier for those passionate about ensuring the future of music in West Texas.',
    benefits: [
      'All Patron benefits',
      'Prominent recognition as a Guild Benefactor',
      'VIP seating at select Guild events',
      'Private concert experience opportunity',
      'Personal thank you from Guild leadership',
      'Legacy recognition opportunities',
      'Invitation to exclusive benefactor dinner',
      'Complimentary pair of season tickets to select performances'
    ]
  }
];

/**
 * Get a specific membership tier by ID
 */
export function getMembershipTier(tierId: string): MembershipTier | undefined {
  return MEMBERSHIP_TIERS.find(tier => tier.id === tierId);
}

/**
 * Get the default/recommended membership tier
 */
export function getDefaultTier(): MembershipTier {
  return MEMBERSHIP_TIERS.find(tier => tier.popular) || MEMBERSHIP_TIERS[0];
}

/**
 * Configuration for membership year
 * Update these dates annually
 */
export const MEMBERSHIP_YEAR = {
  current: '2025-2026',
  startDate: '2025-07-01',
  endDate: '2026-06-30',
  renewalDeadline: '2025-06-30'
};

/**
 * Feature flags for payment integration
 */
export const FEATURE_FLAGS = {
  enableQuickBooksSync: process.env.ENABLE_QUICKBOOKS_SYNC === 'true',
  mockPaymentMode: process.env.MOCK_PAYMENT_MODE !== 'false', // Default to true
  enableEmailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true'
};
