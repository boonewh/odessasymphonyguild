/**
 * Standard security headers for API routes that handle sensitive data.
 * Per Intuit's security requirements: no-cache and no-store on all
 * SSL pages and pages containing sensitive data.
 */
export const SECURE_HEADERS = {
  "Cache-Control": "no-cache, no-store, must-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};
