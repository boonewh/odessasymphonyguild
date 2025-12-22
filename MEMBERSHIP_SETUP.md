
# Membership Payment System - Setup Guide

This guide explains how to set up and activate the QuickBooks Online membership payment integration for the Odessa Symphony Guild website.

## Table of Contents

- [Overview](#overview)
- [Current Status](#current-status)
- [QuickBooks Setup](#quickbooks-setup)
- [Environment Configuration](#environment-configuration)
- [Testing](#testing)
- [Activation](#activation)
- [Customization](#customization)
- [Troubleshooting](#troubleshooting)

---

## Overview

The membership payment system is a production-ready integration with QuickBooks Online that allows members to sign up and pay for membership through the website. The system includes:

- **Multi-step membership form** with tier selection, member information, and payment
- **QuickBooks Online integration** for customer and invoice management
- **Mock mode** for demonstration and testing without real QB connection
- **Secure payment processing** (ready for payment processor integration)
- **Automated email notifications** (infrastructure ready)

---

## Current Status

### ✅ What's Working (Demo Mode)

- Beautiful membership landing page at `/membership`
- Full multi-step join form at `/membership/join`
- Form validation and error handling
- Mock payment flow with confirmation
- Professional UI matching existing site design

### 🔧 What Needs Setup (Production Mode)

- QuickBooks Online credentials
- QuickBooks OAuth authentication
- Payment processor integration
- Email notification service
- Real membership tier pricing

---

## QuickBooks Setup

### Prerequisites

1. **QuickBooks Online Account**
   - The organization must have an active QuickBooks Online subscription
   - You'll need admin access to the QuickBooks account

2. **QuickBooks Developer Account**
   - Create a developer account at https://developer.intuit.com
   - This is free and separate from the main QB account

### Step 1: Create QuickBooks App

1. Go to https://developer.intuit.com/app/developer/myapps
2. Click "Create an app"
3. Select "QuickBooks Online and Payments"
4. Fill in app details:
   - **App Name**: "Odessa Symphony Guild Membership"
   - **Description**: "Membership payment integration for OSG website"

### Step 2: Get API Credentials

1. In your app settings, find the **Keys & credentials** section
2. Copy the following (you'll need these for environment variables):
   - **Client ID**
   - **Client Secret**
   - **Redirect URI** (set to: `https://yourdomain.com/api/quickbooks/callback`)

3. For testing, use **Sandbox** keys first
4. For production, switch to **Production** keys after testing

### Step 3: Set Redirect URI

In the QuickBooks app settings, add these redirect URIs:
- Development: `http://localhost:3000/api/quickbooks/callback`
- Production: `https://odessasymphonyguild.org/api/quickbooks/callback`

### Step 4: Get Realm ID

The Realm ID (Company ID) is obtained during the OAuth flow:
1. After setting up environment variables (see below)
2. Visit `/api/quickbooks/auth` to start OAuth
3. Authorize the app with your QuickBooks account
4. The Realm ID will be shown in the callback - save it!

---

## Environment Configuration

### Step 1: Copy Environment Template

```bash
cp .env.example .env.local
```

### Step 2: Fill in QuickBooks Credentials

Edit `.env.local`:

```env
# QuickBooks Credentials
QUICKBOOKS_CLIENT_ID=your_client_id_here
QUICKBOOKS_CLIENT_SECRET=your_client_secret_here
QUICKBOOKS_REALM_ID=your_company_id_here
QUICKBOOKS_REDIRECT_URI=http://localhost:3000/api/quickbooks/callback
QUICKBOOKS_ENVIRONMENT=sandbox  # Change to 'production' when going live

# Feature Flags
ENABLE_QUICKBOOKS_SYNC=false    # Set to 'true' to enable QB integration
MOCK_PAYMENT_MODE=true          # Set to 'false' for real payment processing
ENABLE_EMAIL_NOTIFICATIONS=false # Set to 'true' to enable email confirmations
```

### Step 3: QuickBooks Items Setup

In your QuickBooks account, create a service/product item for membership dues:

1. Go to **Settings** > **Products and Services**
2. Click **New** > **Service**
3. Create item:
   - **Name**: "Membership Dues"
   - **Category**: "Income" or "Donations"
   - **Income Account**: Select appropriate account
   - **Price**: Leave blank (will be set by tier)
4. Note the Item ID (you may need to update `lib/quickbooks/invoices.ts` if not default)

---

## Testing

### Test in Sandbox Mode

1. Ensure environment is set to sandbox:
   ```env
   QUICKBOOKS_ENVIRONMENT=sandbox
   ENABLE_QUICKBOOKS_SYNC=false
   MOCK_PAYMENT_MODE=true
   ```

2. Visit `http://localhost:3000/membership` in your browser

3. Test the complete flow:
   - Select a membership tier
   - Fill in member information
   - Proceed through payment (mock)
   - Verify confirmation page

4. Check browser console for mock QuickBooks logs

### Test QuickBooks Connection

Once you have QB credentials:

1. Set environment variables:
   ```env
   QUICKBOOKS_CLIENT_ID=your_sandbox_client_id
   QUICKBOOKS_CLIENT_SECRET=your_sandbox_client_secret
   QUICKBOOKS_ENVIRONMENT=sandbox
   ```

2. Start the dev server:
   ```bash
   npm run dev
   ```

3. Visit: `http://localhost:3000/api/quickbooks/auth`
   - This will redirect to QuickBooks login
   - Authorize the app
   - You'll be redirected back with tokens

4. Test connection: `http://localhost:3000/api/quickbooks/test`
   - Should return company info if successful

---

## Activation

### Going Live - Checklist

#### 1. Update Membership Tiers

Edit `lib/membership/config.ts` with real pricing:

```typescript
export const MEMBERSHIP_TIERS: MembershipTier[] = [
  {
    id: "individual",
    name: "Individual",
    price: 75,  // Update with real price
    description: "...",
    benefits: ["..."],
  },
  // ... update all tiers
];
```

#### 2. Switch to Production QuickBooks

In `.env.local`:

```env
QUICKBOOKS_CLIENT_ID=your_production_client_id
QUICKBOOKS_CLIENT_SECRET=your_production_client_secret
QUICKBOOKS_ENVIRONMENT=production
QUICKBOOKS_REDIRECT_URI=https://odessasymphonyguild.org/api/quickbooks/callback
```

#### 3. Run OAuth Flow for Production

Visit: `https://odessasymphonyguild.org/api/quickbooks/auth`
- Authorize with production QuickBooks account
- Save the Realm ID to environment variables

#### 4. Enable QuickBooks Sync

```env
ENABLE_QUICKBOOKS_SYNC=true
```

#### 5. Set Up Payment Processor

Choose and integrate a payment processor:
- **QuickBooks Payments** (recommended for QB integration)
- **Stripe** (popular alternative)

Update `MOCK_PAYMENT_MODE` when ready:
```env
MOCK_PAYMENT_MODE=false
```

#### 6. Enable Email Notifications

Set up email service (Resend, SendGrid, or AWS SES) and update:
```env
ENABLE_EMAIL_NOTIFICATIONS=true
# Add email service credentials
```

#### 7. Deploy to Production

```bash
npm run build
# Deploy to your hosting provider
```

---

## Customization

### Update Membership Tiers

Edit `lib/membership/config.ts`:
- Change tier names, prices, descriptions
- Add or remove benefit items
- Mark popular tier

### Update Membership Year

Change the fiscal year in `lib/membership/config.ts`:

```typescript
export const MEMBERSHIP_YEAR = {
  current: '2025-2026',
  startDate: '2025-07-01',
  endDate: '2026-06-30',
  renewalDeadline: '2025-06-30'
};
```

### Customize Form Fields

Edit `types/membership.ts` and `lib/validation/membership.ts` to:
- Add custom fields
- Change validation rules
- Modify required/optional fields

### Update Email Templates

When implementing email notifications, templates will be in:
`lib/email/templates/membership-confirmation.ts`

---

## Troubleshooting

### OAuth Issues

**Problem**: "Invalid redirect URI"
- **Solution**: Ensure redirect URI in QuickBooks app settings matches `.env.local`

**Problem**: "Invalid client credentials"
- **Solution**: Double-check Client ID and Client Secret are correct

### API Errors

**Problem**: "Token expired"
- **Solution**: Token refresh is automatic, but check logs for refresh errors

**Problem**: "Invalid Realm ID"
- **Solution**: Re-run OAuth flow and save new Realm ID

### Form Issues

**Problem**: Validation errors on submit
- **Solution**: Check browser console for specific Zod validation errors

**Problem**: Form data not submitting
- **Solution**: Check `/api/membership/submit` endpoint in Network tab

### QuickBooks Sync Issues

**Problem**: Customer not created in QB
- **Solution**:
  1. Check `ENABLE_QUICKBOOKS_SYNC=true`
  2. Verify QB connection with `/api/quickbooks/test`
  3. Check server logs for API errors

**Problem**: Invoice not appearing in QB
- **Solution**: Verify "Membership Dues" item exists in QuickBooks

---

## Support

For technical issues:
1. Check server logs: `npm run dev` output
2. Check browser console for client-side errors
3. Test QB connection: `/api/quickbooks/test`
4. Review this documentation

For QuickBooks API documentation:
- https://developer.intuit.com/app/developer/qbo/docs/api/accounting

---

## Security Notes

- Never commit `.env.local` to version control
- Keep Client Secret secure
- Use HTTPS in production for OAuth callbacks
- Regularly refresh QuickBooks access tokens (handled automatically)
- Follow PCI compliance for payment data (never store card details)

---

## Next Steps After Setup

1. ✅ Test complete flow in sandbox
2. ✅ Verify QuickBooks customer and invoice creation
3. ✅ Update membership tiers with real data
4. ✅ Set up payment processor
5. ✅ Configure email notifications
6. ✅ Deploy to production
7. ✅ Run OAuth flow for production QB account
8. ✅ Test with real membership signup
9. ✅ Monitor first few transactions
10. ✅ Announce new membership portal to members!
