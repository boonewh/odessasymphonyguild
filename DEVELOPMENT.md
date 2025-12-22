# Development Guide

## Quick Start

1. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Run development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to see your changes live.

3. **Build for production**:
   ```bash
   npm run build
   npm start
   ```

## Making Changes

### Editing Content

The main page content is in [app/page.tsx](app/page.tsx). The file is organized into clear sections:

- **Navigation** - Lines 11-89
- **Hero Section** - Lines 91-138
- **About Section** - Lines 140-210 (includes Our Mission box)
- **How We Serve** - Lines 212-332
- **Belles & Beaux** - Lines 334-494
- **Gala Section** - Lines 496-569
- **Contact Section** - Lines 571-610
- **Footer** - Lines 612-626

### Styling

This project uses Tailwind CSS for styling. All styles are utility classes applied directly to elements.

**Color Palette:**
- Primary Dark: `#1a1a2e` and `#2d3748`
- Gold Accent: `#d4af37` and `#c19b2e`
- Background: `#fdfcfb` (off-white)
- Text: `#2c2c2c` (dark gray)

**Fonts:**
- Script (Headings): `font-tangerine` - Tangerine from Google Fonts
- Body: `font-inter` - Inter from Google Fonts
- Fallback: Georgia, Times New Roman (serif)

### Adding New Pages

To add a new page (e.g., an About page):

1. Create a new folder in `app/` directory:
   ```bash
   mkdir app/about
   ```

2. Create a `page.tsx` file in that folder:
   ```bash
   touch app/about/page.tsx
   ```

3. Add your page content (you can copy the structure from the main page).

4. The page will automatically be available at `/about`

### Updating Images

1. Add new images to `public/images/`
2. Reference them in your code like this:
   ```tsx
   <Image
     src="/images/your-image.jpg"
     alt="Description"
     width={800}
     height={600}
   />
   ```

## Code Quality

### Type Checking
```bash
npx tsc --noEmit
```

### Linting
```bash
npm run lint
```

## Common Tasks

### Update Dependencies
```bash
npm update
npm audit
```

### Clear Build Cache
```bash
rm -rf .next
npm run build
```

### Check for Outdated Packages
```bash
npm outdated
```

## Tips

- **Hot Reload**: Changes to files automatically refresh the browser in dev mode
- **Mobile Testing**: Resize your browser or use DevTools responsive mode
- **Smooth Scrolling**: Navigation links use `href="#section-id"` for smooth scrolling
- **TypeScript**: The project uses strict TypeScript for better code quality

## Need Help?

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [React Documentation](https://react.dev)
