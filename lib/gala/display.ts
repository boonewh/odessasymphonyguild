export function accountingLabel(status?:string) {
  switch(status) {
    case "synced": return "Recorded in QuickBooks";
    case "pending": return "Held for final sales total";
    case "processing": return "Recording in QuickBooks";
    case "review": return "Needs accounting review";
    case "failed": return "Could not record in QuickBooks";
    default: return "Not queued for QuickBooks";
  }
}
