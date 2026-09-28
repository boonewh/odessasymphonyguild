import { notFound } from "next/navigation";
import { previewAllowed } from "./model";

// Hard stop: these prototypes do not exist in production or hosted previews.
// Enabling actual sales requires a reviewed implementation and release gates.
export function requireGalaPreview() {
  if (!previewAllowed(process.env.NODE_ENV, process.env.VERCEL_ENV)) notFound();
}
