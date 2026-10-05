import { duplicateInvitations, filterInvitations, invitationKey, type InvitationRow } from "./invitations";

export class InvitationPrintError extends Error {}

// Every preview is a fresh read. Printing does not mutate preparation/mailing state.
export function invitationPrintBatch(rows: InvitationRow[], status: string, skip: number) {
  if (!["requested", "prepared"].includes(status) || !Number.isInteger(skip) || skip < 0 || skip > 29)
    throw new InvitationPrintError("Choose Needs preparation or Prepared, and skip 0–29 used labels.");
  const selected = filterInvitations(rows, status);
  if (!selected.length) throw new InvitationPrintError("No invitations match this label batch.");
  const duplicates = duplicateInvitations(rows);
  if (selected.some(row => duplicates.has(invitationKey(row))))
    throw new InvitationPrintError("Review possible duplicates in this batch before generating labels. Matches may be in another status.");
  const slots: (InvitationRow | null)[] = [...Array<null>(skip).fill(null), ...selected];
  return Array.from({ length: Math.ceil(slots.length / 30) }, (_, index) => slots.slice(index * 30, (index + 1) * 30));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export function invitationPrintProblem(message: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Label preview unavailable</title></head><body><h1>Label preview unavailable</h1><p>${escapeHtml(message)}</p><a href="/gala/preview/admin">Return to invitation admin</a></body></html>`;
}

// Constant script only; never interpolate recipient data into executable code.
export const invitationPrintScript = `
function validateLabels() {
  let fits = true;
  document.querySelectorAll('.address').forEach(element => {
    element.style.fontSize = '10pt';
    let size = 10;
    while ((element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth) && size > 8) {
      size -= 0.25; element.style.fontSize = size + 'pt';
    }
    if (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth) fits = false;
  });
  document.body.classList.toggle('does-not-fit', !fits);
  document.getElementById('overflow').hidden = fits;
  document.getElementById('print').disabled = !fits;
}
validateLabels();
window.addEventListener('beforeprint', validateLabels);
document.getElementById('print').addEventListener('click', () => { validateLabels(); if (!document.body.classList.contains('does-not-fit')) window.print(); });
`;

export function invitationLabelsHtml(rows: InvitationRow[], status: string, skip: number) {
  const pages = invitationPrintBatch(rows, status, skip);
  const count = pages.flat().filter(Boolean).length;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive">
<title>Development invitation labels</title><style>
*{box-sizing:border-box}body{margin:0;background:#edf3f0;color:#202a35;font:16px/1.5 Arial,sans-serif}header{max-width:8.5in;margin:24px auto;padding:20px;background:white}h1{font-size:24px}button,a{font:inherit}button{background:#246c65;color:white;border:0;border-radius:6px;padding:10px 16px;cursor:pointer}button:disabled{opacity:.5}a{color:#246c65}#overflow{color:#923f20}main{overflow-x:auto}.sheet{width:8.5in;height:11in;padding:.5in .1875in;display:grid;grid-template-columns:repeat(3,2.625in);grid-template-rows:repeat(10,1in);column-gap:.125in;background:white;margin:20px auto;break-after:page}.sheet:last-child{break-after:auto}.label{width:2.625in;height:1in;padding:.06in .12in;outline:1px dashed #ccd5d0}.address{height:.72in;font:10pt/1.12 Arial,sans-serif;overflow-wrap:anywhere;white-space:pre-line}.development{font:6pt/1 Arial,sans-serif;color:#555}.print-error{display:none}
@page{size:letter portrait;margin:0}
@media print{body{background:white}header{display:none}main{overflow:visible}.sheet{margin:0;outline:0}.label{outline:0}.does-not-fit main{display:none}.does-not-fit .print-error{display:block;padding:1in}}
</style></head><body><header><a href="/gala/preview/admin">Back to invitation admin</a><h1>Development invitation labels</h1>
<p>${count} recipients · ${pages.length} sheet(s) · ${skip} used label(s) skipped on the first sheet. Source: ${status === "requested" ? "Needs preparation" : "Prepared (reprint)"}.</p>
<p>Draft format: 30 labels per US Letter sheet, 1 × 2⅝ inches. Confirm the actual stock before use. Print at 100% / actual size, Letter portrait, with browser headers and footers off. Test alignment on plain paper first.</p>
<p>This is a snapshot. Reopen the preview after any address, duplicate or mailing change. Printing does not mark invitations prepared or mailed. Discard replaced labels; do not send another invitation just because a label was reprinted.</p>
<p id="overflow" role="alert" hidden>An address does not fit at a readable size. Return to the admin to review it, or use CSV mail merge with a larger label. Printing this batch is blocked.</p>
<noscript><p>JavaScript is needed to check label fit before printing. Use the CSV export if it is unavailable.</p><style>main{display:none}</style></noscript>
<button id="print" disabled>Print labels</button></header><p class="print-error">Labels could not be printed: an address does not fit. Review the label preview.</p><main>
${pages.map((page, index) => `<section class="sheet" aria-label="Label sheet ${index + 1}">${page.map(row => row ? `<div class="label"><div class="address">${[row.recipient.name,row.recipient.address,row.recipient.address2,`${row.recipient.city}, ${row.recipient.state} ${row.recipient.zip}`].filter(Boolean).map(escapeHtml).join("\n")}</div><div class="development">DEVELOPMENT ONLY — FICTIONAL ADDRESS</div></div>` : '<div class="label" aria-label="Used label — left blank"></div>').join("")}</section>`).join("\n")}
</main><script>${invitationPrintScript}</script></body></html>`;
}
