/** Callers select the mode from verified server configuration or GalaRuntime. */
export function galaExportFilename(kind: "gifts" | "invitations" | "table-assignments", live: boolean) {
  return `gala-2027-${live ? "" : "development-"}${kind}.csv`;
}

export function galaExportEnvironment(live: boolean) {
  return live ? "GALA 2027" : "DEVELOPMENT ONLY";
}
