# Odessa Symphony Guild Website

A modern Next.js website for the Odessa Symphony Guild, supporting the West Texas Symphony since 1958.

## Features

- **Modern Design**: Built with Next.js 16, React 19, and Tailwind CSS 3
- **Responsive**: Mobile-first design that works on all devices
- **Performance**: Optimized images with Next.js Image component
- **Accessibility**: Semantic HTML and ARIA labels
- **SEO Optimized**: Meta tags and semantic structure
- **Membership Payment System**: QuickBooks Online integration for membership dues (see [MEMBERSHIP_SETUP.md](MEMBERSHIP_SETUP.md))

## Key Elements

- **Hero Section**: Features the beautiful Tangerine script font for "Odessa Symphony Guild"
- **Our Mission Box**: Prominent display of the organization's mission statement
- **Belles & Beaux Section**: Enhanced design with offset images showcasing the youth program
- **How We Serve**: Clean, modern cards without the small icons from the old design
- **65+ Years**: Heritage prominently featured throughout the site

## Getting Started

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Build

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

## Technologies Used

- **Next.js 16.0.7** - React framework with App Router
- **React 19.2.1** - Latest React version
- **TypeScript 5.9.3** - Type safety
- **Tailwind CSS 3.4.17** - Utility-first CSS framework
- **Google Fonts** - Tangerine (script) and Inter (body text)
- **React Hook Form 7.49.3** - Form state management
- **Zod 3.22.4** - Schema validation
- **Intuit OAuth 4.0.1** - QuickBooks Online integration

## Project Structure

```
odessasymphonyguild/
├── app/
│   ├── api/
│   │   └── membership/
│   │       └── submit/          # Membership submission API
│   ├── membership/
│   │   ├── page.tsx             # Membership landing page
│   │   └── join/
│   │       └── page.tsx         # Multi-step join form
│   ├── gala/
│   │   └── page.tsx             # Gala page
│   ├── globals.css              # Global styles with Tailwind
│   ├── layout.tsx               # Root layout with fonts
│   └── page.tsx                 # Main homepage
├── components/
│   ├── Header.tsx               # Navigation header
│   ├── Footer.tsx               # Site footer
│   ├── FormStepIndicator.tsx   # Multi-step form progress
│   ├── MembershipTierSelector.tsx
│   └── PaymentFormPlaceholder.tsx
├── lib/
│   ├── membership/
│   │   └── config.ts            # Membership tier configuration
│   ├── validation/
│   │   └── membership.ts        # Form validation schemas
│   └── quickbooks/
│       ├── client.ts            # QB API client
│       ├── customers.ts         # Customer operations
│       ├── invoices.ts          # Invoice operations
│       └── mock.ts              # Mock QB responses
├── types/
│   ├── membership.ts            # Membership TypeScript types
│   └── quickbooks.ts            # QuickBooks TypeScript types
├── public/
│   └── images/                  # Image assets
├── .env.example                 # Environment variables template
├── MEMBERSHIP_SETUP.md          # Membership system setup guide
├── next.config.ts               # Next.js configuration
├── tailwind.config.ts           # Tailwind configuration
└── package.json                 # Dependencies
```

## Images

All images are stored in `public/images/`:
- `osg-logo.png` - Organization logo
- `hero-orchestra.jpg` - Hero section background
- `belles-beaux-group.jpg` - Belles & Beaux program photo
- `gala-ball-event.jpg` - Annual gala photo
- Other supporting images

## Membership Payment System

The website includes a complete membership payment system with QuickBooks Online integration.

### Current Status

**✅ Demo Mode Active**
- Beautiful membership landing page at [/membership](http://localhost:3000/membership)
- Full multi-step join form with validation
- Mock payment processing for demonstration
- Production-ready infrastructure

**🔧 Requires Setup for Production**
- QuickBooks Online credentials
- Payment processor integration
- Email notification service

### Quick Start

1. **View the demo**:
   ```bash
   npm run dev
   # Visit http://localhost:3000/membership
   ```

2. **Customize membership tiers**:
   - Edit [lib/membership/config.ts](lib/membership/config.ts)
   - Update prices, benefits, and descriptions

3. **Setup for production**:
   - Follow the detailed guide in [MEMBERSHIP_SETUP.md](MEMBERSHIP_SETUP.md)
   - Configure QuickBooks credentials
   - Enable real payment processing

### Features

- **Multi-step Form**: Tier selection, member info, payment, confirmation
- **QuickBooks Integration**: Automatic customer and invoice creation
- **Form Validation**: Zod schemas with real-time error handling
- **Mock Mode**: Full demo without external services
- **Mobile Responsive**: Works perfectly on all devices
- **Type Safe**: Full TypeScript coverage

## Deployment

This is a Next.js app and can be deployed to:
- **Vercel** (recommended) - Zero configuration deployment
- **Netlify** - Easy static site hosting
- **Any Node.js hosting** - Supports server-side rendering

### Environment Variables

Before deploying, configure environment variables:
```bash
cp .env.example .env.local
```

See [MEMBERSHIP_SETUP.md](MEMBERSHIP_SETUP.md) for details.

## Notes

- All dependencies are current and not deprecated (as of December 2025)
- No vulnerabilities found in npm audit
- Build completes successfully with TypeScript strict mode
- Ready for production deployment
- Membership system currently in demo mode (see [MEMBERSHIP_SETUP.md](MEMBERSHIP_SETUP.md))
