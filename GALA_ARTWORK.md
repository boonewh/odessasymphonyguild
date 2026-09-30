# Gala 2027 decorative artwork

Created September 29, 2026 with the built-in image-generation tool, using the user's supplied flyers as visual references. These are decorative pieces, not embedded flyers. Essential content is HTML in the Gala pages; images have empty alt text and cannot intercept clicks.

## Files

- `public/images/gala-2027-header-art.png`: 1536 × 1024 transparent floral, satin bow, gifts, pearls, and gold glassware composition. Used on the three local sales preview pages.
- `public/images/gala-2027-gifts-art.png`: 2172 × 724 transparent rose and cookie gift composition. Used above gift choices.
- `public/images/gala-2027-envelope-art.png`: 1536 × 1024 transparent invitation stationery composition. Used on invitation requests.

Reference files supplied by the user were `image1.png` (table/ticket flyer), `image0.png` (celebration gifts), and `image2.png` (invitation mailing). The originals remain outside the repository.

## Generation brief and prompts

All three calls requested transparent backgrounds and excluded text, logos, and movie branding. The page independently supplies the approved event wording and La Hacienda venue.

### Header artwork

Use the table flyer as the visual reference for a wide 3:2 decorative website header. Match its luxury 1960s invitation stationery styling. Create cream hydrangeas and roses, green leaves, black-and-ivory striped satin bows, teal gift boxes and pearls along the left edge; gold coupe glass, flowers and teal fabric along the right edge; and a large teal satin bow centered at the top. Keep the middle open and transparent for real HTML headings, with decoration concentrated on the outer edges. No text, logos, frame, paper background, or lettering. Real transparent alpha background.

### Celebration gifts

Use the gift flyer as the style reference. Create an isolated transparent wide composition with a single ivory rose in a clear gift box at the left and a clear bag containing two chocolate-chip cookies at the right. Tie each with glossy teal satin bows and blank gold treble-clef tags. Leave the center open and transparent. Show complete objects. No text, logos, borders, or background. Real transparent alpha background.

### Invitation stationery

Use the invitation flyer as the style reference. Create an isolated stationery still life: turquoise envelope with black-and-ivory striped satin bow, a blank cream invitation card with fine gold border and a small gold chandelier illustration, decorative stamps, a fountain pen, and ivory hydrangea accents. No text, logos, or lettering. Transparent alpha background.

## Presentation

Gold frames, stripes, price ribbons, typography, selected states, and form styling are implemented in `components/gala/gala-sales.module.css`. The generated art is illustrative; it is not a representation of guaranteed gift packaging or event decorations. Board visual review remains part of preparing the feature for release.
