import { notFound } from "next/navigation";
import { previewAllowed } from "./model";
import { clientReviewAllowed } from "./client-review";
import { boardReviewAllowed } from "./board-review";

// Labs remain local. Only explicitly opted-in callers can use the board test.
// Production stays closed regardless of flags.
export function requireGalaPreview(allowBoardReview = false) {
  if (allowBoardReview && boardReviewAllowed(process.env)) return;
  if (!previewAllowed(process.env.NODE_ENV, process.env.VERCEL_ENV)) notFound();
}

export function requireGalaPage() {
  if (boardReviewAllowed(process.env)) return false;
  if (clientReviewAllowed(process.env.VERCEL_ENV, process.env.GALA_CLIENT_REVIEW)) return true;
  requireGalaPreview();
  return false;
}
