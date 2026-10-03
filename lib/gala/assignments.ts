import { z } from "zod";
export const assignmentRequest = z.object({
  orderId: z.uuid(), tableNumber: z.number().int().min(1).max(999).nullable(),
  revision: z.number().int().min(0),
}).strict();
export type TableAssignment = {
  id: string; tier: string; buyer: { name: string; email: string; phone: string };
  seats: number; table_number: number | null; revision: number;
};
export type AssignmentFilter = "all" | "assigned" | "unassigned";
export function filterAssignments(rows: TableAssignment[], filter: AssignmentFilter) {
  return rows.filter(row => filter === "all" || (filter === "assigned" ? row.table_number !== null : row.table_number === null));
}
// Quote every cell and neutralize formula prefixes, including after whitespace.
function csvCell(value: unknown) {
  const text = String(value ?? "");
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export function assignmentsCsv(rows: TableAssignment[]) {
  const records: unknown[][] = [["Environment", "Table number", "Tier", "Buyer", "Email", "Phone", "Purchased seats", "Assignment status", "Order reference"]];
  for (const row of rows) records.push(["DEVELOPMENT ONLY", row.table_number ?? "", row.tier, row.buyer.name,
    row.buyer.email, row.buyer.phone, row.seats, row.table_number === null ? "Unassigned" : "Assigned", row.id]);
  return "\uFEFF" + records.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
