import { notFound } from "next/navigation";
import { previewAllowed } from "./model";
import { clientReviewAllowed } from "./client-review";

// Hard stop for the local workflow and admin, including hosted previews.
// Enabling actual sales requires a reviewed implementation and release gates.
export function requireGalaPreview() {
  if (!previewAllowed(process.env.NODE_ENV, process.env.VERCEL_ENV)) notFound();
}

export function requireGalaPage() {
  if (clientReviewAllowed(process.env.VERCEL_ENV, process.env.GALA_CLIENT_REVIEW)) return true;
  requireGalaPreview();
  return false;
}
