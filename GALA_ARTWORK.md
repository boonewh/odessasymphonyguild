# Gala 2027 decorative artwork

Created September 29, 2026 with the built-in image-generation tool, using the user's supplied flyers as visual references. These are decorative pieces, not embedded flyers. Essential content is HTML in the Gala pages; images have empty alt text and cannot intercept clicks.

## Files

- `public/images/gala-2027-header-art.png`: 1536 × 1024 transparent floral, satin bow, gifts, pearls, and gold glassware composition. Used on the three local sales preview pages.
- `public/images/gala-2027-gifts-art.png`: 2172 × 724 transparent rose and cookie gift composition. Used above gift choices.
- `public/images/gala-2027-envelope-art.png`: 1536 × 1024 transparent invitation stationery composition. Used on invitation requests.
- `public/images/gala-2027-envelope-invited-art.png`: 1536 × 1024 revised invitation stationery with gold “You’re invited” lettering, now used on invitation requests. The blank original is retained.

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

### Capitalized invitation lettering

Current invitation artwork: `public/images/gala-2027-envelope-invited-cursive.png` (1536 × 1024). The user requested a flowing cursive capital I in “Invited,” permitting natural overlap beneath the bow. Edited with the built-in image-generation tool; the original lower-case version is retained. A first capital-I attempt was refined to replace its stiff serif form with a looped calligraphy initial.

Final prompt:

> Precise lettering edit on this existing image. Card reads “You’re Invited”. Replace ONLY the stiff serif-style capital I at the beginning of Invited with a beautiful fully CURSIVE, LOOPED, FLOURISHED uppercase I in formal Copperplate/Spencerian wedding-invitation calligraphy. It must be a handwritten curving pen stroke with an oval entry loop at the TOP and a graceful looping lower exit joining the n, matching the ornate flowing Y in You're. NO straight typeset serif I, NO block letter I, NO Roman italic capital, NO dotted lowercase i. Give the cursive capital I enough room by slightly repositioning the second line if needed. Keep “Invited” legible. Lower flourishes may be occluded by the foreground bow naturally. Preserve exact wording, gold ink, tilted-card perspective, all other lettering as much as possible, and every surrounding object and color. Preserve dimensions and transparent alpha background. This is a tiny typography correction, not a new composition.

### Invitation lettering refinement

Edited with the built-in image-generation tool, using `gala-2027-envelope-art.png` as the edit target. Final prompt:

> Edit the supplied invitation stationery image. Change ONLY the blank cream card area: add the exact text “You’re invited” in elegant flowing gold calligraphy, on two lines, centered below the gold chandelier and above the striped bow. Make the lettering large and legible, printed naturally onto the tilted card, matching its perspective. Preserve the composition, envelope, flowers, ribbon, chandelier, stamps, pen, colors, dimensions, and original transparent alpha background. No other text or changes. Output transparent background.

The adjacent HTML link now uses the flyer’s wording, “Click here to submit your invitation information,” across three lines with a responsive SVG ticket border and no down arrow. Desktop and phone layouts and the anchor to the form were verified.

Gold frames, stripes, price ribbons, typography, selected states, and form styling are implemented in `components/gala/gala-sales.module.css`. The generated art is illustrative; it is not a representation of guaranteed gift packaging or event decorations. Board visual review remains part of preparing the feature for release.
